/**
 * Voltrex Vault - Main Process Vault Service
 * Coordinates cryptographic operations, key lifecycle, persistence, and state transitions.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseManager } from '../storage/db';
import { runMigrations } from '../storage/migrations';
import { VaultRepository } from '../storage/vault-repository';
import {
  deriveAllKeys,
  DEFAULT_ARGON2_PARAMS,
  Argon2Parameters,
} from '../crypto/kdf';
import {
  encryptPayload,
  decryptPayload,
  encryptDek,
  decryptDek,
  generateDek,
  generateRandomBytes,
  CryptoIntegrityError,
} from '../crypto/cipher';
import { zeroizeBuffer, zeroizeBuffers } from '../crypto/zeroize';
import {
  VaultEntry,
  VaultEntryPayload,
  VaultMetadata,
  VaultSettings,
  VaultStatus,
  ExportData,
  EncryptedRecord,
  EncryptedBackupContainer,
} from '../../shared/types';
import {
  validatePayload,
  validateSettings,
  validateExportData,
  ValidationError,
} from '../../shared/validation';
import { createBackupContainer, DecryptedBackupData } from '../backup/container';

const AUTH_CHECK_SENTINEL = 'voltrex-vault-auth-token-v1';

export class VaultService {
  private dbManager: DatabaseManager;
  private repo: VaultRepository;
  private dek: Buffer | null = null;
  private isUnlockedState = false;
  private changeListeners: (() => void)[] = [];
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.dbManager = new DatabaseManager(dbPath);
    this.repo = new VaultRepository(this.dbManager);
  }

  public async initialize(): Promise<void> {
    await this.dbManager.initialize();
    runMigrations(this.dbManager);
  }

  public getDbPath(): string {
    return this.dbPath;
  }

  public getRepository(): VaultRepository {
    return this.repo;
  }

  public getDek(): Buffer | null {
    return this.dek;
  }

  public onVaultChanged(listener: () => void): () => void {
    this.changeListeners.push(listener);
    return () => {
      this.changeListeners = this.changeListeners.filter(l => l !== listener);
    };
  }

  public notifyChange(): void {
    for (const listener of this.changeListeners) {
      try { listener(); } catch { /* ignore */ }
    }
  }

  public getStatus(): VaultStatus {
    const isInit = this.repo.isInitialized();
    const meta = isInit ? this.repo.getMetadata() : null;
    return {
      isInitialized: isInit,
      isUnlocked: this.isUnlockedState && this.dek !== null,
      itemCount: isInit ? this.repo.getItemCount() : 0,
      vaultId: meta?.vaultId,
    };
  }

  public getSettings(): VaultSettings {
    return this.repo.getSettings();
  }

  public updateSettings(settings: Partial<VaultSettings>): VaultSettings {
    const current = this.repo.getSettings();
    const validated = validateSettings({
      autoLockMinutes: settings.autoLockMinutes ?? current.autoLockMinutes,
      clipboardClearSeconds: settings.clipboardClearSeconds ?? current.clipboardClearSeconds,
      gdriveClientId: settings.gdriveClientId !== undefined ? settings.gdriveClientId : current.gdriveClientId,
      gdriveAutoBackupEnabled: settings.gdriveAutoBackupEnabled !== undefined ? settings.gdriveAutoBackupEnabled : current.gdriveAutoBackupEnabled,
      gdriveIntervalMinutes: settings.gdriveIntervalMinutes ?? current.gdriveIntervalMinutes,
      gdriveRetentionCount: settings.gdriveRetentionCount ?? current.gdriveRetentionCount,
    });
    this.repo.saveSettings(validated);
    return validated;
  }

  /**
   * Initializes a new vault with the specified master password.
   */
  public async setupVault(masterPassword: string): Promise<void> {
    if (this.repo.isInitialized()) {
      throw new Error('Vault is already initialized.');
    }
    if (!masterPassword || masterPassword.length < 8) {
      throw new ValidationError('Master password must be at least 8 characters long.');
    }

    const salt = generateRandomBytes(32);
    const kdfParams: Argon2Parameters = DEFAULT_ARGON2_PARAMS;

    const { masterKey, kek, authKey } = await deriveAllKeys(masterPassword, salt, kdfParams);

    try {
      // Generate a fresh random 256-bit Data Encryption Key (DEK)
      const newDek = generateDek();

      // Encrypt the DEK with the KEK
      const encryptedDekRecord = encryptDek(newDek, kek);

      // Create authentication verification token
      const authPayload = encryptPayload(AUTH_CHECK_SENTINEL, authKey);
      const authCheckHex = JSON.stringify(authPayload);

      const metadata: VaultMetadata = {
        version: 1,
        vaultId: crypto.randomUUID(),
        kdfSaltHex: salt.toString('hex'),
        kdfParams,
        encryptedDekHex: encryptedDekRecord.encryptedDekHex,
        dekIvHex: encryptedDekRecord.dekIvHex,
        dekTagHex: encryptedDekRecord.dekTagHex,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      this.repo.saveMetadata(metadata, authCheckHex);

      // Keep DEK in memory and transition to unlocked state
      this.dek = newDek;
      this.isUnlockedState = true;
    } finally {
      zeroizeBuffers(masterKey, kek, authKey);
    }
  }

  /**
   * Unlocks the vault using the master password.
   */
  public async unlockVault(masterPassword: string): Promise<boolean> {
    if (!this.repo.isInitialized()) {
      throw new Error('Vault is not initialized. Please set up the vault first.');
    }
    if (this.isUnlockedState && this.dek) {
      return true;
    }

    const metadata = this.repo.getMetadata();
    if (!metadata) {
      throw new Error('Vault metadata could not be loaded.');
    }

    const salt = Buffer.from(metadata.kdfSaltHex, 'hex');
    const { masterKey, kek, authKey } = await deriveAllKeys(
      masterPassword,
      salt,
      metadata.kdfParams
    );

    try {
      // 1. Verify password validity using the auth check token
      try {
        const authPayload = JSON.parse(metadata.authCheckHex);
        const decryptedSentinel = decryptPayload<string>(authPayload, authKey);
        if (decryptedSentinel !== AUTH_CHECK_SENTINEL) {
          throw new Error('Invalid master password.');
        }
      } catch {
        throw new Error('Invalid master password.');
      }

      // 2. Decrypt the Data Encryption Key (DEK)
      const decryptedDek = decryptDek(
        metadata.encryptedDekHex,
        metadata.dekIvHex,
        metadata.dekTagHex,
        kek
      );

      this.dek = decryptedDek;
      this.isUnlockedState = true;
      return true;
    } finally {
      zeroizeBuffers(masterKey, kek, authKey);
    }
  }

  /**
   * Locks the vault immediately and securely zeroizes memory buffers.
   */
  public lockVault(): void {
    if (this.dek) {
      zeroizeBuffer(this.dek);
      this.dek = null;
    }
    this.isUnlockedState = false;
  }

  /**
   * Changes the master password, re-encrypting the existing DEK under the new KEK.
   */
  public async changeMasterPassword(currentPassword: string, newPassword: string): Promise<void> {
    this.ensureUnlocked();
    if (!newPassword || newPassword.length < 8) {
      throw new ValidationError('New master password must be at least 8 characters long.');
    }

    // Verify current password first
    const metadata = this.repo.getMetadata();
    if (!metadata) throw new Error('Metadata missing.');

    const oldSalt = Buffer.from(metadata.kdfSaltHex, 'hex');
    const oldKeys = await deriveAllKeys(currentPassword, oldSalt, metadata.kdfParams);

    try {
      const authPayload = JSON.parse(metadata.authCheckHex);
      const decryptedSentinel = decryptPayload<string>(authPayload, oldKeys.authKey);
      if (decryptedSentinel !== AUTH_CHECK_SENTINEL) {
        throw new Error('Current master password verification failed.');
      }
    } catch {
      throw new Error('Current master password verification failed.');
    } finally {
      zeroizeBuffers(oldKeys.masterKey, oldKeys.kek, oldKeys.authKey);
    }

    // Derive new keys with fresh salt
    const newSalt = generateRandomBytes(32);
    const newKeys = await deriveAllKeys(newPassword, newSalt, metadata.kdfParams);

    try {
      // Re-encrypt existing DEK under new KEK
      const encryptedDekRecord = encryptDek(this.dek!, newKeys.kek);
      const newAuthPayload = encryptPayload(AUTH_CHECK_SENTINEL, newKeys.authKey);

      this.repo.updateEncryptedDek(
        encryptedDekRecord.encryptedDekHex,
        encryptedDekRecord.dekIvHex,
        encryptedDekRecord.dekTagHex,
        JSON.stringify(newAuthPayload),
        newSalt.toString('hex')
      );
    } finally {
      zeroizeBuffers(newKeys.masterKey, newKeys.kek, newKeys.authKey);
    }
  }

  /**
   * Retrieves and decrypts all entries in the vault.
   */
  public listEntries(includeTrashed = false): VaultEntry[] {
    this.ensureUnlocked();
    const records = this.repo.getAllEntries(includeTrashed);
    const results: VaultEntry[] = [];

    for (const record of records) {
      try {
        const payload = decryptPayload<VaultEntryPayload>(
          {
            ivHex: record.ivHex,
            ciphertextHex: record.ciphertextHex,
            tagHex: record.tagHex,
            version: record.version,
          },
          this.dek!
        );

        results.push({
          id: record.id,
          type: record.type,
          title: record.title,
          isFavorite: record.isFavorite,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
          trashedAt: record.trashedAt,
          payload,
        });
      } catch (err) {
        // Skip corrupt entry or log non-sensitive warning
        console.error(`[VaultService] Failed to decrypt entry ${record.id}: integrity check failed.`);
      }
    }

    return results;
  }

  public getEntry(id: string): VaultEntry | null {
    this.ensureUnlocked();
    const record = this.repo.getEntryById(id);
    if (!record) return null;

    const payload = decryptPayload<VaultEntryPayload>(
      {
        ivHex: record.ivHex,
        ciphertextHex: record.ciphertextHex,
        tagHex: record.tagHex,
        version: record.version,
      },
      this.dek!
    );

    return {
      id: record.id,
      type: record.type,
      title: record.title,
      isFavorite: record.isFavorite,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      trashedAt: record.trashedAt,
      payload,
    };
  }

  public saveEntry(entry: {
    id?: string;
    type: VaultEntry['type'];
    title: string;
    isFavorite?: boolean;
    payload: VaultEntryPayload;
  }): VaultEntry {
    this.ensureUnlocked();
    const validatedPayload = validatePayload(entry.payload);
    const id = entry.id || crypto.randomUUID();
    const isFavorite = Boolean(entry.isFavorite);
    const now = Date.now();

    const existing = this.repo.getEntryById(id);
    const createdAt = existing ? existing.createdAt : now;

    // Encrypt the payload with DEK using a unique 12-byte IV
    const encrypted = encryptPayload(validatedPayload, this.dek!);

    const record: EncryptedRecord = {
      id,
      type: entry.type,
      title: entry.title.trim() || validatedPayload.title,
      isFavorite,
      createdAt,
      updatedAt: now,
      trashedAt: null,
      ivHex: encrypted.ivHex,
      ciphertextHex: encrypted.ciphertextHex,
      tagHex: encrypted.tagHex,
      version: 1,
    };

    this.repo.saveEntry(record);
    this.notifyChange();

    return {
      id,
      type: entry.type,
      title: record.title,
      isFavorite,
      createdAt,
      updatedAt: now,
      payload: validatedPayload,
    };
  }

  public toggleFavorite(id: string): boolean {
    this.ensureUnlocked();
    const record = this.repo.getEntryById(id);
    if (!record) throw new Error('Entry not found.');

    record.isFavorite = !record.isFavorite;
    record.updatedAt = Date.now();
    this.repo.saveEntry(record);
    this.notifyChange();
    return record.isFavorite;
  }

  public softDeleteEntry(id: string): void {
    this.ensureUnlocked();
    this.repo.softDeleteEntry(id);
    this.notifyChange();
  }

  public restoreEntry(id: string): void {
    this.ensureUnlocked();
    this.repo.restoreEntry(id);
    this.notifyChange();
  }

  public permanentDeleteEntry(id: string): void {
    this.ensureUnlocked();
    this.repo.permanentDeleteEntry(id);
    this.notifyChange();
  }

  /**
   * Generates a plaintext export of the vault entries.
   * STRICT SECURITY REQUIREMENT:
   * Requires master password confirmation.
   */
  public async exportVault(masterPassword: string): Promise<ExportData> {
    this.ensureUnlocked();

    // Verify master password before allowing export
    const metadata = this.repo.getMetadata();
    if (!metadata) throw new Error('Metadata missing.');

    const salt = Buffer.from(metadata.kdfSaltHex, 'hex');
    const { masterKey, kek, authKey } = await deriveAllKeys(masterPassword, salt, metadata.kdfParams);

    try {
      const authPayload = JSON.parse(metadata.authCheckHex);
      const decryptedSentinel = decryptPayload<string>(authPayload, authKey);
      if (decryptedSentinel !== AUTH_CHECK_SENTINEL) {
        throw new Error('Master password verification failed. Export aborted.');
      }
    } catch {
      throw new Error('Master password verification failed. Export aborted.');
    } finally {
      zeroizeBuffers(masterKey, kek, authKey);
    }

    const entries = this.listEntries(false);
    return {
      format: 'voltrex-vault-unencrypted-export',
      exportVersion: 1,
      exportedAt: Date.now(),
      entries,
    };
  }

  /**
   * Imports validated entries into the vault.
   */
  public importVault(rawJsonData: unknown): { importedCount: number } {
    this.ensureUnlocked();
    const validatedData = validateExportData(rawJsonData);

    const recordsToInsert: EncryptedRecord[] = [];
    const now = Date.now();

    for (const entry of validatedData.entries) {
      const encrypted = encryptPayload(entry.payload, this.dek!);
      recordsToInsert.push({
        id: entry.id || crypto.randomUUID(),
        type: entry.type,
        title: entry.title,
        isFavorite: entry.isFavorite,
        createdAt: entry.createdAt || now,
        updatedAt: now,
        trashedAt: null,
        ivHex: encrypted.ivHex,
        ciphertextHex: encrypted.ciphertextHex,
        tagHex: encrypted.tagHex,
        version: 1,
      });
    }

    this.repo.batchInsert(recordsToInsert);
    this.notifyChange();
    return { importedCount: recordsToInsert.length };
  }

  /**
   * Generates a versioned, zero-knowledge encrypted backup container.
   */
  public createBackup(): EncryptedBackupContainer {
    this.ensureUnlocked();
    const meta = this.repo.getMetadata();
    if (!meta) throw new Error('Cannot create backup: metadata missing.');
    return createBackupContainer(this, meta, this.dek!);
  }

  /**
   * Restores vault from decrypted backup data in a single SQLite transaction
   * with safety snapshot rollback on failure.
   */
  public restoreFromDecryptedBackup(decrypted: DecryptedBackupData): void {
    this.ensureUnlocked();

    // 1. Create safety snapshot of current database
    const snapshotPath = path.join(
      path.dirname(this.dbPath),
      `pre-restore-snapshot-${Date.now()}.db`
    );
    try {
      this.repo.createSafetySnapshot(snapshotPath);
    } catch (e) {
      console.warn('[VaultService] Failed to create safety snapshot:', e);
    }

    try {
      const now = Date.now();
      const recordsToInsert: EncryptedRecord[] = [];

      for (const entry of decrypted.entries) {
        const encrypted = encryptPayload(entry.payload, this.dek!);
        recordsToInsert.push({
          id: entry.id || crypto.randomUUID(),
          type: entry.type,
          title: entry.title,
          isFavorite: entry.isFavorite,
          createdAt: entry.createdAt || now,
          updatedAt: now,
          trashedAt: entry.trashedAt || null,
          ivHex: encrypted.ivHex,
          ciphertextHex: encrypted.ciphertextHex,
          tagHex: encrypted.tagHex,
          version: 1,
        });
      }

      this.repo.replaceAllEntries(recordsToInsert);
      this.notifyChange();
    } catch (err) {
      // Restore from safety snapshot on failure
      if (fs.existsSync(snapshotPath)) {
        try {
          fs.copyFileSync(snapshotPath, this.dbPath);
        } catch { /* ignore */ }
      }
      throw err;
    }
  }

  public close(): void {
    this.lockVault();
    this.dbManager.close();
  }

  private ensureUnlocked(): void {
    if (!this.isUnlockedState || !this.dek) {
      throw new Error('Vault is locked. Please unlock the vault first.');
    }
  }
}
