"use strict";
/**
 * Voltrex Vault - Backup Scheduler & Conflict Manager
 * Manages debounced change-triggered backups, periodic intervals, network retries,
 * and safe atomic restoration with conflict comparisons.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupScheduler = void 0;
const container_1 = require("../backup/container");
class BackupScheduler {
    vaultService;
    gdriveService;
    isAutoBackupEnabled = false;
    intervalMinutes = 60;
    retentionCount = 5;
    lastBackupAt = null;
    lastBackupStatus = 'idle';
    lastError = null;
    isBackupInProgress = false;
    isRestoring = false;
    debounceTimer = null;
    intervalTimer = null;
    constructor(vaultService, gdriveService) {
        this.vaultService = vaultService;
        this.gdriveService = gdriveService;
        this.loadSettings();
        // Listen to vault changes to schedule debounced backup
        this.vaultService.onVaultChanged(() => {
            this.handleVaultChanged();
        });
        this.restartIntervalTimer();
    }
    loadSettings() {
        const settings = this.vaultService.getSettings();
        this.isAutoBackupEnabled = Boolean(settings.gdriveAutoBackupEnabled);
        this.intervalMinutes = settings.gdriveIntervalMinutes || 60;
        this.retentionCount = settings.gdriveRetentionCount || 5;
    }
    getStatus() {
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
    updateConfig(config) {
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
    restartIntervalTimer() {
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
    handleVaultChanged() {
        if (!this.isAutoBackupEnabled || this.isRestoring)
            return;
        if (!this.gdriveService.isConnected())
            return;
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        // Debounce backup by 20 seconds after local changes
        this.debounceTimer = setTimeout(() => {
            this.performAutoBackup('change_debounce');
        }, 20000);
    }
    async performAutoBackup(_reason) {
        if (!this.isAutoBackupEnabled || this.isBackupInProgress || this.isRestoring)
            return;
        if (!this.vaultService.getStatus().isUnlocked)
            return;
        if (!this.gdriveService.isConnected())
            return;
        try {
            await this.backupNow();
        }
        catch (err) {
            console.warn('[BackupScheduler] Auto-backup failed:', err.message);
        }
    }
    /**
     * Executes a backup immediately with bounded exponential backoff retry and jitter.
     */
    async backupNow() {
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
            }
            catch (pruneErr) {
                console.warn('[BackupScheduler] Failed to prune old backups:', pruneErr);
            }
            this.lastBackupAt = Date.now();
            this.lastBackupStatus = 'success';
            this.lastError = null;
            return result;
        }
        catch (err) {
            this.lastBackupStatus = 'error';
            this.lastError = err.message || 'Backup failed.';
            throw err;
        }
        finally {
            this.isBackupInProgress = false;
        }
    }
    async uploadWithRetry(container, maxRetries = 3) {
        let attempt = 0;
        while (attempt < maxRetries) {
            attempt++;
            try {
                return await this.gdriveService.uploadBackup(container);
            }
            catch (err) {
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
    async listRemoteBackups() {
        if (!this.gdriveService.isConnected()) {
            throw new Error('Google Drive is not connected.');
        }
        return await this.gdriveService.listBackups();
    }
    /**
     * Inspects a remote backup file before downloading or restoring.
     */
    async inspectRemoteBackup(fileId) {
        const container = await this.gdriveService.downloadBackup(fileId);
        const inspection = (0, container_1.inspectBackupContainer)(container);
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
    async restoreRemoteBackup(fileId, masterPassword) {
        if (this.isBackupInProgress) {
            throw new Error('Cannot restore while a backup operation is in progress.');
        }
        const container = await this.gdriveService.downloadBackup(fileId);
        return await this.restoreContainer(container, masterPassword);
    }
    /**
     * Restores an encrypted container directly with conflict comparison.
     */
    async restoreContainer(container, masterPassword) {
        const localStatus = this.vaultService.getStatus();
        const localMeta = this.vaultService.getRepository().getMetadata();
        // 1. Decrypt and authenticate the container
        const decrypted = await (0, container_1.decryptAndValidateBackup)(container, masterPassword);
        const isSameVault = decrypted.vaultId === localMeta?.vaultId;
        const comparison = {
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
        }
        finally {
            this.isRestoring = false;
        }
    }
    close() {
        if (this.debounceTimer)
            clearTimeout(this.debounceTimer);
        if (this.intervalTimer)
            clearInterval(this.intervalTimer);
    }
}
exports.BackupScheduler = BackupScheduler;
