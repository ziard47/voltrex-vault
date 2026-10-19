import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { GoogleDriveService, DEFAULT_GOOGLE_CLIENT_ID } from '../src/main/services/gdrive-service';
import { BackupScheduler } from '../src/main/services/backup-scheduler';
import { VaultService } from '../src/main/services/vault-service';

describe('Google Drive & Backup Scheduler Service', () => {
  let tmpDir: string;
  let gdriveService: GoogleDriveService;
  let vaultService: VaultService;
  let scheduler: BackupScheduler;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'voltrex-gdrive-test-'));
    const dbPath = path.join(tmpDir, 'test-vault.db');
    vaultService = new VaultService(dbPath);
    await vaultService.initialize();

    gdriveService = new GoogleDriveService(tmpDir);
    scheduler = new BackupScheduler(vaultService, gdriveService);
  });

  afterEach(() => {
    scheduler.close();
    vaultService.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('initializes with default client ID and disconnected status', () => {
    expect(gdriveService.getClientId()).toBe(DEFAULT_GOOGLE_CLIENT_ID);
    expect(gdriveService.isConnected()).toBe(false);
    expect(gdriveService.getAccount()).toBeNull();

    const status = scheduler.getStatus();
    expect(status.isConnected).toBe(false);
    expect(status.account).toBeNull();
    expect(status.lastBackupStatus).toBe('idle');
  });

  it('updates client ID and scheduler configuration', () => {
    const customClientId = '12345-custom-client-id.apps.googleusercontent.com';
    const updatedStatus = scheduler.updateConfig({
      clientId: customClientId,
      isAutoBackupEnabled: true,
      intervalMinutes: 60,
      retentionCount: 15,
    });

    expect(gdriveService.getClientId()).toBe(customClientId);
    expect(updatedStatus.clientId).toBe(customClientId);
    expect(updatedStatus.isAutoBackupEnabled).toBe(true);
    expect(updatedStatus.intervalMinutes).toBe(60);
    expect(updatedStatus.retentionCount).toBe(15);
  });

  it('verifies RFC 7636 PKCE code challenge calculation', () => {
    // RFC 7636 Appendix B test vector
    // code_verifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
    // code_challenge: "E9Melhoa2OwvFrGMTJguCH5rtG647N4vLiflhRwYuk8"
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64url');

    expect(challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('rejects immediate manual backup when vault is locked', async () => {
    await expect(scheduler.backupNow()).rejects.toThrow(
      /vault is locked|master password must be provided/i
    );
  });

  it('rejects manual backup when Google Drive is not connected', async () => {
    await vaultService.setupVault('MasterPassword123!');
    await expect(scheduler.backupNow()).rejects.toThrow(
      /google drive is not connected/i
    );
  });
});
