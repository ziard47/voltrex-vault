/**
 * Voltrex Vault - Encrypted Backup Container Module
 * Implements versioned, zero-knowledge, authenticated backup containers.
 */

import crypto from 'node:crypto';
import { VaultService } from '../services/vault-service';
import {
  EncryptedBackupContainer,
  VaultEntry,
  VaultSettings,
  VaultMetadata,
} from '../../shared/types';
import { deriveAllKeys } from '../crypto/kdf';
import {
  encryptPayload,
  decryptPayload,
  decryptDek,
  CryptoIntegrityError,
} from '../crypto/cipher';
import { zeroizeBuffers } from '../crypto/zeroize';
import { validatePayload, ValidationError } from '../../shared/validation';

const AUTH_CHECK_SENTINEL = 'voltrex-vault-auth-token-v1';

export interface DecryptedBackupData {
  backupId: string;
  vaultId: string;
  createdAt: number;
  entries: VaultEntry[];
  settings?: VaultSettings;
}

export interface ContainerInspectionSummary {
  backupId: string;
  vaultId: string;
  createdAt: number;
  itemCount: number;
  appVersion: string;
  version: number;
}

export function validateBackupContainerSchema(data: unknown): EncryptedBackupContainer {
  if (!data || typeof data !== 'object') {
    throw new ValidationError('Backup file is not a valid JSON object.');
  }
  const obj = data as Record<string, unknown>;
  if (obj.format !== 'voltrex-vault-encrypted-backup') {
    throw new ValidationError('Invalid or unrecognized backup format.');
  }
  if (obj.version !== 1) {
    throw new ValidationError(`Unsupported backup container version: ${String(obj.version)}`);
  }
  if (typeof obj.backupId !== 'string' || !obj.backupId) {
    throw new ValidationError('Missing backupId in container.');
  }
  if (typeof obj.vaultId !== 'string' || !obj.vaultId) {
    throw new ValidationError('Missing vaultId in container.');
  }
  if (!obj.kdf || typeof obj.kdf !== 'object') {
    throw new ValidationError('Missing KDF parameters in backup container.');
  }
  if (!obj.encryptedDek || typeof obj.encryptedDek !== 'object') {
    throw new ValidationError('Missing encrypted DEK in backup container.');
  }
  if (!obj.authCheck || typeof obj.authCheck !== 'object') {
    throw new ValidationError('Missing auth check metadata in backup container.');
  }
  if (!obj.payload || typeof obj.payload !== 'object') {
    throw new ValidationError('Missing encrypted payload in backup container.');
  }

  return obj as unknown as EncryptedBackupContainer;
}

/**
 * Inspects a backup container header without decrypting payload or requiring master password.
 */
export function inspectBackupContainer(data: unknown): ContainerInspectionSummary {
  const container = validateBackupContainerSchema(data);
  return {
    backupId: container.backupId,
    vaultId: container.vaultId,
    createdAt: container.createdAt,
    itemCount: container.itemCount ?? 0,
    appVersion: container.appVersion,
    version: container.version,
  };
}

/**
 * Creates an encrypted backup container from the current active vault state.
 * Vault MUST be unlocked.
 */
export function createBackupContainer(
  vaultService: VaultService,
  metadata: VaultMetadata & { authCheckHex: string },
  dek: Buffer
): EncryptedBackupContainer {
  const entries = vaultService.listEntries(true);
  const settings = vaultService.getSettings();

  const payloadData = {
    vaultId: metadata.vaultId,
    createdAt: Date.now(),
    entries,
    settings,
  };

  // Encrypt payload with DEK using AES-256-GCM and unique 12-byte IV
  const encryptedPayload = encryptPayload(payloadData, dek);

  const authCheckObj = JSON.parse(metadata.authCheckHex);

  const container: EncryptedBackupContainer = {
    format: 'voltrex-vault-encrypted-backup',
    version: 1,
    backupId: crypto.randomUUID(),
    vaultId: metadata.vaultId,
    appVersion: '1.0.0',
    createdAt: Date.now(),
    itemCount: entries.filter(e => !e.trashedAt).length,
    kdf: {
      algorithm: 'argon2id',
      params: metadata.kdfParams,
      saltHex: metadata.kdfSaltHex,
    },
    cipher: {
      algorithm: 'aes-256-gcm',
      keyBits: 256,
      ivBits: 96,
      tagBits: 128,
    },
    encryptedDek: {
      ciphertextHex: metadata.encryptedDekHex,
      ivHex: metadata.dekIvHex,
      tagHex: metadata.dekTagHex,
    },
    authCheck: {
      ciphertextHex: authCheckObj.ciphertextHex,
      ivHex: authCheckObj.ivHex,
      tagHex: authCheckObj.tagHex,
    },
    payload: {
      ciphertextHex: encryptedPayload.ciphertextHex,
      ivHex: encryptedPayload.ivHex,
      tagHex: encryptedPayload.tagHex,
    },
  };

  return container;
}

