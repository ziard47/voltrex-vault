"use strict";
/**
 * Voltrex Vault - Electron Main Process Entry
 * Applies full security hardening, window lifecycle management, and IPC registration.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const vault_service_1 = require("./services/vault-service");
const manager_1 = require("./clipboard/manager");
const gdrive_service_1 = require("./services/gdrive-service");
const backup_scheduler_1 = require("./services/backup-scheduler");
const handlers_1 = require("./ipc/handlers");
let mainWindow = null;
let vaultService = null;
let clipboardManager = null;
let gdriveService = null;
let backupScheduler = null;
const isDev = process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged;
async function createWindow() {
    const userDataPath = electron_1.app.getPath('userData');
    if (!node_fs_1.default.existsSync(userDataPath)) {
        node_fs_1.default.mkdirSync(userDataPath, { recursive: true, mode: 0o700 });
    }
    const dbPath = node_path_1.default.join(userDataPath, 'voltrex_vault.db');
    vaultService = new vault_service_1.VaultService(dbPath);
    await vaultService.initialize();
    clipboardManager = new manager_1.ClipboardManager();
    gdriveService = new gdrive_service_1.GoogleDriveService(userDataPath);
    backupScheduler = new backup_scheduler_1.BackupScheduler(vaultService, gdriveService);
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 960,
        minHeight: 640,
        frame: false, // Custom styled title bar adhering to desktop palette
        backgroundColor: '#000000',
        show: false,
        webPreferences: {
            preload: node_path_1.default.join(__dirname, '../preload/preload.js'),
            contextIsolation: true,
            sandbox: true,
            nodeIntegration: false,
            webSecurity: true,
            allowRunningInsecureContent: false,
            spellcheck: false,
        },
    });
    (0, handlers_1.registerIpcHandlers)(vaultService, clipboardManager, gdriveService, backupScheduler, () => mainWindow);
    // Security: Deny all permissions unconditionally
    electron_1.session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
        callback(false);
    });
    // Security: Prevent all unexpected in-app navigation
    mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
        try {
            const parsedUrl = new URL(navigationUrl);
            const isAllowedOrigin = parsedUrl.origin === 'http://localhost:5183' ||
                parsedUrl.origin === 'http://localhost:5173' ||
                parsedUrl.protocol === 'file:';
            if (!isAllowedOrigin) {
                event.preventDefault();
            }
        }
        catch {
            event.preventDefault();
        }
    });
    // Security: Deny window.open popups
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        // If the user clicks a valid website URL in an entry, open it securely in their OS default browser
        if (url.startsWith('https://') || url.startsWith('http://')) {
            electron_1.shell.openExternal(url).catch(() => { });
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
    electron_1.powerMonitor.on('lock-screen', () => {
        if (vaultService) {
            vaultService.lockVault();
        }
    });
    // Load URL or File
    const prodIndexPath = node_path_1.default.join(__dirname, '../../renderer/index.html');
    const devServerUrl = process.env.VITE_DEV_SERVER_URL;
    if (devServerUrl) {
        await mainWindow.loadURL(devServerUrl);
    }
    else if (node_fs_1.default.existsSync(prodIndexPath)) {
        await mainWindow.loadFile(prodIndexPath);
    }
    else {
        try {
            await mainWindow.loadURL('http://localhost:5183');
        }
        catch {
            await mainWindow.loadFile(prodIndexPath);
        }
    }
}
// Single instance lock
const gotTheLock = electron_1.app.requestSingleInstanceLock();
if (!gotTheLock) {
    electron_1.app.quit();
}
else {
    electron_1.app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized())
                mainWindow.restore();
            mainWindow.focus();
        }
    });
    electron_1.app.whenReady().then(createWindow);
    electron_1.app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            electron_1.app.quit();
        }
    });
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
    electron_1.app.on('before-quit', () => {
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
