"use strict";
/**
 * Voltrex Vault - Preload Script
 * Exposes a strictly typed, narrow, secure API via contextBridge.
 * Raw ipcRenderer, Node.js, Buffer, and filesystem access are NEVER exposed.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.vaultApi = void 0;
const electron_1 = require("electron");
async function invokeIpc(channel, args) {
    const response = await electron_1.ipcRenderer.invoke(channel, args);
    if (!response || typeof response !== 'object') {
        throw new Error('Malformed IPC response received.');
    }
    if (!response.success) {
        throw new Error(response.error || 'Operation failed.');
    }
    return response.data;
}
exports.vaultApi = {
    // Vault status and lifecycle
    getStatus: () => invokeIpc('vault:get-status'),
    setup: (masterPassword) => invokeIpc('vault:setup', { masterPassword }),
    unlock: (masterPassword) => invokeIpc('vault:unlock', { masterPassword }),
    lock: () => invokeIpc('vault:lock'),
    changePassword: (currentPassword, newPassword) => invokeIpc('vault:change-password', { currentPassword, newPassword }),
    // Settings
    getSettings: () => invokeIpc('vault:get-settings'),
    updateSettings: (settings) => invokeIpc('vault:update-settings', { settings }),
    // Entries CRUD
    listEntries: (includeTrashed) => invokeIpc('vault:list-entries', { includeTrashed }),
    getEntry: (id) => invokeIpc('vault:get-entry', { id }),
    saveEntry: (entry) => invokeIpc('vault:save-entry', { entry }),
    toggleFavorite: (id) => invokeIpc('vault:toggle-favorite', { id }),
    deleteEntry: (id, permanent) => invokeIpc('vault:delete-entry', { id, permanent }),
    restoreEntry: (id) => invokeIpc('vault:restore-entry', { id }),
    // Import / Export
    exportVault: (masterPassword) => invokeIpc('vault:export', { masterPassword }),
    importVault: (data) => invokeIpc('vault:import', { data }),
    // Security tools
    generatePassword: (options) => invokeIpc('vault:generate-password', { options }),
    copyToClipboard: (text, clearAfterSeconds) => invokeIpc('vault:copy-clipboard', { text, clearAfterSeconds }),
    // Window frame controls
    minimize: () => invokeIpc('app:minimize'),
    maximize: () => invokeIpc('app:maximize'),
    close: () => invokeIpc('app:close'),
    // Google Drive & Encrypted Backups
    gdrive: {
        getStatus: () => invokeIpc('gdrive:get-status'),
        connect: () => invokeIpc('gdrive:connect'),
        disconnect: () => invokeIpc('gdrive:disconnect'),
        backupNow: () => invokeIpc('gdrive:backup-now'),
        listBackups: () => invokeIpc('gdrive:list-backups'),
        inspectBackup: (fileId) => invokeIpc('gdrive:inspect-backup', { fileId }),
        restoreBackup: (fileId, masterPassword) => invokeIpc('gdrive:restore-backup', { fileId, masterPassword }),
        updateConfig: (config) => invokeIpc('gdrive:update-config', { config }),
    },
    createBackupContainer: () => invokeIpc('backup:create-container'),
    restoreBackupContainer: (container, masterPassword) => invokeIpc('backup:restore-container', { container, masterPassword }),
};
electron_1.contextBridge.exposeInMainWorld('vaultApi', exports.vaultApi);
