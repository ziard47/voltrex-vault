import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Copy, Check, ArrowRight, ShieldCheck } from 'lucide-react';
import { PasswordGeneratorOptions } from '../../../shared/types';

interface PasswordGeneratorTabProps {
  onGenerate: (options: Partial<PasswordGeneratorOptions>) => Promise<{
    password: string;
    entropyBits: number;
    strengthLabel: string;
  } | null>;
  onFillPassword: (password: string) => Promise<boolean>;
  onCopy: (text: string) => void;
}

export const PasswordGeneratorTab: React.FC<PasswordGeneratorTabProps> = ({
  onGenerate,
  onFillPassword,
  onCopy,
}) => {
  const [length, setLength] = useState(20);
  const [includeUppercase, setIncludeUppercase] = useState(true);
  const [includeLowercase, setIncludeLowercase] = useState(true);
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeSymbols, setIncludeSymbols] = useState(true);
  const [password, setPassword] = useState('');
  const [entropyBits, setEntropyBits] = useState(0);
  const [strengthLabel, setStrengthLabel] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isFilled, setIsFilled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const generate = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await onGenerate({
        length,
        includeUppercase,
        includeLowercase,
        includeNumbers,
        includeSymbols,
      });
      if (res) {
        setPassword(res.password);
        setEntropyBits(res.entropyBits);
        setStrengthLabel(res.strengthLabel);
      }
    } finally {
      setIsLoading(false);
    }
  }, [length, includeUppercase, includeLowercase, includeNumbers, includeSymbols, onGenerate]);

  useEffect(() => {
    generate();
  }, [generate]);

  const handleCopy = () => {
    if (!password) return;
    onCopy(password);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleFill = async () => {
    if (!password) return;
    const ok = await onFillPassword(password);
    if (ok) {
      setIsFilled(true);
      setTimeout(() => setIsFilled(false), 2000);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Password display card */}
      <div className="p-3 bg-[#11130e] border border-[#3E432E] rounded-lg">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="font-mono text-sm font-bold text-white break-all tracking-wider select-all">
            {password || '...'}
          </span>
          <button
            onClick={generate}
            disabled={isLoading}
            title="Generate new"
            className="p-1 rounded text-[#8e9c60] hover:text-white hover:bg-[#3E432E] transition-colors shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Entropy indicator */}
        <div className="flex items-center justify-between text-[11px] pt-2 border-t border-[#252a1c]">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#A7D129]" />
            <span className="text-[#A7D129] font-medium">{strengthLabel || 'Strong'}</span>
          </div>
          <span className="text-neutral-400 font-mono">{entropyBits ? `${Math.round(entropyBits)} bits` : ''}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={handleCopy}
          className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-[#25281b] hover:bg-[#3E432E] border border-[#3E432E] rounded text-xs font-medium text-white transition-colors"
        >
          {isCopied ? <Check className="w-3.5 h-3.5 text-[#A7D129]" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{isCopied ? 'Copied!' : 'Copy'}</span>
        </button>

        <button
          onClick={handleFill}
          className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-[#A7D129] hover:bg-[#b8e62d] text-black rounded text-xs font-semibold transition-colors"
        >
          {isFilled ? <Check className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
          <span>{isFilled ? 'Filled!' : 'Fill into Page'}</span>
        </button>
      </div>

      {/* Length Slider */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1">
          <label className="text-neutral-300 font-medium">Length</label>
          <span className="font-mono font-semibold text-[#A7D129]">{length}</span>
        </div>
        <input
          type="range"
          min={8}
          max={64}
          value={length}
          onChange={(e) => setLength(Number(e.target.value))}
          className="w-full accent-[#A7D129] bg-[#3E432E] cursor-pointer"
        />
      </div>

      {/* Checkbox Options */}
      <div className="space-y-2 pt-2 border-t border-[#2a2f20] text-xs">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeUppercase}
            onChange={(e) => setIncludeUppercase(e.target.checked)}
            className="accent-[#A7D129] rounded"
          />
          <span className="text-neutral-300">Uppercase Letters (A-Z)</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeLowercase}
            onChange={(e) => setIncludeLowercase(e.target.checked)}
            className="accent-[#A7D129] rounded"
          />
          <span className="text-neutral-300">Lowercase Letters (a-z)</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeNumbers}
            onChange={(e) => setIncludeNumbers(e.target.checked)}
            className="accent-[#A7D129] rounded"
          />
          <span className="text-neutral-300">Numbers (0-9)</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeSymbols}
            onChange={(e) => setIncludeSymbols(e.target.checked)}
            className="accent-[#A7D129] rounded"
          />
          <span className="text-neutral-300">Symbols (!@#$%^&*)</span>
        </label>
      </div>
    </div>
  );
};
