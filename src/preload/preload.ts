/**
 * Voltrex Vault - Preload Script
 * Exposes a strictly typed, narrow, secure API via contextBridge.
 * Raw ipcRenderer, Node.js, Buffer, and filesystem access are NEVER exposed.
 */

import { contextBridge, ipcRenderer } from 'electron';
import {
  VaultEntry,
  VaultEntryPayload,
  VaultSettings,
  VaultStatus,
  PasswordGeneratorOptions,
  ExportData,
  EncryptedBackupContainer,
  GoogleDriveStatus,
  RemoteBackupFile,
  RestoreComparison,
  GeneratedPasswordResult,
} from '../shared/types';

async function invokeIpc<T>(channel: string, args?: unknown): Promise<T> {
  const response = await ipcRenderer.invoke(channel, args);
  if (!response || typeof response !== 'object') {
    throw new Error('Malformed IPC response received.');
  }
  if (!response.success) {
    throw new Error(response.error || 'Operation failed.');
  }
  return response.data as T;
}

export const vaultApi = {
  // Vault status and lifecycle
  getStatus: (): Promise<VaultStatus> => invokeIpc('vault:get-status'),
  setup: (masterPassword: string): Promise<void> => invokeIpc('vault:setup', { masterPassword }),
  unlock: (masterPassword: string): Promise<boolean> => invokeIpc('vault:unlock', { masterPassword }),
  lock: (): Promise<boolean> => invokeIpc('vault:lock'),
  changePassword: (currentPassword: string, newPassword: string): Promise<void> =>
    invokeIpc('vault:change-password', { currentPassword, newPassword }),

  // Settings
  getSettings: (): Promise<VaultSettings> => invokeIpc('vault:get-settings'),
  updateSettings: (settings: Partial<VaultSettings>): Promise<VaultSettings> =>
    invokeIpc('vault:update-settings', { settings }),

  // Entries CRUD
  listEntries: (includeTrashed?: boolean): Promise<VaultEntry[]> =>
    invokeIpc('vault:list-entries', { includeTrashed }),
  getEntry: (id: string): Promise<VaultEntry | null> => invokeIpc('vault:get-entry', { id }),
  saveEntry: (entry: {
    id?: string;
    type: VaultEntry['type'];
    title: string;
    isFavorite?: boolean;
    payload: VaultEntryPayload;
  }): Promise<VaultEntry> => invokeIpc('vault:save-entry', { entry }),
  toggleFavorite: (id: string): Promise<boolean> => invokeIpc('vault:toggle-favorite', { id }),
  deleteEntry: (id: string, permanent?: boolean): Promise<boolean> =>
    invokeIpc('vault:delete-entry', { id, permanent }),
  restoreEntry: (id: string): Promise<boolean> => invokeIpc('vault:restore-entry', { id }),

  // Import / Export
  exportVault: (masterPassword: string): Promise<ExportData> =>
    invokeIpc('vault:export', { masterPassword }),
  importVault: (data: unknown): Promise<{ importedCount: number }> =>
    invokeIpc('vault:import', { data }),

  // Security tools
  generatePassword: (options?: Partial<PasswordGeneratorOptions>): Promise<GeneratedPasswordResult> =>
    invokeIpc('vault:generate-password', { options }),
  copyToClipboard: (text: string, clearAfterSeconds?: number): Promise<boolean> =>
    invokeIpc('vault:copy-clipboard', { text, clearAfterSeconds }),

  // Window frame controls
  minimize: (): Promise<boolean> => invokeIpc('app:minimize'),
  maximize: (): Promise<boolean> => invokeIpc('app:maximize'),
  close: (): Promise<boolean> => invokeIpc('app:close'),

  // Google Drive & Encrypted Backups
  gdrive: {
    getStatus: (): Promise<GoogleDriveStatus> => invokeIpc('gdrive:get-status'),
    connect: (): Promise<GoogleDriveStatus> => invokeIpc('gdrive:connect'),
    disconnect: (): Promise<GoogleDriveStatus> => invokeIpc('gdrive:disconnect'),
    backupNow: (): Promise<void> => invokeIpc('gdrive:backup-now'),
    listBackups: (): Promise<RemoteBackupFile[]> => invokeIpc('gdrive:list-backups'),
    inspectBackup: (fileId: string): Promise<EncryptedBackupContainer> =>
      invokeIpc('gdrive:inspect-backup', { fileId }),
    restoreBackup: (fileId: string, masterPassword: string): Promise<RestoreComparison> =>
      invokeIpc('gdrive:restore-backup', { fileId, masterPassword }),
    updateConfig: (config: { isAutoBackupEnabled?: boolean; intervalMinutes?: number; retentionCount?: number; clientId?: string }): Promise<GoogleDriveStatus> =>
      invokeIpc('gdrive:update-config', { config }),
  },
  createBackupContainer: (): Promise<EncryptedBackupContainer> =>
    invokeIpc('backup:create-container'),
  restoreBackupContainer: (container: EncryptedBackupContainer, masterPassword: string): Promise<RestoreComparison> =>
    invokeIpc('backup:restore-container', { container, masterPassword }),
};

contextBridge.exposeInMainWorld('vaultApi', vaultApi);

export type VaultApi = typeof vaultApi;
