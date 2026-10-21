import React, { useState } from 'react';
import { useVault } from '../../context/VaultContext';
import { AlertTriangle, Eye, EyeOff, Lock } from 'lucide-react';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import logoUrl from '../../assets/logo.jpg';

export const SetupModal: React.FC = () => {
  const { status, setupVault, isLoading } = useVault();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status.isInitialized) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Master password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      await setupVault(password);
    } catch (err: any) {
      setError(err.message || 'Setup failed.');
    }
  };

  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, text: 'Empty', color: 'bg-vault-border' };
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (pwd.length >= 14) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score <= 2) return { score, text: 'Weak', color: 'bg-vault-danger' };
    if (score <= 3) return { score, text: 'Moderate', color: 'bg-vault-warning' };
    return { score, text: 'Strong', color: 'bg-vault-lime' };
  };

  const strength = getPasswordStrength(password);

  return (
    <div className="fixed top-10 inset-x-0 bottom-0 bg-black flex items-center justify-center p-4 z-40 select-none">
      <div className="bg-[#0c0d0a] border border-vault-border rounded-lg w-full max-w-md p-6 space-y-5 shadow-2xl">
        {/* Brand & Setup Header */}
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
              Create Your Vault
            </h2>
            <p className="text-xs text-vault-textSecondary mt-1">
              Set a master password to initialize and encrypt your local database.
            </p>
          </div>
        </div>

        {/* Security Alert Banner */}
        <div className="p-3 bg-[#131109] border border-vault-warning/30 rounded flex items-start space-x-2.5 text-xs text-vault-textSecondary">
          <AlertTriangle className="w-4 h-4 text-vault-warning flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed text-[11px]">
            <strong className="text-vault-textPrimary">Zero-Knowledge Security:</strong> Your data is encrypted locally using Argon2id and AES-256-GCM. We never store or transmit your master password. If lost, it cannot be recovered.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-2.5 rounded bg-vault-danger/20 border border-vault-danger/40 text-vault-danger text-xs">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-vault-textMuted block font-semibold">
              Master Password *
            </label>
            <TextField
              fullWidth
              size="small"
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
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

            {/* Strength meter */}
            {password.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="h-1 bg-vault-border rounded overflow-hidden flex">
                  <div
                    className={`h-full transition-all duration-300 ${strength.color}`}
                    style={{ width: `${(strength.score / 5) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-vault-textMuted">
                  <span>Strength</span>
                  <span className="font-semibold text-vault-textSecondary">{strength.text}</span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-vault-textMuted block font-semibold">
              Confirm Master Password *
            </label>
            <TextField
              fullWidth
              size="small"
              type={showPassword ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Re-enter master password"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock className="w-4 h-4 text-vault-olive" />
                  </InputAdornment>
                ),
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-vault-lime hover:bg-vault-limeHover disabled:opacity-50 text-black font-semibold text-xs rounded transition-colors uppercase tracking-wider mt-2"
          >
            {isLoading ? 'Deriving Keys & Initializing...' : 'Create Vault'}
          </button>
        </form>
      </div>
    </div>
  );
};
