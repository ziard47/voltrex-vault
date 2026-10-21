import React from 'react';
import { useVault } from '../../context/VaultContext';
import { Lock, Search, Minus, Square, X } from 'lucide-react';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import logoUrl from '../../assets/logo.jpg';

export const TitleBar: React.FC = () => {
  const {
    status,
    lockVault,
    searchQuery,
    setSearchQuery,
  } = useVault();

  const handleMinimize = () => window.vaultApi.minimize();
  const handleMaximize = () => window.vaultApi.maximize();
  const handleClose = () => window.vaultApi.close();

  return (
    <header className="h-10 bg-vault-black border-b border-vault-border flex items-center justify-between px-3 select-none app-draggable z-50">
      {/* Brand Header */}
      <div className="flex items-center space-x-2.5 app-non-draggable">
        <div className="w-6 h-6 rounded-md overflow-hidden border border-vault-border flex-shrink-0">
          <img src={logoUrl} alt="Voltrex Vault" className="w-full h-full object-cover" />
        </div>
        <span className="text-xs font-bold tracking-wider text-vault-textPrimary uppercase">
          Voltrex <span className="text-vault-lime">Vault</span>
        </span>
        <span className="text-[10px] bg-vault-border px-1.5 py-0.5 rounded text-vault-textSecondary font-mono">
          v1.0
        </span>
      </div>

      {/* Global Search (Active only when unlocked) */}
      {status.isUnlocked ? (
        <div className="flex-1 max-w-md mx-4 app-non-draggable">
          <TextField
            fullWidth
            size="small"
            placeholder="Search vault (Ctrl+F)..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search className="w-3.5 h-3.5 text-vault-textSecondary" />
                </InputAdornment>
              ),
              sx: {
                backgroundColor: '#0a0b08',
                height: 28,
                fontSize: '0.75rem',
              },
            }}
          />
        </div>
      ) : (
        <div className="flex-1" />
      )}

      {/* Quick Lock & Window Controls */}
      <div className="flex items-center space-x-1 app-non-draggable">
        {status.isUnlocked && (
          <button
            onClick={lockVault}
            title="Lock Vault (Ctrl+L)"
            className="flex items-center space-x-1.5 text-xs text-vault-textSecondary hover:text-vault-lime hover:bg-vault-surface px-2.5 py-1 rounded transition-colors mr-2"
          >
            <Lock className="w-3.5 h-3.5" />
            <span className="font-medium">Lock</span>
          </button>
        )}

        {/* Window controls */}
        <button
          onClick={handleMinimize}
          title="Minimize"
          className="w-7 h-7 flex items-center justify-center text-vault-textSecondary hover:text-vault-textPrimary hover:bg-vault-surface rounded transition-colors"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleMaximize}
          title="Maximize"
          className="w-7 h-7 flex items-center justify-center text-vault-textSecondary hover:text-vault-textPrimary hover:bg-vault-surface rounded transition-colors"
        >
          <Square className="w-3 h-3" />
        </button>
        <button
          onClick={handleClose}
          title="Close"
          className="w-7 h-7 flex items-center justify-center text-vault-textSecondary hover:text-white hover:bg-vault-danger rounded transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
