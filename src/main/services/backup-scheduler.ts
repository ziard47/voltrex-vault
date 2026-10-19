/**
 * Voltrex Vault - Backup Scheduler & Conflict Manager
 * Manages debounced change-triggered backups, periodic intervals, network retries,
 * and safe atomic restoration with conflict comparisons.
 */

import { VaultService } from './vault-service';
import { GoogleDriveService } from './gdrive-service';
import {
  GoogleDriveStatus,
  RemoteBackupFile,
  RestoreComparison,
  EncryptedBackupContainer,
} from '../../shared/types';
import {
  inspectBackupContainer,
  decryptAndValidateBackup,
  ContainerInspectionSummary,
} from '../backup/container';

export class BackupScheduler {
  private vaultService: VaultService;
  private gdriveService: GoogleDriveService;

  private isAutoBackupEnabled = false;
  private intervalMinutes = 60;
  private retentionCount = 5;
  private lastBackupAt: number | null = null;
  private lastBackupStatus: 'idle' | 'in_progress' | 'success' | 'error' = 'idle';
  private lastError: string | null = null;

  private isBackupInProgress = false;
  private isRestoring = false;
  private debounceTimer: NodeJS.Timeout | null = null;
  private intervalTimer: NodeJS.Timeout | null = null;

  constructor(vaultService: VaultService, gdriveService: GoogleDriveService) {
    this.vaultService = vaultService;
    this.gdriveService = gdriveService;

    this.loadSettings();

    // Listen to vault changes to schedule debounced backup
    this.vaultService.onVaultChanged(() => {
      this.handleVaultChanged();
    });

    this.restartIntervalTimer();
  }

  private loadSettings(): void {
    const settings = this.vaultService.getSettings();
    this.isAutoBackupEnabled = Boolean(settings.gdriveAutoBackupEnabled);
    this.intervalMinutes = settings.gdriveIntervalMinutes || 60;
    this.retentionCount = settings.gdriveRetentionCount || 5;
  }

  public getStatus(): GoogleDriveStatus {
    return {
      isConnected: this.gdriveService.isConnected(),
      account: this.gdriveService.getAccount(),
      clientId: this.gdriveService.getClientId(),
      isAutoBackupEnabled: this.isAutoBackupEnabled,
      intervalMinutes: this.intervalMinutes,
      retentionCount: this.retentionCount,
      lastBackupAt: this.lastBackupAt,
      lastBackupStatus: this.lastBackupStatus,
      lastError: this.lastError,
    };
  }

  public updateConfig(config: {
    isAutoBackupEnabled?: boolean;
    intervalMinutes?: number;
    retentionCount?: number;
    clientId?: string;
  }): GoogleDriveStatus {
    if (config.clientId !== undefined) {
      this.gdriveService.setClientId(config.clientId);
    }
    if (config.isAutoBackupEnabled !== undefined) {
      this.isAutoBackupEnabled = config.isAutoBackupEnabled;
    }
    if (config.intervalMinutes !== undefined && config.intervalMinutes >= 15) {
      this.intervalMinutes = config.intervalMinutes;
    }
    if (config.retentionCount !== undefined && config.retentionCount >= 1) {
      this.retentionCount = config.retentionCount;
    }

    // Persist to vault settings
    this.vaultService.updateSettings({
      gdriveClientId: this.gdriveService.getClientId(),
      gdriveAutoBackupEnabled: this.isAutoBackupEnabled,
      gdriveIntervalMinutes: this.intervalMinutes,
      gdriveRetentionCount: this.retentionCount,
    });

    this.restartIntervalTimer();
    return this.getStatus();
  }

  private restartIntervalTimer(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }

