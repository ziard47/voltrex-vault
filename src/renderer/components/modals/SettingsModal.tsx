import React, { useState } from 'react';
import { useVault } from '../../context/VaultContext';
import {
  X,
  Shield,
  Clock,
  KeyRound,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle,
  Cloud,
  RefreshCw,
  FileArchive,
  RotateCcw,
  User,
} from 'lucide-react';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import TextField from '@mui/material/TextField';
import logoUrl from '../../assets/logo.jpg';

export const SettingsModal: React.FC = () => {
  const {
    isSettingsOpen,
    closeSettings,
    settings,
    updateSettings,
    changeMasterPassword,
    exportVault,
    importVault,
    gdriveStatus,
    remoteBackups,
    isGDriveLoading,
    connectGDrive,
    disconnectGDrive,
    backupNowGDrive,
    loadRemoteBackups,
    createEncryptedBackup,
    openRestoreModal,
    updateGDriveConfig,
  } = useVault();

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState(false);

  // Export state
  const [exportPassword, setExportPassword] = useState('');
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Encrypted backup state
  const [isExportingEncrypted, setIsExportingEncrypted] = useState(false);
  const [encryptedExportSuccess, setEncryptedExportSuccess] = useState(false);
  const [encryptedExportError, setEncryptedExportError] = useState<string | null>(null);

  // Import state
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  if (!isSettingsOpen) return null;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError(null);
    setPwdSuccess(false);

    if (newPassword.length < 8) {
      setPwdError('New master password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPwdError('New passwords do not match.');
      return;
    }

    try {
      await changeMasterPassword(currentPassword, newPassword);
      setPwdSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: any) {
      setPwdError(err.message || 'Failed to change master password.');
    }
  };

  const handleExportPlainJson = async (e: React.FormEvent) => {
    e.preventDefault();
    setExportError(null);
    setExportSuccess(false);

    if (!exportPassword) {
      setExportError('Please enter your master password to authorize export.');
      return;
    }

    try {
      const data = await exportVault(exportPassword);
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `voltrex-vault-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportSuccess(true);
      setExportPassword('');
    } catch (err: any) {
      setExportError(err.message || 'Export authorization failed.');
    }
  };

  const handleExportEncryptedBackup = async () => {
    setEncryptedExportError(null);
    setEncryptedExportSuccess(false);
    setIsExportingEncrypted(true);
    try {
      const container = await createEncryptedBackup();
      const jsonStr = JSON.stringify(container, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `voltrex-vault-backup-${new Date().toISOString().slice(0, 10)}.voltrex`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setEncryptedExportSuccess(true);
    } catch (err: any) {
      setEncryptedExportError(err.message || 'Failed to generate encrypted backup container.');
    } finally {
      setIsExportingEncrypted(false);
    }
  };

  const handleImportEncryptedFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    setImportStatus(null);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (parsed.format !== 'voltrex-vault-encrypted-backup-v1') {
        throw new Error('Unrecognized backup format. Expected voltrex-vault-encrypted-backup-v1 container.');
      }
      openRestoreModal({
        container: parsed,
        fileName: file.name,
        sizeBytes: file.size,
      });
    } catch (err: any) {
      setImportError(err.message || 'Invalid or corrupted encrypted backup file.');
    } finally {
      e.target.value = '';
    }
  };

  const handleImportPlainFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    setImportStatus('Reading import file...');

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const count = await importVault(parsed);
      setImportStatus(`Successfully imported ${count} items.`);
    } catch (err: any) {
      setImportError(err.message || 'Invalid or corrupted vault export file.');
      setImportStatus(null);
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 select-none">
      <div className="bg-[#0c0d0a] border border-vault-border rounded w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="h-12 border-b border-vault-border px-5 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-vault-lime" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-vault-textPrimary">
              Vault Preferences & Backups
            </h3>
          </div>
          <button
            onClick={closeSettings}
            className="p-1 text-vault-textSecondary hover:text-white rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* General Preferences */}
          <section className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-vault-lime flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Inactivity & Clipboard</span>
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <div className="border border-vault-border rounded p-3 bg-black space-y-2">
                <label className="text-[10px] uppercase tracking-wider text-vault-textMuted block font-semibold">
                  Auto-Lock Inactivity Timeout
                </label>
                <FormControl fullWidth size="small">
                  <Select
                    value={settings.autoLockMinutes}
                    onChange={e => updateSettings({ autoLockMinutes: Number(e.target.value) })}
                  >
                    <MenuItem value={1}>1 Minute</MenuItem>
                    <MenuItem value={5}>5 Minutes</MenuItem>
                    <MenuItem value={15}>15 Minutes (Default)</MenuItem>
                    <MenuItem value={30}>30 Minutes</MenuItem>
                    <MenuItem value={60}>1 Hour</MenuItem>
                    <MenuItem value={0}>Disabled (Never Auto-Lock)</MenuItem>
                  </Select>
                </FormControl>
                <p className="text-[10px] text-vault-textMuted">Locks the database when user input stops.</p>
              </div>

              <div className="border border-vault-border rounded p-3 bg-black space-y-2">
                <label className="text-[10px] uppercase tracking-wider text-vault-textMuted block font-semibold">
                  Clipboard Auto-Clear
                </label>
                <FormControl fullWidth size="small">
                  <Select
                    value={settings.clipboardClearSeconds}
                    onChange={e => updateSettings({ clipboardClearSeconds: Number(e.target.value) })}
                  >
                    <MenuItem value={15}>15 Seconds</MenuItem>
                    <MenuItem value={30}>30 Seconds (Default)</MenuItem>
                    <MenuItem value={60}>60 Seconds</MenuItem>
                    <MenuItem value={120}>2 Minutes</MenuItem>
                  </Select>
                </FormControl>
                <p className="text-[10px] text-vault-textMuted">Auto-clears copied credentials (best-effort).</p>
              </div>
            </div>
          </section>

          {/* Google Drive Integration */}
          <section className="space-y-3 pt-3 border-t border-vault-border">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-vault-lime flex items-center space-x-1.5">
                <Cloud className="w-3.5 h-3.5" />
                <span>Google Drive Encrypted Backups</span>
              </h4>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border ${
                  gdriveStatus.isConnected
                    ? 'bg-vault-lime/10 text-vault-lime border-vault-lime/30'
                    : 'bg-vault-border text-vault-textMuted border-vault-border'
                }`}
              >
                {gdriveStatus.isConnected ? 'Connected' : 'Offline / Not Connected'}
              </span>
            </div>

            {gdriveStatus.isConnected ? (
              <div className="border border-vault-border rounded p-4 bg-black space-y-4">
                {/* Account row */}
                <div className="flex items-center justify-between pb-3 border-b border-vault-border/60">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-full bg-[#1b1e16] border border-vault-border flex items-center justify-center text-vault-lime">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-vault-textPrimary">
                        {gdriveStatus.account?.name || 'Google Account'}
                      </div>
                      <div className="text-[11px] text-vault-textMuted font-mono">
                        {gdriveStatus.account?.email}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={backupNowGDrive}
                      disabled={isGDriveLoading || gdriveStatus.lastBackupStatus === 'in_progress'}
                      className="py-1 px-3 bg-vault-lime hover:bg-[#8ebb20] text-black text-xs font-bold rounded transition-colors flex items-center space-x-1.5 disabled:opacity-50"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${gdriveStatus.lastBackupStatus === 'in_progress' ? 'animate-spin' : ''}`} />
                      <span>{gdriveStatus.lastBackupStatus === 'in_progress' ? 'Backing Up...' : 'Back Up Now'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={disconnectGDrive}
                      disabled={isGDriveLoading}
                      className="py-1 px-2.5 bg-vault-border hover:bg-vault-danger/30 text-vault-textSecondary hover:text-vault-danger text-xs rounded transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>

                {/* Backup Settings */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={gdriveStatus.isAutoBackupEnabled}
                          onChange={e => updateGDriveConfig({ isAutoBackupEnabled: e.target.checked })}
                        />
                      }
                      label="Automatic Backups"
                    />
                    <p className="text-[10px] text-vault-textMuted pl-6">
                      Backs up automatically when vault changes occur.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-vault-textMuted block font-semibold mb-1">
                      Periodic Backup Interval
                    </label>
                    <FormControl fullWidth size="small">
                      <Select
                        value={gdriveStatus.intervalMinutes}
                        onChange={e => updateGDriveConfig({ intervalMinutes: Number(e.target.value) })}
                      >
                        <MenuItem value={15}>Every 15 Minutes</MenuItem>
                        <MenuItem value={30}>Every 30 Minutes (Default)</MenuItem>
                        <MenuItem value={60}>Every 1 Hour</MenuItem>
                        <MenuItem value={360}>Every 6 Hours</MenuItem>
                        <MenuItem value={1440}>Every 24 Hours</MenuItem>
                      </Select>
                    </FormControl>
                  </div>
                </div>

                {/* Status Readout */}
                <div className="p-2.5 bg-[#0e100c] border border-vault-border rounded text-[11px] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-vault-textMuted">Last Backup Attempt:</span>
                    <span className="text-vault-textPrimary font-mono">
                      {gdriveStatus.lastBackupAt
                        ? new Date(gdriveStatus.lastBackupAt).toLocaleString()
                        : 'No backups completed yet'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-vault-textMuted">Status:</span>
                    <span className={gdriveStatus.lastError ? 'text-vault-danger font-semibold' : 'text-vault-lime font-semibold'}>
                      {gdriveStatus.lastError ? `Error: ${gdriveStatus.lastError}` : (gdriveStatus.lastBackupStatus || 'Ready')}
                    </span>
                  </div>
                  <div className="text-[10px] text-vault-textMuted pt-1 border-t border-vault-border/40">
                    Scoped to installed app files only (<code className="text-vault-lime font-mono">drive.file</code>). Encryption keys never leave this computer.
                  </div>
                </div>

                {/* Remote Backups List */}
                <div className="space-y-2 pt-2 border-t border-vault-border">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] uppercase tracking-wider text-vault-textMuted block font-semibold">
                      Remote Backups in Google Drive ({remoteBackups.length})
                    </label>
                    <button
                      type="button"
                      onClick={() => loadRemoteBackups()}
                      disabled={isGDriveLoading}
                      className="text-[10px] text-vault-lime hover:underline flex items-center space-x-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${isGDriveLoading ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                  </div>

                  {remoteBackups.length === 0 ? (
                    <div className="p-3 text-center text-vault-textMuted text-xs bg-[#0a0b08] rounded border border-vault-border">
                      No remote backups found. Click "Back Up Now" to create your first encrypted backup.
                    </div>
                  ) : (
                    <div className="max-h-40 overflow-y-auto space-y-1.5 border border-vault-border rounded p-1.5 bg-[#080907]">
                      {remoteBackups.map(b => (
                        <div
                          key={b.fileId}
                          className="flex items-center justify-between p-2 rounded bg-black border border-vault-border/70 hover:border-vault-olive transition-colors text-xs"
                        >
                          <div className="space-y-0.5">
                            <div className="text-vault-textPrimary font-mono font-medium text-[11px] truncate max-w-xs">
                              {b.name}
                            </div>
                            <div className="text-[10px] text-vault-textMuted flex items-center space-x-2">
                              <span>{new Date(b.createdAt).toLocaleString()}</span>
                              <span>•</span>
                              <span>{(b.sizeBytes / 1024).toFixed(1)} KB</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              openRestoreModal({
                                fileId: b.fileId,
                                fileName: b.name,
                                sizeBytes: b.sizeBytes,
                              })
                            }
                            className="py-1 px-2.5 bg-vault-border hover:bg-vault-olive text-vault-lime text-[11px] font-semibold rounded transition-colors flex items-center space-x-1"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Restore...</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="border border-vault-border rounded p-4 bg-black space-y-3">
                <p className="text-xs text-vault-textSecondary leading-relaxed">
                  Back up your vault to your personal Google Drive account in an encrypted, versioned container (<code>voltrex-vault-encrypted-backup-v1</code>).
                  Only authenticated AES-256-GCM ciphertext is transferred. Your master password is never sent to Google.
                </p>

                <div className="p-2.5 bg-[#171306] border border-vault-warning/30 rounded text-[11px] text-vault-textSecondary space-y-1">
                  <div className="flex items-center space-x-1.5 text-vault-warning font-semibold">
                    <Shield className="w-3.5 h-3.5" />
                    <span>Privacy & Permission Scope</span>
                  </div>
                  <p>
                    Voltrex Vault requests strictly the <code className="text-vault-lime">drive.file</code> OAuth scope.
                    The app can only view and modify files that it created itself, and has zero access to your personal Drive documents or photos.
                  </p>
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={connectGDrive}
                    disabled={isGDriveLoading}
                    className="py-1.5 px-4 bg-vault-lime hover:bg-[#8ebb20] text-black font-bold text-xs rounded transition-colors flex items-center space-x-2 disabled:opacity-50"
                  >
                    <Cloud className={`w-3.5 h-3.5 ${isGDriveLoading ? 'animate-bounce' : ''}`} />
                    <span>{isGDriveLoading ? 'Connecting via Google OAuth...' : 'Connect Google Drive'}</span>
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Change Master Password */}
          <section className="space-y-3 pt-3 border-t border-vault-border">
            <h4 className="text-xs font-bold uppercase tracking-wider text-vault-lime flex items-center space-x-1.5">
              <KeyRound className="w-3.5 h-3.5" />
              <span>Change Master Password</span>
            </h4>

            <form onSubmit={handleChangePassword} className="space-y-3 border border-vault-border rounded p-4 bg-black">
              {pwdError && (
                <div className="p-2 rounded bg-vault-danger/20 border border-vault-danger/40 text-vault-danger text-xs">
                  {pwdError}
                </div>
              )}
              {pwdSuccess && (
                <div className="p-2 rounded bg-vault-lime/20 border border-vault-lime/40 text-vault-lime text-xs flex items-center space-x-1.5">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Master password updated and Data Encryption Key re-wrapped.</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-vault-textMuted block font-semibold">
                  Current Master Password
                </label>
                <TextField
                  fullWidth
                  size="small"
                  type="password"
                  required
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-vault-textMuted block font-semibold">
                    New Master Password
                  </label>
                  <TextField
                    fullWidth
                    size="small"
                    type="password"
                    required
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Min 8 characters"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-vault-textMuted block font-semibold">
                    Confirm New Master Password
                  </label>
                  <TextField
                    fullWidth
                    size="small"
                    type="password"
                    required
                    value={confirmNewPassword}
                    onChange={e => setConfirmNewPassword(e.target.value)}
                    placeholder="Repeat new password"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="py-1.5 px-3 bg-vault-border hover:bg-vault-olive text-vault-textPrimary text-xs rounded font-medium transition-colors"
              >
                Update Password
              </button>
            </form>
          </section>

          {/* Import & Export */}
          <section className="space-y-3 pt-3 border-t border-vault-border">
            <h4 className="text-xs font-bold uppercase tracking-wider text-vault-lime flex items-center space-x-1.5">
              <Download className="w-3.5 h-3.5" />
              <span>Import & Export</span>
            </h4>

            {/* Encrypted Container Section (.voltrex) */}
            <div className="border border-vault-border rounded p-4 bg-black space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-vault-textPrimary flex items-center space-x-1.5">
                    <FileArchive className="w-3.5 h-3.5 text-vault-lime" />
                    <span>Encrypted Backup Container (.voltrex)</span>
                  </div>
                  <div className="text-[10px] text-vault-textMuted">
                    Fully encrypted with Argon2id + AES-256-GCM. Safe for cold storage and USB drives.
                  </div>
                </div>
              </div>

              {encryptedExportSuccess && (
                <div className="p-2 rounded bg-vault-lime/20 border border-vault-lime/40 text-vault-lime text-xs">
                  Encrypted backup container (.voltrex) downloaded successfully.
                </div>
              )}
              {encryptedExportError && (
                <div className="p-2 rounded bg-vault-danger/20 border border-vault-danger/40 text-vault-danger text-xs">
                  {encryptedExportError}
                </div>
              )}

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={handleExportEncryptedBackup}
                  disabled={isExportingEncrypted}
                  className="py-1.5 px-3 bg-vault-border hover:bg-vault-olive text-vault-textPrimary text-xs rounded font-medium transition-colors flex items-center space-x-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isExportingEncrypted ? 'Exporting...' : 'Export Encrypted (.voltrex)'}</span>
                </button>

                <label className="py-1.5 px-3 bg-vault-border hover:bg-vault-olive text-vault-textPrimary text-xs rounded font-medium cursor-pointer transition-colors inline-flex items-center space-x-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Restore from .voltrex file...</span>
                  <input
                    type="file"
                    accept=".voltrex,.json"
                    onChange={handleImportEncryptedFile}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Plaintext Export Section */}
            <div className="border border-vault-border rounded p-4 bg-black space-y-3">
              <div className="p-2.5 bg-[#171306] border border-vault-warning/30 rounded flex items-start space-x-2 text-xs text-vault-textSecondary">
                <AlertTriangle className="w-4 h-4 text-vault-warning flex-shrink-0 mt-0.5" />
                <p>
                  <strong className="text-vault-warning">Plaintext Warning:</strong> Plaintext JSON exports contain <strong>unencrypted credentials</strong>. Use with caution.
                </p>
              </div>

              {exportError && (
                <div className="p-2 rounded bg-vault-danger/20 border border-vault-danger/40 text-vault-danger text-xs">
                  {exportError}
                </div>
              )}
              {exportSuccess && (
                <div className="p-2 rounded bg-vault-lime/20 border border-vault-lime/40 text-vault-lime text-xs">
                  Plain JSON export downloaded.
                </div>
              )}

              <form onSubmit={handleExportPlainJson} className="flex items-center space-x-2">
                <div className="flex-1">
                  <TextField
                    fullWidth
                    size="small"
                    type="password"
                    required
                    value={exportPassword}
                    onChange={e => setExportPassword(e.target.value)}
                    placeholder="Master password required for plain export"
                  />
                </div>
                <button
                  type="submit"
                  className="py-2 px-3 bg-vault-border hover:bg-vault-olive text-vault-textPrimary text-xs rounded font-medium transition-colors flex items-center space-x-1.5 flex-shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Plain JSON</span>
                </button>
              </form>
            </div>

            {/* Plaintext Import Section */}
            <div className="border border-vault-border rounded p-4 bg-black space-y-2">
              <label className="text-[10px] uppercase tracking-wider text-vault-textMuted block font-semibold">
                Import Plaintext Vault JSON
              </label>
              {importError && (
                <div className="p-2 rounded bg-vault-danger/20 border border-vault-danger/40 text-vault-danger text-xs">
                  {importError}
                </div>
              )}
              {importStatus && (
                <div className="p-2 rounded bg-vault-lime/20 border border-vault-lime/40 text-vault-lime text-xs">
                  {importStatus}
                </div>
              )}
              <div className="flex items-center space-x-2">
                <label className="py-1.5 px-3 bg-vault-border hover:bg-vault-olive text-vault-textPrimary text-xs rounded font-medium cursor-pointer transition-colors inline-flex items-center space-x-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Select JSON File to Import</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportPlainFile}
                    className="hidden"
                  />
                </label>
                <span className="text-[11px] text-vault-textMuted">
                  Imports valid 'voltrex-vault-unencrypted-export' datasets
                </span>
              </div>
            </div>
          </section>

          {/* System & Architecture Info */}
          <section className="pt-3 border-t border-vault-border text-[11px] text-vault-textMuted space-y-3">
            <div className="flex items-center space-x-3 bg-black/60 p-2.5 rounded border border-vault-border">
              <img src={logoUrl} alt="Voltrex Vault" className="w-10 h-10 rounded-md object-cover border border-vault-border flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-vault-textPrimary uppercase tracking-wider">
                  Voltrex Vault <span className="text-vault-lime text-[10px] font-mono font-normal">v1.0.0</span>
                </p>
                <p className="text-[10px] text-vault-textSecondary">
                  Local-First Zero-Knowledge Password & Credential Vault
                </p>
              </div>
            </div>
            <div className="space-y-1">
              <p><strong>Storage Engine:</strong> SQLite via WebAssembly (sql.js) with 0600 file permissions</p>
              <p><strong>Cryptography:</strong> AES-256-GCM + Argon2id (64 MiB, 3 iterations) + HKDF-SHA256</p>
              <p><strong>Cloud Backup:</strong> Google Drive API (drive.file scope) + PKCE Installed App Flow</p>
              <p><strong>Architecture:</strong> Local-first, zero telemetry, zero Voltrex cloud server dependency</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
