import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { VaultService } from '../src/main/services/vault-service';
import { BackupScheduler } from '../src/main/services/backup-scheduler';
import { GoogleDriveService } from '../src/main/services/gdrive-service';

describe('Vault Backup & Restore Atomic Lifecycle', () => {
  let tmpDir: string;
  let dbPath: string;
  let vaultService: VaultService;
  let gdriveService: GoogleDriveService;
  let backupScheduler: BackupScheduler;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'voltrex-restore-flow-test-'));
    dbPath = path.join(tmpDir, 'active-vault.db');
    vaultService = new VaultService(dbPath);
    await vaultService.initialize();

    gdriveService = new GoogleDriveService(tmpDir);
    backupScheduler = new BackupScheduler(vaultService, gdriveService);
  });

  afterEach(() => {
    backupScheduler.close();
    vaultService.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('restores container accurately and creates a pre-restore safety snapshot', async () => {
    const masterPassword = 'MasterPassword123!';
    await vaultService.setupVault(masterPassword);

    // Initial item in vault
    vaultService.saveEntry({
      type: 'login',
      title: 'Original Service',
      payload: {
        type: 'login',
        title: 'Original Service',
        username: 'alice',
        password: 'Password1!',
      },
    });

    expect(vaultService.listEntries()).toHaveLength(1);

    // Create backup container of current vault
    const backupContainer = vaultService.createBackup();

    // Now modify the vault: add a new item and delete the old one
    vaultService.saveEntry({
      type: 'login',
      title: 'New Service After Backup',
      payload: {
        type: 'login',
        title: 'New Service After Backup',
        username: 'bob',
        password: 'Password2!',
      },
    });

    expect(vaultService.listEntries()).toHaveLength(2);

    // Restore from the earlier backup container
    const comparison = await backupScheduler.restoreContainer(backupContainer, masterPassword);

    expect(comparison.localItemCount).toBe(2);
    expect(comparison.remoteItemCount).toBe(1);
    expect(comparison.isSameVault).toBe(true);

    // Check that the restored vault has exactly 1 entry matching the backup
    const currentEntries = vaultService.listEntries();
    expect(currentEntries).toHaveLength(1);
    expect(currentEntries[0].title).toBe('Original Service');

    // Verify that a safety snapshot was saved to disk
    const files = fs.readdirSync(tmpDir);
    const snapshotFiles = files.filter(f => f.startsWith('pre-restore-snapshot-'));
    expect(snapshotFiles.length).toBeGreaterThanOrEqual(1);

    // Verify snapshot file has non-zero size
    const snapshotPath = path.join(tmpDir, snapshotFiles[0]);
    const stat = fs.statSync(snapshotPath);
    expect(stat.size).toBeGreaterThan(0);
  });

  it('detects cross-vault restore and provides comparison metadata', async () => {
    const passwordA = 'VaultPasswordA1!';
    await vaultService.setupVault(passwordA);

    vaultService.saveEntry({
      type: 'login',
      title: 'Vault A Item',
      payload: {
        type: 'login',
        title: 'Vault A Item',
        username: 'alice',
        password: 'PasswordA!',
      },
    });

    const containerA = vaultService.createBackup();

    // Setup another vault on a second path
    const secondVaultPath = path.join(tmpDir, 'second-vault.db');
    const secondVault = new VaultService(secondVaultPath);
    await secondVault.initialize();
    const passwordB = 'VaultPasswordB2!';
    await secondVault.setupVault(passwordB);

    const secondScheduler = new BackupScheduler(secondVault, gdriveService);

    // Restore containerA into secondVault
    const comparison = await secondScheduler.restoreContainer(containerA, passwordA);

    expect(comparison.isSameVault).toBe(false);
    expect(comparison.remoteItemCount).toBe(1);

    const restoredEntries = secondVault.listEntries();
    expect(restoredEntries).toHaveLength(1);
    expect(restoredEntries[0].title).toBe('Vault A Item');

    secondScheduler.close();
    secondVault.close();
  });
});
