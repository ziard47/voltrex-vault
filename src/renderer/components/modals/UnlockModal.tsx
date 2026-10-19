import React, { useState } from 'react';
import { useVault } from '../../context/VaultContext';
import { Shield, Lock, Eye, EyeOff } from 'lucide-react';

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
    <div className="fixed inset-0 bg-black flex items-center justify-center p-4 z-50 select-none">
      <div className="bg-[#0c0d0a] border border-vault-border rounded w-full max-w-sm p-6 space-y-6 shadow-2xl">
        {/* Brand & Lock Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded bg-vault-border/50 border border-vault-border flex items-center justify-center mx-auto text-vault-lime">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-vault-textPrimary uppercase tracking-wider">
            Vault is Locked
          </h2>
          <p className="text-xs text-vault-textSecondary">
            Enter master password to decrypt your credentials.
          </p>
        </div>

        {/* Unlock Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-2.5 rounded bg-vault-danger/20 border border-vault-danger/40 text-vault-danger text-xs text-center">
              {error}
            </div>
          )}

          <div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoFocus
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Master Password"
                className="w-full bg-black border border-vault-border text-xs rounded pl-3 pr-9 py-2.5 text-vault-textPrimary focus:outline-none focus:border-vault-lime transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-3 text-vault-textSecondary hover:text-vault-textPrimary"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
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
