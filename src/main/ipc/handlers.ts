/**
 * Voltrex Vault - Narrow, Validated IPC Handlers
 * Validates frame context, input schemas, and enforces strict boundary isolation.
 */

import { ipcMain, BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { VaultService } from '../services/vault-service';
import { ClipboardManager } from '../clipboard/manager';
import { GoogleDriveService } from '../services/gdrive-service';
import { BackupScheduler } from '../services/backup-scheduler';
import { generateSecurePassword } from '../crypto/generator';
import {
  VaultEntryPayload,
  VaultSettings,
  PasswordGeneratorOptions,
  EntryType,
} from '../../shared/types';
import {
  validateString,
  validatePayload,
  validateSettings,
  validatePartialSettings,
  validatePasswordGeneratorOptions,
  validateExportData,
  ValidationError,
} from '../../shared/validation';

export function registerIpcHandlers(
  vaultService: VaultService,
  clipboardManager: ClipboardManager,
  gdriveService: GoogleDriveService,
  backupScheduler: BackupScheduler,
  getMainWindow: () => BrowserWindow | null
): void {
  function verifySender(event: IpcMainInvokeEvent): void {
    const mainWindow = getMainWindow();
    if (!mainWindow || !mainWindow.webContents) {
      throw new Error('IPC invocation rejected: main window unavailable.');
    }
    if (event.senderFrame !== mainWindow.webContents.mainFrame) {
      throw new Error('IPC invocation rejected: untrusted frame origin.');
    }
  }

  function handle<T, R>(channel: string, handler: (event: IpcMainInvokeEvent, args: T) => Promise<R> | R): void {
    ipcMain.handle(channel, async (event, args: T) => {
      try {
        verifySender(event);
        const data = await handler(event, args);
        return { success: true, data };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
        // Log safe message without any secrets
        console.error(`[IPC Error] Channel '${channel}': ${message}`);
        return { success: false, error: message };
      }
    });
  }

  // --- Status & Lifecycle ---
  handle('vault:get-status', () => {
    return vaultService.getStatus();
  });

  handle('vault:setup', (_event, { masterPassword }: { masterPassword: unknown }) => {
    const pwd = validateString(masterPassword, 'masterPassword', 8, 500);
    return vaultService.setupVault(pwd);
  });

  handle('vault:unlock', async (_event, { masterPassword }: { masterPassword: unknown }) => {
    const pwd = validateString(masterPassword, 'masterPassword', 1, 500);
    return await vaultService.unlockVault(pwd);
  });

  handle('vault:lock', () => {
    vaultService.lockVault();
    return true;
  });

  handle('vault:change-password', async (_event, { currentPassword, newPassword }: { currentPassword: unknown; newPassword: unknown }) => {
    const curr = validateString(currentPassword, 'currentPassword', 1, 500);
    const next = validateString(newPassword, 'newPassword', 8, 500);
    return await vaultService.changeMasterPassword(curr, next);
  });

  // --- Settings ---
  handle('vault:get-settings', () => {
    return vaultService.getSettings();
  });

  handle('vault:update-settings', (_event, { settings }: { settings: unknown }) => {
    const validated = validatePartialSettings(settings);
    return vaultService.updateSettings(validated);
  });

  // --- Entries CRUD ---
  handle('vault:list-entries', (_event, { includeTrashed }: { includeTrashed?: unknown }) => {
    return vaultService.listEntries(Boolean(includeTrashed));
  });

  handle('vault:get-entry', (_event, { id }: { id: unknown }) => {
    const entryId = validateString(id, 'id', 1, 100);
    return vaultService.getEntry(entryId);
  });

  handle('vault:save-entry', (_event, { entry }: { entry: unknown }) => {
    if (!entry || typeof entry !== 'object') {
      throw new ValidationError('Invalid entry format.');
    }
    const e = entry as Record<string, unknown>;
    const payload = validatePayload(e.payload);
    const id = e.id ? validateString(e.id, 'id', 1, 100) : undefined;
    const title = validateString(e.title ?? payload.title, 'title', 1, 200);
    const isFavorite = Boolean(e.isFavorite);

    return vaultService.saveEntry({
      id,
      type: payload.type,
      title,
      isFavorite,
      payload,
    });
  });

  handle('vault:toggle-favorite', (_event, { id }: { id: unknown }) => {
    const entryId = validateString(id, 'id', 1, 100);
    return vaultService.toggleFavorite(entryId);
  });

  handle('vault:delete-entry', (_event, { id, permanent }: { id: unknown; permanent?: unknown }) => {
    const entryId = validateString(id, 'id', 1, 100);
    if (Boolean(permanent)) {
      vaultService.permanentDeleteEntry(entryId);
    } else {
      vaultService.softDeleteEntry(entryId);
    }
    return true;
  });

  handle('vault:restore-entry', (_event, { id }: { id: unknown }) => {
    const entryId = validateString(id, 'id', 1, 100);
    vaultService.restoreEntry(entryId);
    return true;
  });

  // --- Export / Import ---
  handle('vault:export', async (_event, { masterPassword }: { masterPassword: unknown }) => {
    const pwd = validateString(masterPassword, 'masterPassword', 1, 500);
    return await vaultService.exportVault(pwd);
  });

  handle('vault:import', (_event, { data }: { data: unknown }) => {
    const validated = validateExportData(data);
    return vaultService.importVault(validated);
  });

  // --- Generator & Clipboard ---
  handle('vault:generate-password', (_event, { options }: { options?: unknown }) => {
    const validatedOptions = options ? validatePasswordGeneratorOptions(options) : undefined;
    return generateSecurePassword(validatedOptions);
  });

  handle('vault:copy-clipboard', (_event, { text, clearAfterSeconds }: { text: unknown; clearAfterSeconds?: unknown }) => {
    const str = validateString(text, 'text', 0, 50000);
    const sec = typeof clearAfterSeconds === 'number' ? Math.max(0, clearAfterSeconds) : 30;
    clipboardManager.copyWithAutoClear(str, sec);
    return true;
  });

  // --- Google Drive & Encrypted Backup ---
  handle('gdrive:get-status', () => {
    return backupScheduler.getStatus();
  });

  handle('gdrive:connect', async () => {
    return await gdriveService.connect();
  });

  handle('gdrive:disconnect', async () => {
    await gdriveService.disconnect();
    return backupScheduler.getStatus();
  });

  handle('gdrive:backup-now', async () => {
    return await backupScheduler.backupNow();
  });

  handle('gdrive:list-backups', async () => {
    return await backupScheduler.listRemoteBackups();
  });

  handle('gdrive:inspect-backup', async (_event, { fileId }: { fileId: unknown }) => {
    const id = validateString(fileId, 'fileId', 1, 200);
    return await backupScheduler.inspectRemoteBackup(id);
  });

  handle('gdrive:restore-backup', async (_event, { fileId, masterPassword }: { fileId: unknown; masterPassword: unknown }) => {
    const id = validateString(fileId, 'fileId', 1, 200);
    const pwd = validateString(masterPassword, 'masterPassword', 1, 500);
    return await backupScheduler.restoreRemoteBackup(id, pwd);
  });

  handle('gdrive:update-config', (_event, { config }: { config: unknown }) => {
    if (!config || typeof config !== 'object') {
      throw new ValidationError('Config must be an object.');
    }
    return backupScheduler.updateConfig(config as any);
  });

  handle('backup:create-container', () => {
    return vaultService.createBackup();
  });

  handle('backup:restore-container', async (_event, { container, masterPassword }: { container: unknown; masterPassword: unknown }) => {
    const pwd = validateString(masterPassword, 'masterPassword', 1, 500);
    return await backupScheduler.restoreContainer(container as any, pwd);
  });

  // --- Window Controls ---
  handle('app:minimize', () => {
    const win = getMainWindow();
    if (win) win.minimize();
    return true;
  });

  handle('app:maximize', () => {
    const win = getMainWindow();
    if (win) {
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
    }
    return true;
  });

  handle('app:close', () => {
    const win = getMainWindow();
    if (win) win.close();
    return true;
  });
}
