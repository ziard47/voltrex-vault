import React, { useState } from 'react';
import { useVault } from '../../context/VaultContext';
import { Shield, Lock, Eye, EyeOff } from 'lucide-react';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import logoUrl from '../../assets/logo.jpg';

export const UnlockModal: React.FC = () => {
  const { status, unlockVault, isLoading } = useVault();

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!status.isInitialized || status.isUnlocked) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password) {
      setError('Please enter your master password.');
      return;
    }

    try {
      await unlockVault(password);
      setPassword('');
    } catch (err: any) {
      setError('Incorrect master password. Please verify and try again.');
    }
  };

  return (
    <div className="fixed top-10 inset-x-0 bottom-0 bg-black flex items-center justify-center p-4 z-40 select-none">
      <div className="bg-[#0c0d0a] border border-vault-border rounded-lg w-full max-w-sm p-6 space-y-6 shadow-2xl">
        {/* Brand & Lock Header */}
        <div className="text-center space-y-3">
          <div className="relative mx-auto w-20 h-20 rounded-xl overflow-hidden border border-vault-border shadow-lg shadow-vault-lime/5">
            <img
              src={logoUrl}
              alt="Voltrex Vault Logo"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h2 className="text-base font-bold text-vault-textPrimary uppercase tracking-wider">
              Vault is Locked
            </h2>
            <p className="text-xs text-vault-textSecondary mt-1">
              Enter master password to decrypt your credentials.
            </p>
          </div>
        </div>

        {/* Unlock Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-2.5 rounded bg-vault-danger/20 border border-vault-danger/40 text-vault-danger text-xs text-center">
              {error}
            </div>
          )}

          <div>
            <TextField
              fullWidth
              size="small"
              type={showPassword ? 'text' : 'password'}
              autoFocus
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Master Password"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock className="w-4 h-4 text-vault-olive" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      sx={{ color: '#a2a894', '&:hover': { color: '#A7D129' } }}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-vault-lime hover:bg-vault-limeHover disabled:opacity-50 text-black font-semibold text-xs rounded transition-colors uppercase tracking-wider"
          >
            {isLoading ? 'Verifying & Decrypting...' : 'Unlock Vault'}
          </button>
        </form>

        <div className="text-center text-[10px] text-vault-textMuted flex items-center justify-center space-x-1">
          <Shield className="w-3 h-3 text-vault-olive" />
          <span>Local AES-256-GCM + Argon2id</span>
        </div>
      </div>
    </div>
  );
};
