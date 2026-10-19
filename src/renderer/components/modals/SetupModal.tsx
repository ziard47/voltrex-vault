import React, { useState } from 'react';
import { useVault } from '../../context/VaultContext';
import { Shield, AlertTriangle, Eye, EyeOff } from 'lucide-react';

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
    <div className="fixed inset-0 bg-black flex items-center justify-center p-4 z-50 select-none">
      <div className="bg-[#0c0d0a] border border-vault-border rounded w-full max-w-md p-6 space-y-6 shadow-2xl">
        {/* Brand & Setup Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded bg-vault-border/50 border border-vault-border flex items-center justify-center mx-auto text-vault-lime">
            <Shield className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-vault-textPrimary uppercase tracking-wider">
            Create Your Vault
          </h2>
          <p className="text-xs text-vault-textSecondary">
            Set a master password to encrypt your local database.
          </p>
        </div>

        {/* Security Alert Banner */}
        <div className="p-3 bg-[#131109] border border-vault-warning/30 rounded flex items-start space-x-2.5 text-xs text-vault-textSecondary">
          <AlertTriangle className="w-4 h-4 text-vault-warning flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed">
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

          <div>
            <label className="text-[10px] uppercase tracking-wider text-vault-textMuted block font-semibold mb-1">
              Master Password *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full bg-black border border-vault-border text-xs rounded pl-3 pr-9 py-2 text-vault-textPrimary focus:outline-none focus:border-vault-lime transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-2.5 text-vault-textSecondary hover:text-vault-textPrimary"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

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

          <div>
            <label className="text-[10px] uppercase tracking-wider text-vault-textMuted block font-semibold mb-1">
              Confirm Master Password *
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Re-enter master password"
              className="w-full bg-black border border-vault-border text-xs rounded px-3 py-2 text-vault-textPrimary focus:outline-none focus:border-vault-lime transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-vault-lime hover:bg-vault-limeHover disabled:opacity-50 text-black font-semibold text-xs rounded transition-colors uppercase tracking-wider"
          >
            {isLoading ? 'Deriving Keys & Initializing...' : 'Create Vault'}
          </button>
        </form>
      </div>
    </div>
  );
};
