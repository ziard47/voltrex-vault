import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { VaultService } from '../src/main/services/vault-service';
import { decryptAndValidateBackup } from '../src/main/backup/container';

describe('Encrypted Backup Container (Phase 2)', () => {
  let tmpDir: string;
  let dbPath: string;
  let vaultService: VaultService;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'voltrex-container-test-'));
    dbPath = path.join(tmpDir, 'test-vault.db');
    vaultService = new VaultService(dbPath);
    await vaultService.initialize();
  });

  afterEach(() => {
    vaultService.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates an encrypted backup container in voltrex-vault-encrypted-backup-v1 format', async () => {
    const masterPassword = 'CorrectMasterPassword123!';
    await vaultService.setupVault(masterPassword);

    // Save a test entry
    vaultService.saveEntry({
      type: 'login',
      title: 'GitHub Work Account',
      payload: {
        type: 'login',
        title: 'GitHub Work Account',
        username: 'engineer@corp.com',
        password: 'SuperSecretGitHubPassword!',
        url: 'https://github.com/login',
      },
    });

    const container = vaultService.createBackup();

    expect(container.format).toBe('voltrex-vault-encrypted-backup');
    expect(container.version).toBe(1);
    expect(container.vaultId).toBeDefined();
    expect(typeof container.vaultId).toBe('string');
    expect(container.backupId).toBeDefined();
    expect(container.itemCount).toBe(1);
    expect(container.kdf.algorithm).toBe('argon2id');
    expect(container.cipher.algorithm).toBe('aes-256-gcm');
    expect(container.encryptedDek.ciphertextHex).toBeDefined();
    expect(container.encryptedDek.tagHex).toHaveLength(32); // 16 bytes = 32 hex chars
    expect(container.payload.ciphertextHex).toBeDefined();
    expect(container.payload.tagHex).toHaveLength(32);
  });

  it('successfully decrypts and validates container with correct master password', async () => {
    const masterPassword = 'CorrectMasterPassword123!';
    await vaultService.setupVault(masterPassword);

    vaultService.saveEntry({
      type: 'note',
      title: 'Confidential Notes',
      payload: {
        type: 'note',
        title: 'Confidential Notes',
        content: 'Top secret server access recovery codes: 4920-1928-5819',
      },
    });

    const container = vaultService.createBackup();
    const decrypted = await decryptAndValidateBackup(container, masterPassword);

    expect(decrypted.vaultId).toBe(container.vaultId);
    expect(decrypted.backupId).toBe(container.backupId);
    expect(decrypted.entries).toHaveLength(1);
    expect(decrypted.entries[0].title).toBe('Confidential Notes');
  });

  it('fails to decrypt and rejects container when master password is wrong', async () => {
    const masterPassword = 'CorrectMasterPassword123!';
    await vaultService.setupVault(masterPassword);

    const container = vaultService.createBackup();

    await expect(
      decryptAndValidateBackup(container, 'WrongMasterPassword999!')
    ).rejects.toThrow(/master password verification failed/i);
  });

  it('detects tampering and rejects container when payload ciphertext is altered', async () => {
    const masterPassword = 'CorrectMasterPassword123!';
    await vaultService.setupVault(masterPassword);

    const container = vaultService.createBackup();

    // Tamper with payload ciphertext
    const originalCiphertext = container.payload.ciphertextHex;
    const tamperedHex =
      originalCiphertext.slice(0, -2) + (originalCiphertext.slice(-2) === 'aa' ? 'bb' : 'aa');
    const tamperedContainer = {
      ...container,
      payload: {
        ...container.payload,
        ciphertextHex: tamperedHex,
      },
    };

    await expect(
      decryptAndValidateBackup(tamperedContainer, masterPassword)
    ).rejects.toThrow();
  });

  it('detects tampering and rejects container when authentication tag is altered', async () => {
    const masterPassword = 'CorrectMasterPassword123!';
    await vaultService.setupVault(masterPassword);

    const container = vaultService.createBackup();

    // Tamper with tag
    const originalTag = container.payload.tagHex;
    const tamperedTag =
      originalTag.slice(0, -2) + (originalTag.slice(-2) === '11' ? '22' : '11');
    const tamperedContainer = {
      ...container,
      payload: {
        ...container.payload,
        tagHex: tamperedTag,
      },
    };

    await expect(
      decryptAndValidateBackup(tamperedContainer, masterPassword)
    ).rejects.toThrow();
  });
});
