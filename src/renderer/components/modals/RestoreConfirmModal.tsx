import React, { useState, useEffect } from 'react';
import { useVault } from '../../context/VaultContext';
import {
  X,
  ShieldAlert,
  AlertTriangle,
  RotateCcw,
  CheckCircle,
  Database,
  Lock,
} from 'lucide-react';
import { EncryptedBackupContainer, RestoreComparison } from '../../../shared/types';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';

export const RestoreConfirmModal: React.FC = () => {
  const {
    restoreTarget,
    closeRestoreModal,
    inspectRemoteBackup,
    restoreRemoteBackup,
    restoreEncryptedBackup,
  } = useVault();

  const [password, setPassword] = useState('');
  const [container, setContainer] = useState<EncryptedBackupContainer | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState<RestoreComparison | null>(null);

  useEffect(() => {
    if (restoreTarget) {
      setPassword('');
      setError(null);
      setRestoreSuccess(null);
      if (restoreTarget.container) {
        setContainer(restoreTarget.container);
      } else {
        setContainer(null);
      }
    }
  }, [restoreTarget]);

  if (!restoreTarget) return null;

  const handleInspect = async () => {
    if (!restoreTarget.fileId) return;
    setIsInspecting(true);
    setError(null);
    try {
      const inspected = await inspectRemoteBackup(restoreTarget.fileId);
      setContainer(inspected);
    } catch (err: any) {
      setError(err.message || 'Failed to inspect remote backup container.');
    } finally {
      setIsInspecting(false);
    }
  };

  const handleConfirmRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Master password is required to decrypt and restore this backup.');
      return;
    }

    setIsRestoring(true);
    setError(null);

    try {
      let comparison: RestoreComparison;
      if (restoreTarget.fileId) {
        comparison = await restoreRemoteBackup(restoreTarget.fileId, password);
      } else if (restoreTarget.container) {
        comparison = await restoreEncryptedBackup(restoreTarget.container, password);
      } else {
        throw new Error('No valid backup target specified.');
      }
      setRestoreSuccess(comparison);
    } catch (err: any) {
      setError(err.message || 'Failed to restore backup. Check that the master password is correct.');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 select-none">
      <div className="bg-[#0c0d0a] border border-vault-border rounded w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="h-12 border-b border-vault-border px-5 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-vault-warning" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-vault-textPrimary">
              Restore Encrypted Backup
            </h3>
          </div>
          {!isRestoring && (
            <button
              onClick={closeRestoreModal}
              className="p-1 text-vault-textSecondary hover:text-white rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {restoreSuccess ? (
            <div className="space-y-4">
              <div className="p-4 rounded bg-vault-lime/10 border border-vault-lime/30 text-vault-lime space-y-2">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 flex-shrink-0" />
                  <h4 className="text-sm font-bold">Vault Restored Successfully</h4>
                </div>
                <p className="text-xs text-vault-textSecondary">
                  {restoreSuccess.remoteItemCount} items were safely restored into your local database. A pre-restore safety snapshot was recorded in your user data directory.
                </p>
              </div>

              <div className="p-3 bg-black border border-vault-border rounded text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-vault-textMuted">Local Items Prior:</span>
                  <span className="text-vault-textPrimary font-mono">{restoreSuccess.localItemCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-vault-textMuted">Restored Items:</span>
                  <span className="text-vault-lime font-mono font-bold">{restoreSuccess.remoteItemCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-vault-textMuted">Vault ID:</span>
                  <span className="text-vault-textSecondary font-mono text-[11px]">{restoreSuccess.remoteVaultId}</span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={closeRestoreModal}
                  className="py-1.5 px-4 bg-vault-lime text-black font-bold text-xs rounded hover:bg-[#8ebb20] transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleConfirmRestore} className="space-y-4">
              {/* Target File Info */}
              <div className="p-3 bg-black border border-vault-border rounded flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-vault-textPrimary font-mono">
                    {restoreTarget.fileName}
                  </div>
                  {restoreTarget.sizeBytes && (
                    <div className="text-[10px] text-vault-textMuted">
                      Size: {(restoreTarget.sizeBytes / 1024).toFixed(1)} KB
                    </div>
                  )}
                </div>
                {restoreTarget.fileId && !container && (
                  <button
                    type="button"
                    onClick={handleInspect}
                    disabled={isInspecting}
                    className="py-1 px-2.5 bg-vault-border hover:bg-vault-olive text-vault-textPrimary text-[11px] rounded transition-colors disabled:opacity-50"
                  >
                    {isInspecting ? 'Inspecting...' : 'Inspect Metadata'}
                  </button>
                )}
              </div>

              {/* Inspected Container Details */}
              {container && (
                <div className="p-3 bg-[#11130e] border border-vault-border rounded space-y-2 text-xs">
                  <div className="flex items-center space-x-1.5 text-vault-lime font-bold text-[11px] uppercase tracking-wider">
                    <Database className="w-3.5 h-3.5" />
                    <span>Container Metadata</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-vault-textMuted block">Format:</span>
                      <span className="font-mono text-vault-textPrimary">{container.format}</span>
                    </div>
                    <div>
                      <span className="text-vault-textMuted block">Backup Created:</span>
                      <span className="text-vault-textPrimary">
                        {new Date(container.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-vault-textMuted block">Item Count:</span>
                      <span className="font-mono text-vault-lime font-bold">
                        {container.itemCount} items
                      </span>
                    </div>
                    <div>
                      <span className="text-vault-textMuted block">Source Vault ID:</span>
                      <span className="font-mono text-[10px] text-vault-textSecondary truncate block">
                        {container.vaultId}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Security Warning Notice */}
              <div className="p-3 bg-[#1c1404] border border-vault-warning/40 rounded flex items-start space-x-2.5 text-xs text-vault-textSecondary">
                <AlertTriangle className="w-4 h-4 text-vault-warning flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-vault-warning">
                    Atomic Database Replacement Notice
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    Restoring a backup safely replaces your active database with the contents of this snapshot.
                    An automatic safety snapshot of your current vault will be saved before replacement.
                  </p>
                </div>
              </div>

              {error && (
                <div className="p-2.5 rounded bg-vault-danger/20 border border-vault-danger/40 text-vault-danger text-xs">
                  {error}
                </div>
              )}

              {/* Password prompt */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider text-vault-textMuted block font-semibold flex items-center space-x-1">
                  <Lock className="w-3 h-3 text-vault-lime" />
                  <span>Backup Master Password</span>
                </label>
                <TextField
                  fullWidth
                  size="small"
                  type="password"
                  required
                  autoFocus
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter the master password for this backup"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Lock className="w-3.5 h-3.5 text-vault-olive" />
                      </InputAdornment>
                    ),
                  }}
                />
                <p className="text-[10px] text-vault-textMuted">
                  Required to derive the Key Encryption Key (Argon2id) and authenticate the container.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-vault-border">
                <button
                  type="button"
                  onClick={closeRestoreModal}
                  disabled={isRestoring}
                  className="py-1.5 px-3 bg-vault-border hover:bg-vault-olive text-vault-textPrimary text-xs rounded font-medium transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRestoring || !password}
                  className="py-1.5 px-4 bg-vault-warning hover:bg-[#d49b1a] text-black font-bold text-xs rounded transition-colors flex items-center space-x-1.5 disabled:opacity-50"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isRestoring ? 'animate-spin' : ''}`} />
                  <span>{isRestoring ? 'Restoring Vault...' : 'Confirm & Restore Vault'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
