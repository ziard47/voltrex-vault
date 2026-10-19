import React, { useState } from 'react';
import { useVault } from '../../context/VaultContext';
import {
  LoginPayload,
  NotePayload,
  CardPayload,
  IdentityPayload,
} from '../../../shared/types';
import {
  Star,
  Edit2,
  Trash2,
  RotateCcw,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Shield,
  Tag,
  Clock,
} from 'lucide-react';

export const EntryDetail: React.FC = () => {
  const {
    selectedEntry,
    openEditModal,
    deleteEntry,
    restoreEntry,
    toggleFavorite,
    copyToClipboard,
  } = useVault();

  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({});

  if (!selectedEntry) {
    return (
      <div className="flex-1 bg-[#050604] flex flex-col items-center justify-center text-vault-textMuted p-8 select-none">
        <div className="w-12 h-12 rounded bg-vault-surface border border-vault-border flex items-center justify-center mb-3 text-vault-olive">
          <Shield className="w-6 h-6" />
        </div>
        <p className="text-sm font-medium text-vault-textSecondary">No item selected</p>
        <p className="text-xs text-vault-textMuted mt-1">Select an entry from the list to inspect details</p>
      </div>
    );
  }

  const toggleVisibility = (fieldKey: string) => {
    setVisibleFields(prev => ({ ...prev, [fieldKey]: !prev[fieldKey] }));
  };

  const isFieldVisible = (fieldKey: string) => Boolean(visibleFields[fieldKey]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  const renderLoginFields = (p: LoginPayload) => (
    <div className="space-y-4">
      {p.url && (
        <div className="border border-vault-border rounded p-3 bg-vault-surface">
          <label className="text-[10px] uppercase tracking-wider text-vault-textMuted block font-semibold mb-1">
            Website URL
          </label>
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-vault-textPrimary truncate">{p.url}</span>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => copyToClipboard(p.url!, 'URL')}
                title="Copy URL"
                className="p-1.5 text-vault-textSecondary hover:text-vault-lime rounded transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                title="Open in Browser"
                className="p-1.5 text-vault-textSecondary hover:text-vault-lime rounded transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="border border-vault-border rounded p-3 bg-vault-surface">
        <label className="text-[10px] uppercase tracking-wider text-vault-textMuted block font-semibold mb-1">
          Username / Email
        </label>
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-vault-textPrimary select-text">{p.username || '—'}</span>
          {p.username && (
            <button
              onClick={() => copyToClipboard(p.username, 'Username')}
              title="Copy Username"
              className="p-1.5 text-vault-textSecondary hover:text-vault-lime rounded transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="border border-vault-border rounded p-3 bg-vault-surface">
        <label className="text-[10px] uppercase tracking-wider text-vault-textMuted block font-semibold mb-1">
          Password
        </label>
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-vault-textPrimary select-text">
            {isFieldVisible('login-pwd') ? p.password : '••••••••••••••••'}
          </span>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => toggleVisibility('login-pwd')}
              title={isFieldVisible('login-pwd') ? 'Hide password' : 'Show password'}
              className="p-1.5 text-vault-textSecondary hover:text-vault-lime rounded transition-colors"
            >
              {isFieldVisible('login-pwd') ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => copyToClipboard(p.password, 'Password')}
              title="Copy Password"
              className="p-1.5 text-vault-textSecondary hover:text-vault-lime rounded transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderNoteFields = (p: NotePayload) => (
    <div className="border border-vault-border rounded p-4 bg-vault-surface space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[10px] uppercase tracking-wider text-vault-textMuted font-semibold">
          Secure Note Content
        </label>
        <button
          onClick={() => copyToClipboard(p.content, 'Note content')}
          title="Copy full note"
          className="p-1 text-vault-textSecondary hover:text-vault-lime rounded transition-colors"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="text-xs text-vault-textPrimary whitespace-pre-wrap font-sans select-text leading-relaxed">
        {p.content || 'Empty note'}
      </div>
    </div>
  );

  const renderCardFields = (p: CardPayload) => (
    <div className="space-y-4">
      <div className="border border-vault-border rounded p-3 bg-vault-surface">
        <label className="text-[10px] uppercase tracking-wider text-vault-textMuted block font-semibold mb-1">
          Cardholder Name
        </label>
        <div className="flex items-center justify-between">
          <span className="text-xs text-vault-textPrimary select-text">{p.cardholderName || '—'}</span>
          {p.cardholderName && (
            <button
              onClick={() => copyToClipboard(p.cardholderName, 'Cardholder')}
              className="p-1.5 text-vault-textSecondary hover:text-vault-lime rounded transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="border border-vault-border rounded p-3 bg-vault-surface">
        <label className="text-[10px] uppercase tracking-wider text-vault-textMuted block font-semibold mb-1">
          Card Number
        </label>
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-vault-textPrimary select-text">
            {isFieldVisible('card-num') ? p.cardNumber : (p.cardNumber ? `•••• •••• •••• ${p.cardNumber.slice(-4)}` : '—')}
          </span>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => toggleVisibility('card-num')}
              className="p-1.5 text-vault-textSecondary hover:text-vault-lime rounded transition-colors"
            >
              {isFieldVisible('card-num') ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => copyToClipboard(p.cardNumber, 'Card Number')}
              className="p-1.5 text-vault-textSecondary hover:text-vault-lime rounded transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="border border-vault-border rounded p-3 bg-vault-surface">
          <label className="text-[10px] uppercase tracking-wider text-vault-textMuted block font-semibold mb-1">
            Expiration
          </label>
          <span className="text-xs font-mono text-vault-textPrimary">
            {p.expirationMonth ? `${p.expirationMonth} / ${p.expirationYear}` : '—'}
          </span>
        </div>
        <div className="border border-vault-border rounded p-3 bg-vault-surface">
          <label className="text-[10px] uppercase tracking-wider text-vault-textMuted block font-semibold mb-1">
            CVV / CVC
          </label>
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-vault-textPrimary">
              {isFieldVisible('card-cvv') ? p.cvv : '•••'}
            </span>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => toggleVisibility('card-cvv')}
                className="p-1.5 text-vault-textSecondary hover:text-vault-lime rounded transition-colors"
              >
                {isFieldVisible('card-cvv') ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => copyToClipboard(p.cvv, 'CVV')}
                className="p-1.5 text-vault-textSecondary hover:text-vault-lime rounded transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderIdentityFields = (p: IdentityPayload) => (
    <div className="space-y-4">
      <div className="border border-vault-border rounded p-3 bg-vault-surface">
        <label className="text-[10px] uppercase tracking-wider text-vault-textMuted block font-semibold mb-1">
          Full Name
        </label>
        <span className="text-xs text-vault-textPrimary select-text">{p.fullName || '—'}</span>
      </div>

      {p.email && (
        <div className="border border-vault-border rounded p-3 bg-vault-surface">
          <label className="text-[10px] uppercase tracking-wider text-vault-textMuted block font-semibold mb-1">
            Email
          </label>
          <div className="flex items-center justify-between">
            <span className="text-xs text-vault-textPrimary select-text">{p.email}</span>
            <button
              onClick={() => copyToClipboard(p.email!, 'Email')}
              className="p-1.5 text-vault-textSecondary hover:text-vault-lime rounded transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {p.phone && (
        <div className="border border-vault-border rounded p-3 bg-vault-surface">
          <label className="text-[10px] uppercase tracking-wider text-vault-textMuted block font-semibold mb-1">
            Phone
          </label>
          <span className="text-xs text-vault-textPrimary select-text">{p.phone}</span>
        </div>
      )}

      {p.address && (
        <div className="border border-vault-border rounded p-3 bg-vault-surface">
          <label className="text-[10px] uppercase tracking-wider text-vault-textMuted block font-semibold mb-1">
            Address
          </label>
          <span className="text-xs text-vault-textPrimary select-text whitespace-pre-wrap">{p.address}</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex-1 bg-[#050604] flex flex-col h-full overflow-y-auto select-none">
      {/* Top action header */}
      <div className="h-14 border-b border-vault-border px-6 flex items-center justify-between bg-[#080906] flex-shrink-0">
        <div className="flex items-center space-x-3">
          <h2 className="text-sm font-bold text-vault-textPrimary">{selectedEntry.title}</h2>
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-vault-border text-vault-lime font-mono">
            {selectedEntry.type}
          </span>
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={() => toggleFavorite(selectedEntry.id)}
            title={selectedEntry.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            className={`p-2 rounded hover:bg-vault-surface transition-colors ${
              selectedEntry.isFavorite ? 'text-vault-lime' : 'text-vault-textSecondary'
            }`}
          >
            <Star className="w-4 h-4 fill-current" />
          </button>

          {!selectedEntry.trashedAt ? (
            <>
              <button
                onClick={() => openEditModal(selectedEntry)}
                title="Edit item"
                className="p-2 text-vault-textSecondary hover:text-vault-textPrimary hover:bg-vault-surface rounded transition-colors"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => deleteEntry(selectedEntry.id, false)}
                title="Move to trash"
                className="p-2 text-vault-textSecondary hover:text-vault-danger hover:bg-vault-surface rounded transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => restoreEntry(selectedEntry.id)}
                title="Restore from trash"
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-vault-border hover:bg-vault-olive text-vault-textPrimary text-xs rounded transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore</span>
              </button>
              <button
                onClick={() => deleteEntry(selectedEntry.id, true)}
                title="Delete permanently"
                className="p-2 text-vault-danger hover:bg-vault-surface rounded transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main item details container */}
      <div className="p-6 max-w-2xl space-y-6">
        {selectedEntry.type === 'login' && renderLoginFields(selectedEntry.payload as LoginPayload)}
        {selectedEntry.type === 'note' && renderNoteFields(selectedEntry.payload as NotePayload)}
        {selectedEntry.type === 'card' && renderCardFields(selectedEntry.payload as CardPayload)}
        {selectedEntry.type === 'identity' && renderIdentityFields(selectedEntry.payload as IdentityPayload)}

        {/* Optional Notes */}
        {selectedEntry.payload.notes && (
          <div className="border border-vault-border rounded p-3 bg-vault-surface">
            <label className="text-[10px] uppercase tracking-wider text-vault-textMuted block font-semibold mb-1">
              Notes
            </label>
            <div className="text-xs text-vault-textSecondary whitespace-pre-wrap select-text">
              {selectedEntry.payload.notes}
            </div>
          </div>
        )}

        {/* Tags */}
        {selectedEntry.payload.tags && selectedEntry.payload.tags.length > 0 && (
          <div className="flex items-center space-x-2 pt-1">
            <Tag className="w-3.5 h-3.5 text-vault-textMuted" />
            <div className="flex flex-wrap gap-1.5">
              {selectedEntry.payload.tags.map(t => (
                <span
                  key={t}
                  className="text-[11px] bg-vault-border text-vault-textSecondary px-2 py-0.5 rounded font-mono"
                >
                  #{t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Timestamps */}
        <div className="pt-4 border-t border-vault-border flex items-center justify-between text-[11px] text-vault-textMuted">
          <div className="flex items-center space-x-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>Updated: {formatDate(selectedEntry.updatedAt)}</span>
          </div>
          <span>Created: {formatDate(selectedEntry.createdAt)}</span>
        </div>
      </div>
    </div>
  );
};