/**
 * Decrypts and authenticates a backup container using the supplied master password.
 * Authenticates GCM tags and rejects tampered ciphertexts.
 */
export async function decryptAndValidateBackup(
  rawContainer: unknown,
  masterPassword: string
): Promise<DecryptedBackupData> {
  const container = validateBackupContainerSchema(rawContainer);

  const salt = Buffer.from(container.kdf.saltHex, 'hex');
  const { masterKey, kek, authKey } = await deriveAllKeys(
    masterPassword,
    salt,
    container.kdf.params
  );

  try {
    // 1. Verify master password against authCheck
    try {
      const decryptedSentinel = decryptPayload<string>(
        {
          ciphertextHex: container.authCheck.ciphertextHex,
          ivHex: container.authCheck.ivHex,
          tagHex: container.authCheck.tagHex,
          version: 1,
        },
        authKey
      );
      if (decryptedSentinel !== AUTH_CHECK_SENTINEL) {
        throw new Error('Master password verification failed for backup container.');
      }
    } catch {
      throw new Error('Master password verification failed for backup container.');
    }

    // 2. Decrypt DEK using KEK
    let dek: Buffer;
    try {
      dek = decryptDek(
        container.encryptedDek.ciphertextHex,
        container.encryptedDek.ivHex,
        container.encryptedDek.tagHex,
        kek
      );
    } catch (err) {
      throw new CryptoIntegrityError('Failed to decrypt DEK: backup container key integrity corrupted.');
    }

    // 3. Decrypt payload using DEK
    let payloadObj: {
      vaultId: string;
      createdAt: number;
      entries: unknown[];
      settings?: VaultSettings;
    };

    try {
      payloadObj = decryptPayload(
        {
          ciphertextHex: container.payload.ciphertextHex,
          ivHex: container.payload.ivHex,
          tagHex: container.payload.tagHex,
          version: 1,
        },
        dek
      );
    } catch (err) {
      throw new CryptoIntegrityError('Failed to decrypt payload: backup content has been tampered with or corrupted.');
    }

    if (!payloadObj || !Array.isArray(payloadObj.entries)) {
      throw new ValidationError('Decrypted backup payload has invalid format.');
    }

    // 4. Validate all entries
    const validatedEntries: VaultEntry[] = payloadObj.entries.map((item, idx) => {
      const e = item as Record<string, unknown>;
      const payload = validatePayload(e.payload);
      return {
        id: typeof e.id === 'string' && e.id ? e.id : crypto.randomUUID(),
        type: payload.type,
        title: typeof e.title === 'string' && e.title.trim() ? e.title.trim() : payload.title,
        isFavorite: Boolean(e.isFavorite),
        createdAt: typeof e.createdAt === 'number' ? e.createdAt : Date.now(),
        updatedAt: typeof e.updatedAt === 'number' ? e.updatedAt : Date.now(),
        trashedAt: typeof e.trashedAt === 'number' ? e.trashedAt : null,
        payload,
      };
    });

    return {
      backupId: container.backupId,
      vaultId: container.vaultId,
      createdAt: container.createdAt,
      entries: validatedEntries,
      settings: payloadObj.settings,
    };
  } finally {
    zeroizeBuffers(masterKey, kek, authKey);
  }
}
