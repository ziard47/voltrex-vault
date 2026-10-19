import React from 'react';
import { Wrench, CheckCircle2, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { VaultConnectionState } from '../types';

interface DiagnosticsTabProps {
  status: VaultConnectionState;
  activeOrigin: string | null;
  onTestConnection: () => void;
  isLoading: boolean;
}

export const DiagnosticsTab: React.FC<DiagnosticsTabProps> = ({
  status,
  activeOrigin,
  onTestConnection,
  isLoading,
}) => {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-white tracking-wide uppercase flex items-center gap-1.5">
          <Wrench className="w-3.5 h-3.5 text-[#A7D129]" />
          <span>System Diagnostics</span>
        </h2>
        <button
          onClick={onTestConnection}
          disabled={isLoading}
          className="flex items-center gap-1 px-2 py-1 bg-[#25281b] hover:bg-[#3E432E] border border-[#3E432E] rounded text-[11px] font-medium text-neutral-300 hover:text-white transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Test</span>
        </button>
      </div>

      {/* Status Matrix */}
      <div className="space-y-2 bg-[#11130e] border border-[#3E432E] rounded-lg p-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-neutral-400">Desktop Process</span>
          <div className="flex items-center gap-1 font-mono">
            {status.isAppRunning ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-[#A7D129]" />
                <span className="text-[#A7D129]">Running</span>
              </>
            ) : (
              <>
                <XCircle className="w-3.5 h-3.5 text-neutral-500" />
                <span className="text-neutral-500">Not Running</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-neutral-400">Desktop Vault</span>
          <div className="flex items-center gap-1 font-mono">
            {!status.isAppRunning ? (
              <span className="text-neutral-500">Offline</span>
            ) : status.isUnlocked ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-[#A7D129]" />
                <span className="text-[#A7D129]">Unlocked</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-amber-400">Locked</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-neutral-400">Native Messaging Host</span>
          <span className="font-mono text-[#8e9c60] text-[11px]">com.voltrex.vault</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-neutral-400">Active Tab Origin</span>
          <span className="font-mono text-neutral-300 text-[11px] truncate max-w-[180px]">
            {activeOrigin || 'None'}
          </span>
        </div>
      </div>

      {status.error && (
        <div className="p-2.5 bg-red-950/40 border border-red-800/60 rounded text-[11px] text-red-300">
          {status.error}
        </div>
      )}

      {/* Troubleshooting guide */}
      <div className="text-[11px] text-neutral-400 space-y-1.5 pt-2 border-t border-[#2a2f20]">
        <p className="font-medium text-neutral-300">Native Host Registration:</p>
        <p>
          Run <code className="text-[#A7D129] font-mono">npm run register:host</code> in the Voltrex Vault project directory to register the native messaging host manifest for your browser.
        </p>
      </div>
    </div>
  );
};
