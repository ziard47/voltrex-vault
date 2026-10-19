import React, { useState } from 'react';
import { KeyRound, Eye, EyeOff, Check, X, ShieldAlert } from 'lucide-react';
import { CandidateLoginState } from '../types';

interface SaveCandidateCardProps {
  candidate: CandidateLoginState;
  onSave: (candidate: CandidateLoginState) => Promise<boolean>;
  onDismiss: () => void;
}

export const SaveCandidateCard: React.FC<SaveCandidateCardProps> = ({
  candidate,
  onSave,
  onDismiss,
}) => {
  const [username, setUsername] = useState(candidate.username);
  const [password, setPassword] = useState(candidate.password);
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  let host = candidate.origin;
  try {
    host = new URL(candidate.origin).hostname;
  } catch {}

  const handleSave = async () => {
    if (!password) {
      setError('Password cannot be empty.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const ok = await onSave({
        ...candidate,
        username,
        password,
      });
      if (!ok) {
        setError('Failed to save to desktop vault.');
      }
    } catch (err: any) {
      setError(err.message || 'Error saving login.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-4 my-2 p-3 bg-[#1e2316] border border-[#616F39] rounded-lg shadow-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <KeyRound className="w-3.5 h-3.5 text-[#A7D129]" />
          <span className="text-xs font-semibold text-white">Save Login for {host}?</span>
        </div>
        <button
          onClick={onDismiss}
          className="text-neutral-400 hover:text-white p-0.5 rounded transition-colors"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-2 mb-3">
        <div>
          <label className="block text-[10px] uppercase font-mono text-[#8e9c60] mb-0.5">
            Username / Email
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            className="w-full bg-[#11130e] border border-[#3E432E] focus:border-[#A7D129] px-2 py-1 rounded text-xs text-white outline-none font-mono"
          />
        </div>

        <div>
          <label className="block text-[10px] uppercase font-mono text-[#8e9c60] mb-0.5">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#11130e] border border-[#3E432E] focus:border-[#A7D129] px-2 py-1 pr-7 rounded text-xs text-white outline-none font-mono"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
            >
              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-1 text-[11px] text-red-400 mb-2">
          <ShieldAlert className="w-3 h-3 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onDismiss}
          disabled={isSaving}
          className="px-2.5 py-1 text-xs text-neutral-400 hover:text-white transition-colors"
        >
          Not Now
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-1 px-3 py-1 bg-[#A7D129] hover:bg-[#b8e62d] text-black font-semibold text-xs rounded transition-colors disabled:opacity-50"
        >
          <Check className="w-3.5 h-3.5" />
          <span>{isSaving ? 'Saving...' : 'Save to Vault'}</span>
        </button>
      </div>
    </div>
  );
};
