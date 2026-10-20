/**
 * Voltrex Vault - Central Application Context
 * Handles state, IPC operations, category filters, real-time search, and inactivity auto-lock.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  VaultEntry,
  VaultEntryPayload,
  VaultSettings,
  VaultStatus,
  EntryType,
  ExportData,
  GoogleDriveStatus,
  RemoteBackupFile,
  RestoreComparison,
  EncryptedBackupContainer,
  GeneratedPasswordResult,
} from '../../shared/types';

export type CategoryFilter = 'all' | EntryType | 'favorites' | 'trash';

interface ToastNotification {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface RestoreTarget {
  fileId?: string;
  container?: EncryptedBackupContainer;
  fileName: string;
  sizeBytes?: number;
}

interface VaultContextType {
  status: VaultStatus;
  entries: VaultEntry[];
  filteredEntries: VaultEntry[];
  selectedEntry: VaultEntry | null;
  activeCategory: CategoryFilter;
  searchQuery: string;
  settings: VaultSettings;
  isLoading: boolean;
  toasts: ToastNotification[];

  // Google Drive & Backups state
  gdriveStatus: GoogleDriveStatus;
  remoteBackups: RemoteBackupFile[];
  isGDriveLoading: boolean;

  // Modal triggers
  isEntryModalOpen: boolean;
  editingEntry: VaultEntry | null;
  defaultNewType: EntryType;
  isGeneratorOpen: boolean;
  isSettingsOpen: boolean;
  restoreTarget: RestoreTarget | null;

  // Actions
  refreshStatus: () => Promise<void>;
  setupVault: (masterPassword: string) => Promise<void>;
  unlockVault: (masterPassword: string) => Promise<boolean>;
  lockVault: () => Promise<void>;
  changeMasterPassword: (curr: string, next: string) => Promise<void>;
  loadEntries: () => Promise<void>;
  selectEntry: (entry: VaultEntry | null) => void;
  setActiveCategory: (cat: CategoryFilter) => void;
  setSearchQuery: (query: string) => void;
  saveEntry: (data: { id?: string; type: EntryType; title: string; isFavorite?: boolean; payload: VaultEntryPayload }) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  deleteEntry: (id: string, permanent?: boolean) => Promise<void>;
  restoreEntry: (id: string) => Promise<void>;
  exportVault: (masterPassword: string) => Promise<ExportData>;
  importVault: (data: unknown) => Promise<number>;
  generatePassword: (options?: unknown) => Promise<GeneratedPasswordResult>;
  copyToClipboard: (text: string, label?: string) => Promise<void>;
  updateSettings: (newSettings: Partial<VaultSettings>) => Promise<void>;

  // Google Drive & Backup actions
  refreshGDriveStatus: () => Promise<void>;
  connectGDrive: () => Promise<void>;
  disconnectGDrive: () => Promise<void>;
  backupNowGDrive: () => Promise<void>;
  loadRemoteBackups: () => Promise<RemoteBackupFile[]>;
  inspectRemoteBackup: (fileId: string) => Promise<EncryptedBackupContainer>;
  restoreRemoteBackup: (fileId: string, masterPassword: string) => Promise<RestoreComparison>;
  createEncryptedBackup: () => Promise<EncryptedBackupContainer>;
  restoreEncryptedBackup: (container: EncryptedBackupContainer, masterPassword: string) => Promise<RestoreComparison>;
  updateGDriveConfig: (config: { isAutoBackupEnabled?: boolean; intervalMinutes?: number; retentionCount?: number; clientId?: string }) => Promise<void>;

  // Modal controls
  openCreateModal: (type?: EntryType) => void;
  openEditModal: (entry: VaultEntry) => void;
  closeEntryModal: () => void;
  openGenerator: () => void;
  closeGenerator: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  openRestoreModal: (target: RestoreTarget) => void;
  closeRestoreModal: () => void;
  dismissToast: (id: string) => void;
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

export const VaultProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<VaultStatus>({ isInitialized: false, isUnlocked: false, itemCount: 0 });
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<VaultEntry | null>(null);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [settings, setSettings] = useState<VaultSettings>({ autoLockMinutes: 15, clipboardClearSeconds: 30 });
  const [isLoading, setIsLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  // Google Drive & Backup State
  const [gdriveStatus, setGdriveStatus] = useState<GoogleDriveStatus>({
    isConnected: false,
    account: null,
    clientId: '',
    isAutoBackupEnabled: true,
    intervalMinutes: 30,
    retentionCount: 10,
    lastBackupAt: null,
    lastBackupStatus: 'idle',
    lastError: null,
  });
  const [remoteBackups, setRemoteBackups] = useState<RemoteBackupFile[]>([]);
  const [isGDriveLoading, setIsGDriveLoading] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<RestoreTarget | null>(null);

  // Modals
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<VaultEntry | null>(null);
  const [defaultNewType, setDefaultNewType] = useState<EntryType>('login');
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Inactivity tracking
  const lastActivityRef = useRef<number>(Date.now());
  const autoLockTimerRef = useRef<NodeJS.Timeout | null>(null);

  const addToast = useCallback((message: string, type: ToastNotification['type'] = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const refreshGDriveStatus = useCallback(async () => {
    try {
      const gStatus = await window.vaultApi.gdrive.getStatus();
      setGdriveStatus(gStatus);
    } catch {
      // safe ignore
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const currentStatus = await window.vaultApi.getStatus();
      setStatus(currentStatus);
      const currentSettings = await window.vaultApi.getSettings();
      setSettings(currentSettings);
    } catch (err: any) {
      addToast(err.message || 'Failed to communicate with vault backend.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  const loadEntries = useCallback(async () => {
    try {
      const items = await window.vaultApi.listEntries(true);
      setEntries(items);
      if (selectedEntry) {
        const updated = items.find(i => i.id === selectedEntry.id);
        setSelectedEntry(updated || null);
      }
    } catch (err: any) {
      addToast(err.message || 'Failed to decrypt vault entries.', 'error');
    }
  }, [addToast, selectedEntry]);

  // Initial load
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // When status changes to unlocked, load entries
  useEffect(() => {
    if (status.isUnlocked) {
      loadEntries();
    } else {
      setEntries([]);
      setSelectedEntry(null);
    }
  }, [status.isUnlocked, loadEntries]);

  // Setup Activity Listeners for Inactivity Auto-Lock
  useEffect(() => {
    const handleActivity = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener('mousemove', handleActivity, { passive: true });
    window.addEventListener('mousedown', handleActivity, { passive: true });
    window.addEventListener('keydown', handleActivity, { passive: true });
    window.addEventListener('scroll', handleActivity, { passive: true });

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('scroll', handleActivity);
    };
  }, []);

  // Inactivity Interval Check
  useEffect(() => {
    if (!status.isUnlocked || settings.autoLockMinutes === 0) {
      if (autoLockTimerRef.current) clearInterval(autoLockTimerRef.current);
      return;
    }

    const checkInterval = 10000; // Check every 10 seconds
    const maxIdleMs = settings.autoLockMinutes * 60 * 1000;

    autoLockTimerRef.current = setInterval(() => {
      const idleTime = Date.now() - lastActivityRef.current;
      if (idleTime >= maxIdleMs) {
        window.vaultApi.lock();
        refreshStatus();
        addToast('Vault auto-locked due to inactivity.', 'info');
      }
    }, checkInterval);

    return () => {
      if (autoLockTimerRef.current) clearInterval(autoLockTimerRef.current);
    };
  }, [status.isUnlocked, settings.autoLockMinutes, refreshStatus, addToast]);

  const setupVault = async (masterPassword: string) => {
    setIsLoading(true);
    try {
      await window.vaultApi.setup(masterPassword);
      await refreshStatus();
      addToast('Master password configured. Vault initialized successfully.', 'success');
    } catch (err: any) {
      addToast(err.message || 'Vault setup failed.', 'error');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const unlockVault = async (masterPassword: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const success = await window.vaultApi.unlock(masterPassword);
      if (success) {
        await refreshStatus();
        addToast('Vault unlocked.', 'success');
        return true;
      }
      return false;
    } catch (err: any) {
      addToast(err.message || 'Incorrect master password.', 'error');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const lockVault = async () => {
    try {
      await window.vaultApi.lock();
      await refreshStatus();
      addToast('Vault locked.', 'info');
    } catch (err: any) {
      addToast(err.message || 'Lock failed.', 'error');
    }
  };

  const changeMasterPassword = async (curr: string, next: string) => {
    setIsLoading(true);
    try {
      await window.vaultApi.changePassword(curr, next);
      addToast('Master password successfully updated.', 'success');
    } catch (err: any) {
      addToast(err.message || 'Failed to change master password.', 'error');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const saveEntry = async (data: { id?: string; type: EntryType; title: string; isFavorite?: boolean; payload: VaultEntryPayload }) => {
    setIsLoading(true);
    try {
      const saved = await window.vaultApi.saveEntry(data);
      await loadEntries();
      setSelectedEntry(saved);
      setIsEntryModalOpen(false);
      setEditingEntry(null);
      addToast(`'${saved.title}' saved.`, 'success');
    } catch (err: any) {
      addToast(err.message || 'Failed to save entry.', 'error');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFavorite = async (id: string) => {
    try {
      const fav = await window.vaultApi.toggleFavorite(id);
      setEntries(prev => prev.map(e => (e.id === id ? { ...e, isFavorite: fav } : e)));
      if (selectedEntry?.id === id) {
        setSelectedEntry(prev => (prev ? { ...prev, isFavorite: fav } : null));
      }
      addToast(fav ? 'Added to favorites.' : 'Removed from favorites.', 'info');
    } catch (err: any) {
      addToast(err.message || 'Failed to update favorite.', 'error');
    }
  };

  const deleteEntry = async (id: string, permanent = false) => {
    try {
      await window.vaultApi.deleteEntry(id, permanent);
      await loadEntries();
      if (selectedEntry?.id === id) {
        setSelectedEntry(null);
      }
      addToast(permanent ? 'Item permanently deleted.' : 'Moved to trash.', 'info');
    } catch (err: any) {
      addToast(err.message || 'Delete failed.', 'error');
    }
  };

  const restoreEntry = async (id: string) => {
    try {
      await window.vaultApi.restoreEntry(id);
      await loadEntries();
      addToast('Item restored from trash.', 'success');
    } catch (err: any) {
      addToast(err.message || 'Restore failed.', 'error');
    }
  };

  const exportVault = async (masterPassword: string): Promise<ExportData> => {
    try {
      const data = await window.vaultApi.exportVault(masterPassword);
      addToast('Export generated successfully.', 'success');
      return data;
    } catch (err: any) {
      addToast(err.message || 'Export failed.', 'error');
      throw err;
    }
  };

  const importVault = async (data: unknown): Promise<number> => {
    try {
      const res = await window.vaultApi.importVault(data);
      await loadEntries();
      addToast(`Import completed: ${res.importedCount} items added.`, 'success');
      return res.importedCount;
    } catch (err: any) {
      addToast(err.message || 'Import failed.', 'error');
      throw err;
    }
  };

  const generatePassword = async (options?: unknown): Promise<GeneratedPasswordResult> => {
    return await window.vaultApi.generatePassword(options as any);
  };

  const copyToClipboard = async (text: string, label = 'Secret') => {
    try {
      await window.vaultApi.copyToClipboard(text, settings.clipboardClearSeconds);
      addToast(`${label} copied! Auto-clears in ${settings.clipboardClearSeconds}s.`, 'success');
    } catch (err: any) {
      addToast(err.message || 'Clipboard copy failed.', 'error');
    }
  };

  const updateSettings = async (newSettings: Partial<VaultSettings>) => {
    try {
      const updated = await window.vaultApi.updateSettings(newSettings);
      setSettings(updated);
      addToast('Preferences saved.', 'success');
    } catch (err: any) {
      addToast(err.message || 'Settings update failed.', 'error');
    }
  };

  const openCreateModal = (type: EntryType = 'login') => {
    setDefaultNewType(type);
    setEditingEntry(null);
    setIsEntryModalOpen(true);
  };

  const openEditModal = (entry: VaultEntry) => {
    setEditingEntry(entry);
    setDefaultNewType(entry.type);
    setIsEntryModalOpen(true);
  };

  const closeEntryModal = () => {
    setIsEntryModalOpen(false);
    setEditingEntry(null);
  };

  // Filter and Search logic
  const filteredEntries = entries.filter(item => {
    // Trash filter
    if (activeCategory === 'trash') {
      if (!item.trashedAt) return false;
    } else {
      if (item.trashedAt) return false;
    }

    // Category filter
    if (activeCategory === 'favorites') {
      if (!item.isFavorite) return false;
    } else if (activeCategory !== 'all' && activeCategory !== 'trash') {
      if (item.type !== activeCategory) return false;
    }

    // Search query
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      const titleMatch = item.title.toLowerCase().includes(q);
      const tagMatch = item.payload.tags?.some(t => t.toLowerCase().includes(q)) ?? false;
      let fieldMatch = false;

      if (item.payload.type === 'login') {
        fieldMatch = item.payload.username.toLowerCase().includes(q) ||
          (item.payload.url?.toLowerCase().includes(q) ?? false);
      } else if (item.payload.type === 'card') {
        fieldMatch = item.payload.cardholderName.toLowerCase().includes(q);
      } else if (item.payload.type === 'identity') {
        fieldMatch = item.payload.fullName.toLowerCase().includes(q) ||
          (item.payload.email?.toLowerCase().includes(q) ?? false);
      }

      return titleMatch || tagMatch || fieldMatch;
    }

    return true;
  });

  // --- Google Drive & Encrypted Backups Actions ---
  const loadRemoteBackups = useCallback(async (): Promise<RemoteBackupFile[]> => {
    try {
      setIsGDriveLoading(true);
      const list = await window.vaultApi.gdrive.listBackups();
      setRemoteBackups(list);
      return list;
    } catch (err: any) {
      addToast(err.message || 'Failed to list Google Drive backups.', 'error');
      return [];
    } finally {
      setIsGDriveLoading(false);
    }
  }, [addToast]);

  const connectGDrive = async () => {
    setIsGDriveLoading(true);
    try {
      const updated = await window.vaultApi.gdrive.connect();
      setGdriveStatus(updated);
      addToast(`Google Drive connected as ${updated.account?.email || 'user'}.`, 'success');
      await loadRemoteBackups();
    } catch (err: any) {
      addToast(err.message || 'Failed to authenticate with Google Drive.', 'error');
      throw err;
    } finally {
      setIsGDriveLoading(false);
    }
  };

  const disconnectGDrive = async () => {
    setIsGDriveLoading(true);
    try {
      const updated = await window.vaultApi.gdrive.disconnect();
      setGdriveStatus(updated);
      setRemoteBackups([]);
      addToast('Google Drive disconnected. Local vault remains intact.', 'info');
    } catch (err: any) {
      addToast(err.message || 'Failed to disconnect Google Drive.', 'error');
    } finally {
      setIsGDriveLoading(false);
    }
  };

  const backupNowGDrive = async () => {
    setIsGDriveLoading(true);
    try {
      await window.vaultApi.gdrive.backupNow();
      await refreshGDriveStatus();
      await loadRemoteBackups();
      addToast('Encrypted backup successfully uploaded to Google Drive.', 'success');
    } catch (err: any) {
      addToast(err.message || 'Backup failed.', 'error');
      throw err;
    } finally {
      setIsGDriveLoading(false);
    }
  };

  const inspectRemoteBackup = async (fileId: string): Promise<EncryptedBackupContainer> => {
    try {
      return await window.vaultApi.gdrive.inspectBackup(fileId);
    } catch (err: any) {
      addToast(err.message || 'Failed to inspect remote backup.', 'error');
      throw err;
    }
  };

  const restoreRemoteBackup = async (fileId: string, masterPassword: string): Promise<RestoreComparison> => {
    setIsLoading(true);
    try {
      const comparison = await window.vaultApi.gdrive.restoreBackup(fileId, masterPassword);
      await loadEntries();
      await refreshStatus();
      addToast(`Restore complete: ${comparison.remoteItemCount} items restored from backup.`, 'success');
      return comparison;
    } catch (err: any) {
      addToast(err.message || 'Restore failed.', 'error');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const createEncryptedBackup = async (): Promise<EncryptedBackupContainer> => {
    try {
      return await window.vaultApi.createBackupContainer();
    } catch (err: any) {
      addToast(err.message || 'Failed to generate backup container.', 'error');
      throw err;
    }
  };

  const restoreEncryptedBackup = async (container: EncryptedBackupContainer, masterPassword: string): Promise<RestoreComparison> => {
    setIsLoading(true);
    try {
      const comparison = await window.vaultApi.restoreBackupContainer(container, masterPassword);
      await loadEntries();
      await refreshStatus();
      addToast(`Restore complete: ${comparison.remoteItemCount} items restored.`, 'success');
      return comparison;
    } catch (err: any) {
      addToast(err.message || 'Restore failed.', 'error');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const updateGDriveConfig = async (config: { isAutoBackupEnabled?: boolean; intervalMinutes?: number; retentionCount?: number; clientId?: string }) => {
    try {
      const updated = await window.vaultApi.gdrive.updateConfig(config);
      setGdriveStatus(updated);
      addToast('Backup preferences saved.', 'success');
    } catch (err: any) {
      addToast(err.message || 'Failed to update backup settings.', 'error');
    }
  };

  const openRestoreModal = (target: RestoreTarget) => {
    setRestoreTarget(target);
  };

  const closeRestoreModal = () => {
    setRestoreTarget(null);
  };

  // Poll Google Drive status when unlocked
  useEffect(() => {
    if (!status.isUnlocked) return;
    refreshGDriveStatus();
    const interval = setInterval(() => {
      refreshGDriveStatus();
    }, 20000);
    return () => clearInterval(interval);
  }, [status.isUnlocked, refreshGDriveStatus]);

  return (
    <VaultContext.Provider
      value={{
        status,
        entries,
        filteredEntries,
        selectedEntry,
        activeCategory,
        searchQuery,
        settings,
        isLoading,
        toasts,
        gdriveStatus,
        remoteBackups,
        isGDriveLoading,
        isEntryModalOpen,
        editingEntry,
        defaultNewType,
        isGeneratorOpen,
        isSettingsOpen,
        restoreTarget,
        refreshStatus,
        setupVault,
        unlockVault,
        lockVault,
        changeMasterPassword,
        loadEntries,
        selectEntry: setSelectedEntry,
        setActiveCategory,
        setSearchQuery,
        saveEntry,
        toggleFavorite,
        deleteEntry,
        restoreEntry,
        exportVault,
        importVault,
        generatePassword,
        copyToClipboard,
        updateSettings,
        refreshGDriveStatus,
        connectGDrive,
        disconnectGDrive,
        backupNowGDrive,
        loadRemoteBackups,
        inspectRemoteBackup,
        restoreRemoteBackup,
        createEncryptedBackup,
        restoreEncryptedBackup,
        updateGDriveConfig,
        openCreateModal,
        openEditModal,
        closeEntryModal,
        openGenerator: () => setIsGeneratorOpen(true),
        closeGenerator: () => setIsGeneratorOpen(false),
        openSettings: () => setIsSettingsOpen(true),
        closeSettings: () => setIsSettingsOpen(false),
        openRestoreModal,
        closeRestoreModal,
        dismissToast,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
};

export const useVault = () => {
  const context = useContext(VaultContext);
  if (!context) {
    throw new Error('useVault must be used within a VaultProvider');
  }
  return context;
};
