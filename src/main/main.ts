/**
 * Voltrex Vault - Electron Main Process Entry
 * Applies full security hardening, window lifecycle management, and IPC registration.
 */

import { app, BrowserWindow, session, powerMonitor, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { VaultService } from './services/vault-service';
import { ClipboardManager } from './clipboard/manager';
import { GoogleDriveService } from './services/gdrive-service';
import { BackupScheduler } from './services/backup-scheduler';
import { ExtensionBridgeServer } from './ipc/extension-bridge';
import { registerIpcHandlers } from './ipc/handlers';

let mainWindow: BrowserWindow | null = null;
let vaultService: VaultService | null = null;
let clipboardManager: ClipboardManager | null = null;
let gdriveService: GoogleDriveService | null = null;
let backupScheduler: BackupScheduler | null = null;
let extensionBridge: ExtensionBridgeServer | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
app.name = 'voltrex-vault';

async function createWindow(): Promise<void> {
  const userDataPath = app.getPath('userData');
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true, mode: 0o700 });
  }

  const dbPath = path.join(userDataPath, 'voltrex_vault.db');
  vaultService = new VaultService(dbPath);
  await vaultService.initialize();

  clipboardManager = new ClipboardManager();
  gdriveService = new GoogleDriveService(userDataPath);
  backupScheduler = new BackupScheduler(vaultService, gdriveService);

  extensionBridge = new ExtensionBridgeServer(vaultService, userDataPath);
  await extensionBridge.start();

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    frame: false, // Custom styled title bar adhering to desktop palette
    backgroundColor: '#000000',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false,
    },
  });

  registerIpcHandlers(vaultService, clipboardManager, gdriveService, backupScheduler, () => mainWindow);

  // Security: Deny all permissions unconditionally
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  // Security: Prevent all unexpected in-app navigation
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    try {
      const parsedUrl = new URL(navigationUrl);
      const isAllowedOrigin =
        parsedUrl.origin === 'http://localhost:5183' ||
        parsedUrl.origin === 'http://localhost:5173' ||
        parsedUrl.protocol === 'file:';
      if (!isAllowedOrigin) {
        event.preventDefault();
      }
    } catch {
      event.preventDefault();
    }
  });

  // Security: Deny window.open popups
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // If the user clicks a valid website URL in an entry, open it securely in their OS default browser
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url).catch(() => {});
    }
    return { action: 'deny' };
  });

  // Display when ready to avoid visual flash
  mainWindow.once('ready-to-show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
    }
  });

  mainWindow.webContents.on('did-finish-load', () => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error(`[Electron] Failed to load UI: ${errorDescription} (${errorCode})`);
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Lock vault when system lock screen is triggered
  powerMonitor.on('lock-screen', () => {
    if (vaultService) {
      vaultService.lockVault();
    }
  });

  // Load URL or File
  const prodIndexPath = path.join(__dirname, '../../renderer/index.html');
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
  } else if (fs.existsSync(prodIndexPath)) {
    await mainWindow.loadFile(prodIndexPath);
  } else {
    try {
      await mainWindow.loadURL('http://localhost:5183');
    } catch {
      await mainWindow.loadFile(prodIndexPath);
    }
  }
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(createWindow);

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  app.on('before-quit', () => {
    if (extensionBridge) {
      extensionBridge.close();
      extensionBridge = null;
    }
    if (backupScheduler) {
      backupScheduler.close();
      backupScheduler = null;
    }
    if (vaultService) {
      vaultService.close();
      vaultService = null;
    }
    if (clipboardManager) {
      clipboardManager.clearNow();
      clipboardManager = null;
    }
    gdriveService = null;
  });
}
