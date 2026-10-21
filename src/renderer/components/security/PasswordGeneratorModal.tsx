import React, { useState, useEffect, useCallback } from 'react';
import { useVault } from '../../context/VaultContext';
import { PasswordGeneratorOptions } from '../../../shared/types';
import { X, RefreshCw, Copy, ShieldCheck } from 'lucide-react';
import Slider from '@mui/material/Slider';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';

export const PasswordGeneratorModal: React.FC = () => {
  const { isGeneratorOpen, closeGenerator, generatePassword, copyToClipboard } = useVault();

  const [length, setLength] = useState(20);
  const [includeUppercase, setIncludeUppercase] = useState(true);
  const [includeLowercase, setIncludeLowercase] = useState(true);
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeSymbols, setIncludeSymbols] = useState(true);
  const [excludeAmbiguous, setExcludeAmbiguous] = useState(true);

  const [generatedPassword, setGeneratedPassword] = useState('');
  const [entropyBits, setEntropyBits] = useState(0);
  const [strengthLabel, setStrengthLabel] = useState<string>('Strong');

  const regenerate = useCallback(async () => {
    const opts: PasswordGeneratorOptions = {
      length,
      includeUppercase,
      includeLowercase,
      includeNumbers,
      includeSymbols,
      excludeAmbiguous,
    };
    try {
      const res = await generatePassword(opts);
      setGeneratedPassword(res.password);
      setEntropyBits(res.entropyBits);
      setStrengthLabel(res.strengthLabel);
    } catch {
      // Ignored
    }
  }, [length, includeUppercase, includeLowercase, includeNumbers, includeSymbols, excludeAmbiguous, generatePassword]);

  useEffect(() => {
    if (isGeneratorOpen) {
      regenerate();
    }
  }, [isGeneratorOpen, regenerate]);

  if (!isGeneratorOpen) return null;

  const handleCopy = () => {
    if (generatedPassword) {
      copyToClipboard(generatedPassword, 'Password');
    }
  };

  const getStrengthBadgeColor = (label: string) => {
    switch (label) {
      case 'Weak':
        return 'text-vault-danger bg-vault-danger/20 border-vault-danger/40';
      case 'Fair':
      case 'Good':
        return 'text-vault-warning bg-vault-warning/20 border-vault-warning/40';
      case 'Strong':
      case 'Very Strong':
      default:
        return 'text-vault-lime bg-vault-lime/20 border-vault-lime/40';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div className="bg-[#0c0d0a] border border-vault-border rounded w-full max-w-md select-none shadow-2xl">
        {/* Header */}
        <div className="h-12 border-b border-vault-border px-5 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-vault-lime" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-vault-textPrimary">
              Secure Password Generator
            </h3>
          </div>
          <button
            onClick={closeGenerator}
            className="p-1 text-vault-textSecondary hover:text-white rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {/* Output Display */}
          <div className="border border-vault-border rounded p-3 bg-black flex items-center justify-between">
            <span className="text-sm font-mono text-vault-lime select-text break-all">
              {generatedPassword || 'Generating...'}
            </span>
            <div className="flex items-center space-x-1 pl-2 flex-shrink-0">
              <button
                onClick={regenerate}
                title="Regenerate"
                className="p-1.5 text-vault-textSecondary hover:text-vault-lime rounded transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={handleCopy}
                title="Copy Password"
                className="p-1.5 text-vault-textSecondary hover:text-vault-lime rounded transition-colors"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Entropy & Strength Indicator */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-vault-textSecondary font-mono text-[11px]">
              Entropy: <span className="text-vault-textPrimary font-semibold">{entropyBits} bits</span>
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${getStrengthBadgeColor(strengthLabel)}`}>
              {strengthLabel}
            </span>
          </div>

          {/* Controls */}
          <div className="space-y-4 pt-2 border-t border-vault-border">
            {/* Length Slider */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-vault-textSecondary">Length</span>
                <span className="font-mono text-vault-lime font-bold">{length}</span>
              </div>
              <Slider
                min={8}
                max={64}
                value={length}
                onChange={(_, val) => setLength(val as number)}
                valueLabelDisplay="auto"
                sx={{ py: 1 }}
              />
            </div>

            {/* Checkbox Options */}
            <div className="grid grid-cols-2 gap-x-2 gap-y-1">
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeUppercase}
                    onChange={e => setIncludeUppercase(e.target.checked)}
                  />
                }
                label="Uppercase (A-Z)"
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeLowercase}
                    onChange={e => setIncludeLowercase(e.target.checked)}
                  />
                }
                label="Lowercase (a-z)"
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeNumbers}
                    onChange={e => setIncludeNumbers(e.target.checked)}
                  />
                }
                label="Numbers (0-9)"
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeSymbols}
                    onChange={e => setIncludeSymbols(e.target.checked)}
                  />
                }
                label="Symbols (!@#$%)"
              />

              <div className="col-span-2">
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={excludeAmbiguous}
                      onChange={e => setExcludeAmbiguous(e.target.checked)}
                    />
                  }
                  label="Exclude Ambiguous (0, O, 1, l, I)"
                />
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-vault-border">
            <button
              onClick={closeGenerator}
              className="px-4 py-2 rounded text-xs text-vault-textSecondary hover:text-vault-textPrimary hover:bg-vault-surface transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleCopy}
              className="px-4 py-2 rounded text-xs font-semibold bg-vault-lime hover:bg-vault-limeHover text-black transition-colors"
            >
              Copy to Clipboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
