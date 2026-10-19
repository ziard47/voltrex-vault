import React from 'react';
import { Globe, Lock, AlertTriangle } from 'lucide-react';
import { isAllowedAutofillOrigin } from '../../../shared/origin';

interface OriginBarProps {
  origin: string | null;
  url: string;
}

export const OriginBar: React.FC<OriginBarProps> = ({ origin, url }) => {
  const isSecure = origin ? isAllowedAutofillOrigin(origin) : false;
  const isHttp = origin ? origin.startsWith('http:') && !origin.includes('localhost') && !origin.includes('127.0.0.1') : false;

  let displayHost = 'No active page';
  if (origin) {
    try {
      displayHost = new URL(origin).host;
    } catch {
      displayHost = origin;
    }
  } else if (url.startsWith('chrome://') || url.startsWith('edge://') || url.startsWith('about:')) {
    displayHost = 'Browser internal page';
  }

  return (
    <div className="px-4 py-2 bg-[#171a13] border-b border-[#3E432E]/70 flex items-center justify-between text-xs">
      <div className="flex items-center gap-1.5 truncate">
        {isHttp ? (
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        ) : isSecure ? (
          <Lock className="w-3.5 h-3.5 text-[#A7D129] shrink-0" />
        ) : (
          <Globe className="w-3.5 h-3.5 text-[#8e9c60] shrink-0" />
        )}
        <span className="font-mono text-neutral-200 truncate">{displayHost}</span>
      </div>

      {isHttp && (
        <span className="text-[10px] text-amber-400 font-medium tracking-tight bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-800/60">
          Insecure HTTP
        </span>
      )}
    </div>
  );
};
