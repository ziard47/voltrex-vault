import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VaultService } from '../src/main/services/vault-service';
import fs from 'node:fs';
import path from 'node:path';

const TEST_VAULT_DB_PATH = path.join(__dirname, 'test_service_vault.db');

describe('VaultService Integration & Security Lifecycle', () => {
  let service: VaultService;

  beforeEach(async () => {
    if (fs.existsSync(TEST_VAULT_DB_PATH)) {
      try { fs.unlinkSync(TEST_VAULT_DB_PATH); } catch { /* ignore */ }
    }
    service = new VaultService(TEST_VAULT_DB_PATH);
    await service.initialize();
  });

  afterEach(() => {
    if (service) {
      service.close();
    }
    if (fs.existsSync(TEST_VAULT_DB_PATH)) {
      try { fs.unlinkSync(TEST_VAULT_DB_PATH); } catch { /* ignore */ }
    }
  });

  it('starts in uninitialized and locked state', () => {
    const status = service.getStatus();
    expect(status.isInitialized).toBe(false);
    expect(status.isUnlocked).toBe(false);
  });

  it('sets up a new vault and unlocks it automatically', async () => {
    await service.setupVault('CorrectMasterPassword123!');
    const status = service.getStatus();
    expect(status.isInitialized).toBe(true);
    expect(status.isUnlocked).toBe(true);
  });

  it('fails to unlock with incorrect master password', async () => {
    await service.setupVault('CorrectMasterPassword123!');
    service.lockVault();
    expect(service.getStatus().isUnlocked).toBe(false);

    await expect(service.unlockVault('WrongPassword456!')).rejects.toThrow('Invalid master password.');
    expect(service.getStatus().isUnlocked).toBe(false);
  });

  it('unlocks successfully with the correct master password', async () => {
    await service.setupVault('CorrectMasterPassword123!');
    service.lockVault();

    const unlocked = await service.unlockVault('CorrectMasterPassword123!');
    expect(unlocked).toBe(true);
    expect(service.getStatus().isUnlocked).toBe(true);
  });

  it('stores and retrieves encrypted vault entries with restart persistence', async () => {
    await service.setupVault('VaultPassword987!');

    const savedEntry = service.saveEntry({
      type: 'login',
      title: 'ProtonMail',
      isFavorite: true,
      payload: {
        type: 'login',
        title: 'ProtonMail',
        username: 'user@proton.me',
        password: 'TopSecretProtonPassword#1',
        url: 'https://mail.proton.me',
        tags: ['security', 'email'],
        notes: 'Personal encrypted email',
      },
    });

    expect(savedEntry.id).toBeDefined();
    expect(savedEntry.title).toBe('ProtonMail');

    // Verify secret is decryptable
    let entries = service.listEntries();
    expect(entries).toHaveLength(1);
    expect((entries[0].payload as any).password).toBe('TopSecretProtonPassword#1');

    // Simulate app shutdown and restart
    service.close();

    const restartedService = new VaultService(TEST_VAULT_DB_PATH);
    await restartedService.initialize();

    // Must be locked on startup
    expect(restartedService.getStatus().isUnlocked).toBe(false);

    // Cannot read entries while locked
    expect(() => restartedService.listEntries()).toThrow('Vault is locked.');

    // Unlock with correct password
    await restartedService.unlockVault('VaultPassword987!');
    expect(restartedService.getStatus().isUnlocked).toBe(true);

    entries = restartedService.listEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].title).toBe('ProtonMail');
    expect((entries[0].payload as any).password).toBe('TopSecretProtonPassword#1');

    // Verify raw database file on disk does NOT contain the plaintext password
    const rawDbContent = fs.readFileSync(TEST_VAULT_DB_PATH, 'utf8');
    expect(rawDbContent).not.toContain('TopSecretProtonPassword#1');
    expect(rawDbContent).not.toContain('VaultPassword987!');

    restartedService.close();
  });

  it('supports changing master password and maintains entry accessibility', async () => {
    await service.setupVault('InitialPassword111!');

    service.saveEntry({
      type: 'note',
      title: 'Recovery Seed',
      payload: {
        type: 'note',
        title: 'Recovery Seed',
        content: 'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12',
      },
    });

    // Change master password
    await service.changeMasterPassword('InitialPassword111!', 'BrandNewStrongPassword222!');

    // Re-lock
    service.lockVault();

    // Old password must fail
    await expect(service.unlockVault('InitialPassword111!')).rejects.toThrow('Invalid master password.');

    // New password must succeed
    await service.unlockVault('BrandNewStrongPassword222!');
    expect(service.getStatus().isUnlocked).toBe(true);

    const entries = service.listEntries();
    expect(entries).toHaveLength(1);
    expect((entries[0].payload as any).content).toContain('word1 word2');
  });

  it('exports vault with password verification and rejects unauthorized export', async () => {
    await service.setupVault('ExportSecurityPass!1');

    service.saveEntry({
      type: 'login',
      title: 'GitLab',
      payload: {
        type: 'login',
        title: 'GitLab',
        username: 'dev@gitlab.com',
        password: 'gitlab-pwd-999',
      },
    });

    // Wrong password should be rejected
    await expect(service.exportVault('IncorrectPassword')).rejects.toThrow('Master password verification failed.');

    // Correct password allows export
    const exportResult = await service.exportVault('ExportSecurityPass!1');
    expect(exportResult.format).toBe('voltrex-vault-unencrypted-export');
    expect(exportResult.entries).toHaveLength(1);
    expect(exportResult.entries[0].title).toBe('GitLab');
  });
});
