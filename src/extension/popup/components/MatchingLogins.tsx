import React, { useState } from 'react';
import { Search, KeyRound, Copy, Check, ArrowRight, Lock, ShieldAlert } from 'lucide-react';
import { MatchedLoginSummary } from '../../../shared/extension-types';
import { VaultConnectionState } from '../types';

interface MatchingLoginsProps {
  status: VaultConnectionState;
  origin: string | null;
  logins: MatchedLoginSummary[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onFill: (login: MatchedLoginSummary) => Promise<boolean>;
  onCopyUsername: (username: string) => void;
  onCopyPassword: (loginId: string) => Promise<void>;
  isLoading: boolean;
  onRefresh?: () => void;
}

export const MatchingLogins: React.FC<MatchingLoginsProps> = ({
  status,
  origin,
  logins,
  searchQuery,
  onSearchChange,
  onFill,
  onCopyUsername,
  onCopyPassword,
  isLoading,
  onRefresh,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleCopyUser = (username: string, id: string) => {
    onCopyUsername(username);
    setCopiedId(`user-${id}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyPass = async (id: string) => {
    setActionError(null);
    try {
      await onCopyPassword(id);
      setCopiedId(`pass-${id}`);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to copy password.');
    }
  };

  const handleFill = async (login: MatchedLoginSummary) => {
    setActionError(null);
    try {
      const ok = await onFill(login);
      if (!ok) {
        setActionError('No login fields found on this page.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to fill credentials.');
    }
  };

  // 1. Desktop app not running state
  if (!status.isAppRunning) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-[360px] text-center">
        <div className="w-full max-w-[320px] bg-[#12150e] border border-[#2e3422] rounded-xl p-5 shadow-lg flex flex-col items-center">
          <div className="w-12 h-12 rounded-xl bg-[#1e2316] border border-[#616F39]/50 flex items-center justify-center mb-3">
            <ShieldAlert className="w-6 h-6 text-[#A7D129]" />
          </div>
          <h2 className="text-sm font-semibold text-white mb-1.5">Desktop Vault Not Connected</h2>
          <p className="text-xs text-[#a2a894] leading-relaxed mb-4">
            Launch the Voltrex Vault desktop app and unlock your vault to access credentials on this page.
          </p>

          <div className="w-full bg-[#0a0c08] border border-[#23281a] rounded-lg p-2.5 text-left mb-4 space-y-1">
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#616F39]">Connection Checklist:</div>
            <div className="text-[11px] text-neutral-300 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3E432E]" />
              <span>1. Open Voltrex Vault desktop app</span>
            </div>
            <div className="text-[11px] text-neutral-300 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3E432E]" />
              <span>2. Enter your master password</span>
            </div>
          </div>

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="w-full py-2 px-3 bg-[#202517] hover:bg-[#2d3420] border border-[#3E432E] hover:border-[#616F39] text-xs font-semibold text-white rounded-lg transition-all flex items-center justify-center gap-2"
            >
              <KeyRound className="w-3.5 h-3.5 text-[#A7D129]" />
              <span>Check Connection</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // 2. Vault locked state
  if (!status.isUnlocked) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-[360px] text-center">
        <div className="w-full max-w-[320px] bg-[#14130c] border border-[#423616] rounded-xl p-5 shadow-lg flex flex-col items-center">
          <div className="w-12 h-12 rounded-xl bg-[#26200f] border border-amber-600/50 flex items-center justify-center mb-3">
            <Lock className="w-6 h-6 text-amber-400" />
          </div>
          <h2 className="text-sm font-semibold text-white mb-1.5">Vault is Locked</h2>
          <p className="text-xs text-[#a2a894] leading-relaxed mb-4">
            Enter your master password in the Voltrex Vault desktop app to access your passwords.
          </p>

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="w-full py-2 px-3 bg-[#241f11] hover:bg-[#332c18] border border-amber-800/60 text-xs font-semibold text-amber-300 rounded-lg transition-all flex items-center justify-center gap-2"
            >
              <span>Refresh Vault Status</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={origin ? `Search vault or ${new URL(origin).hostname}...` : 'Search vault...'}
          className="w-full bg-[#11130e] border border-[#3E432E] focus:border-[#A7D129] pl-8 pr-3 py-1.5 rounded text-xs text-white placeholder-neutral-500 outline-none transition-colors"
        />
      </div>

      {actionError && (
        <div className="p-2 bg-red-950/40 border border-red-800/60 rounded text-[11px] text-red-300 flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Logins List */}
      {isLoading ? (
        <div className="py-8 text-center text-xs text-[#8e9c60]">Loading credentials...</div>
      ) : logins.length === 0 ? (
        <div className="py-8 text-center">
          <KeyRound className="w-8 h-8 text-[#3E432E] mx-auto mb-2" />
          <p className="text-xs text-neutral-400">
            {searchQuery ? 'No credentials match your search.' : 'No saved logins for this domain.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {logins.map((login) => (
            <div
              key={login.id}
              className="p-3 bg-[#171a13] hover:bg-[#1d2117] border border-[#3E432E] rounded-lg transition-colors group"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="truncate">
                  <h3 className="text-xs font-semibold text-white truncate">{login.title}</h3>
                  <p className="text-[11px] text-[#8e9c60] font-mono truncate">{login.username || 'No username'}</p>
                </div>
                <button
                  onClick={() => handleFill(login)}
                  title="Autofill this login into page"
                  className="flex items-center gap-1 px-2.5 py-1 bg-[#A7D129] hover:bg-[#b8e62d] text-black font-semibold text-[11px] rounded transition-colors shrink-0"
                >
                  <span>Fill</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-[#2a2f20]">
                {login.username && (
                  <button
                    onClick={() => handleCopyUser(login.username, login.id)}
                    className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white transition-colors"
                  >
                    {copiedId === `user-${login.id}` ? (
                      <>
                        <Check className="w-3 h-3 text-[#A7D129]" />
                        <span className="text-[#A7D129]">User Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy User</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  onClick={() => handleCopyPass(login.id)}
                  className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white transition-colors ml-auto"
                >
                  {copiedId === `pass-${login.id}` ? (
                    <>
                      <Check className="w-3 h-3 text-[#A7D129]" />
                      <span className="text-[#A7D129]">Password Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Password</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