    if (this.isAutoBackupEnabled && this.intervalMinutes > 0) {
      const intervalMs = this.intervalMinutes * 60 * 1000;
      this.intervalTimer = setInterval(() => {
        this.performAutoBackup('periodic');
      }, intervalMs);
    }
  }

  private handleVaultChanged(): void {
    if (!this.isAutoBackupEnabled || this.isRestoring) return;
    if (!this.gdriveService.isConnected()) return;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Debounce backup by 20 seconds after local changes
    this.debounceTimer = setTimeout(() => {
      this.performAutoBackup('change_debounce');
    }, 20000);
  }

  private async performAutoBackup(_reason: string): Promise<void> {
    if (!this.isAutoBackupEnabled || this.isBackupInProgress || this.isRestoring) return;
    if (!this.vaultService.getStatus().isUnlocked) return;
    if (!this.gdriveService.isConnected()) return;

    try {
      await this.backupNow();
    } catch (err) {
      console.warn('[BackupScheduler] Auto-backup failed:', (err as Error).message);
    }
  }

  /**
   * Executes a backup immediately with bounded exponential backoff retry and jitter.
   */
  public async backupNow(): Promise<{ fileId: string; name: string }> {
    const vaultStatus = this.vaultService.getStatus();
    if (!vaultStatus.isUnlocked) {
      throw new Error('Vault is locked. Master password must be provided to create an encrypted backup.');
    }
    if (!this.gdriveService.isConnected()) {
      throw new Error('Google Drive is not connected. Connect your Google account first.');
    }
    if (this.isBackupInProgress) {
      throw new Error('A backup operation is already in progress.');
    }

    this.isBackupInProgress = true;
    this.lastBackupStatus = 'in_progress';
    this.lastError = null;

    try {
      // 1. Generate encrypted backup container
      const container = this.vaultService.createBackup();

      // 2. Upload with retry logic
      const result = await this.uploadWithRetry(container, 3);

      // 3. Prune older backups beyond retention limit (preserves latest good backup)
      try {
        await this.gdriveService.pruneOldBackups(this.retentionCount);
      } catch (pruneErr) {
        console.warn('[BackupScheduler] Failed to prune old backups:', pruneErr);
      }

      this.lastBackupAt = Date.now();
      this.lastBackupStatus = 'success';
      this.lastError = null;

      return result;
    } catch (err: any) {
      this.lastBackupStatus = 'error';
      this.lastError = err.message || 'Backup failed.';
      throw err;
    } finally {
      this.isBackupInProgress = false;
    }
  }

  private async uploadWithRetry(
    container: EncryptedBackupContainer,
    maxRetries = 3
  ): Promise<{ fileId: string; name: string }> {
    let attempt = 0;
    while (attempt < maxRetries) {
      attempt++;
      try {
        return await this.gdriveService.uploadBackup(container);
      } catch (err) {
        if (attempt >= maxRetries) {
          throw err;
        }
        // Exponential backoff with random jitter (e.g. 1s, 2s, 4s + jitter)
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
        await new Promise(r => setTimeout(r, delay));
      }
    }
    throw new Error('Exceeded maximum backup retry attempts.');
  }

  public async listRemoteBackups(): Promise<RemoteBackupFile[]> {
    if (!this.gdriveService.isConnected()) {
      throw new Error('Google Drive is not connected.');
    }
    return await this.gdriveService.listBackups();
  }

  /**
   * Inspects a remote backup file before downloading or restoring.
   */
  public async inspectRemoteBackup(fileId: string): Promise<{
    inspection: ContainerInspectionSummary;
    isSameVault: boolean;
    localItemCount: number;
  }> {
    const container = await this.gdriveService.downloadBackup(fileId);
    const inspection = inspectBackupContainer(container);
    const localStatus = this.vaultService.getStatus();

    return {
      inspection,
      isSameVault: inspection.vaultId === localStatus.vaultId,
      localItemCount: localStatus.itemCount,
    };
  }

  /**
   * Downloads, validates, and restores a remote backup with atomic safety rollback.
   */
  public async restoreRemoteBackup(
    fileId: string,
    masterPassword: string
  ): Promise<RestoreComparison> {
    if (this.isBackupInProgress) {
      throw new Error('Cannot restore while a backup operation is in progress.');
    }

    const container = await this.gdriveService.downloadBackup(fileId);
    return await this.restoreContainer(container, masterPassword);
  }

  /**
   * Restores an encrypted container directly with conflict comparison.
   */
  public async restoreContainer(
    container: EncryptedBackupContainer,
    masterPassword: string
  ): Promise<RestoreComparison> {
    const localStatus = this.vaultService.getStatus();
    const localMeta = this.vaultService.getRepository().getMetadata();

    // 1. Decrypt and authenticate the container
    const decrypted = await decryptAndValidateBackup(container, masterPassword);

    const isSameVault = decrypted.vaultId === localMeta?.vaultId;
    const comparison: RestoreComparison = {
      localVaultId: localMeta?.vaultId || 'uninitialized',
      localItemCount: localStatus.itemCount,
      localLastModified: localMeta?.updatedAt || Date.now(),
      remoteVaultId: decrypted.vaultId,
      remoteBackupId: decrypted.backupId,
      remoteItemCount: decrypted.entries.length,
      remoteCreatedAt: decrypted.createdAt,
      isSameVault,
    };

    // 2. Commit restoration with loop suppression
    this.isRestoring = true;
    try {
      this.vaultService.restoreFromDecryptedBackup(decrypted);
      this.lastBackupStatus = 'idle';
      return comparison;
    } finally {
      this.isRestoring = false;
    }
  }

  public close(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.intervalTimer) clearInterval(this.intervalTimer);
  }
}
