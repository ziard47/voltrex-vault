import React from 'react';
import { Shield, Lock, RefreshCw } from 'lucide-react';
import { VaultConnectionState } from '../types';

interface HeaderProps {
  status: VaultConnectionState;
  onLockVault: () => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  onLockVault,
  onRefresh,
  isLoading,
}) => {
  return (
    <header className="flex items-center justify-between px-3.5 py-2.5 bg-[#0f110c] border-b border-[#2a2f20] shrink-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded bg-[#1e2316] flex items-center justify-center border border-[#616F39]/50 shrink-0">
          <Shield className="w-4 h-4 text-[#A7D129]" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xs font-bold tracking-wider text-white uppercase whitespace-nowrap">
            VOLTREX VAULT
          </h1>
          <div className="flex items-center gap-1.5 text-[10px] mt-0.5">
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                !status.isAppRunning
                  ? 'bg-neutral-500'
                  : status.isUnlocked
                  ? 'bg-[#A7D129]'
                  : 'bg-amber-400'
              }`}
            />
            <span className="text-[#8e9c60] font-mono uppercase whitespace-nowrap text-[9px] tracking-wide">
              {!status.isAppRunning
                ? 'Desktop Closed'
                : status.isUnlocked
                ? 'Vault Unlocked'
                : 'Vault Locked'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={onRefresh}
          disabled={isLoading}
          title="Refresh status"
          className="p-1.5 rounded text-[#8e9c60] hover:text-white hover:bg-[#3E432E] transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>

        {status.isAppRunning && status.isUnlocked && (
          <button
            onClick={onLockVault}
            title="Lock Vault"
            className="flex items-center gap-1 px-2 py-1 rounded bg-[#25281b] hover:bg-[#3E432E] border border-[#3E432E] hover:border-[#616F39] text-[11px] font-medium text-neutral-300 hover:text-white transition-all"
          >
            <Lock className="w-3 h-3 text-[#A7D129]" />
            <span>Lock</span>
          </button>
        )}
      </div>
    </header>
  );
};
