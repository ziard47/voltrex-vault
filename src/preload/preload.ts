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
  RestoreComparison,
  GeneratedPasswordResult,
  UpdateCheckResult,
  DownloadProgress,
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

  // Encrypted Backup Containers (.voltrex)
  createBackupContainer: (): Promise<EncryptedBackupContainer> =>
    invokeIpc('backup:create-container'),
  restoreBackupContainer: (container: EncryptedBackupContainer, masterPassword: string): Promise<RestoreComparison> =>
    invokeIpc('backup:restore-container', { container, masterPassword }),

  // GitHub Releases Updates
  updates: {
    check: (): Promise<UpdateCheckResult> => invokeIpc('update:check'),
    openReleasePage: (url?: string): Promise<boolean> =>
      invokeIpc('update:open-release-page', { url }),
    download: (downloadUrl: string, assetName: string): Promise<{ savedFilePath: string }> =>
      invokeIpc('update:download', { downloadUrl, assetName }),
    openFile: (filePath: string): Promise<boolean> =>
      invokeIpc('update:open-file', { filePath }),
    showInFolder: (filePath: string): Promise<boolean> =>
      invokeIpc('update:show-in-folder', { filePath }),
    onProgress: (callback: (progress: DownloadProgress) => void): (() => void) => {
      const listener = (_event: any, progress: DownloadProgress) => {
        callback(progress);
      };
      ipcRenderer.on('update:download-progress', listener);
      return () => {
        ipcRenderer.removeListener('update:download-progress', listener);
      };
    },
  },
};

contextBridge.exposeInMainWorld('vaultApi', vaultApi);

export type VaultApi = typeof vaultApi;
