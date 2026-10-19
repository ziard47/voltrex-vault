import React, { useState, useEffect } from 'react';
import { useVault } from '../../context/VaultContext';
import { EntryType, VaultEntryPayload } from '../../../shared/types';
import {
  X,
  KeyRound,
  FileText,
  CreditCard,
  UserCheck,
  Dna,
} from 'lucide-react';

export const EntryModal: React.FC = () => {
  const {
    isEntryModalOpen,
    editingEntry,
    defaultNewType,
    closeEntryModal,
    saveEntry,
    generatePassword,
  } = useVault();

  const [type, setType] = useState<EntryType>(defaultNewType);
  const [title, setTitle] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [tagsInput, setTagsInput] = useState('');
  const [notes, setNotes] = useState('');

  // Login
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [url, setUrl] = useState('');

  // Note
  const [content, setContent] = useState('');

  // Card
  const [cardholderName, setCardholderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expirationMonth, setExpirationMonth] = useState('');
  const [expirationYear, setExpirationYear] = useState('');
  const [cvv, setCvv] = useState('');
  const [pin, setPin] = useState('');

  // Identity
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [company, setCompany] = useState('');
  const [nationalId, setNationalId] = useState('');

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingEntry) {
      setType(editingEntry.type);
      setTitle(editingEntry.title);
      setIsFavorite(editingEntry.isFavorite);
      setTagsInput(editingEntry.payload.tags?.join(', ') ?? '');
      setNotes(editingEntry.payload.notes ?? '');

      const p = editingEntry.payload as any;
      if (editingEntry.type === 'login') {
        setUsername(p.username ?? '');
        setPassword(p.password ?? '');
        setUrl(p.url ?? '');
      } else if (editingEntry.type === 'note') {
        setContent(p.content ?? '');
      } else if (editingEntry.type === 'card') {
        setCardholderName(p.cardholderName ?? '');
        setCardNumber(p.cardNumber ?? '');
        setExpirationMonth(p.expirationMonth ?? '');
        setExpirationYear(p.expirationYear ?? '');
        setCvv(p.cvv ?? '');
        setPin(p.pin ?? '');
      } else if (editingEntry.type === 'identity') {
        setFullName(p.fullName ?? '');
        setEmail(p.email ?? '');
        setPhone(p.phone ?? '');
        setAddress(p.address ?? '');
        setCompany(p.company ?? '');
        setNationalId(p.nationalId ?? '');
      }
    } else {
      setType(defaultNewType);
      setTitle('');
      setIsFavorite(false);
      setTagsInput('');
      setNotes('');
      setUsername('');
      setPassword('');
      setUrl('');
      setContent('');
      setCardholderName('');
      setCardNumber('');
      setExpirationMonth('');
      setExpirationYear('');
      setCvv('');
      setPin('');
      setFullName('');
      setEmail('');
      setPhone('');
      setAddress('');
      setCompany('');
      setNationalId('');
    }
    setError(null);
  }, [editingEntry, defaultNewType, isEntryModalOpen]);

  if (!isEntryModalOpen) return null;

  const handleQuickGeneratePassword = async () => {
    try {
      const res = await generatePassword({ length: 20 });
      setPassword(res.password);
    } catch {
      // Ignored
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }

    const tags = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    let payload: VaultEntryPayload;

    if (type === 'login') {
      payload = {
        type: 'login',
        title: title.trim(),
        username: username.trim(),
        password,
        url: url.trim() || undefined,
        tags,
        notes: notes.trim() || undefined,
      };
    } else if (type === 'note') {
      payload = {
        type: 'note',
        title: title.trim(),
        content,
        tags,
        notes: notes.trim() || undefined,
      };
    } else if (type === 'card') {
      payload = {
        type: 'card',
        title: title.trim(),
        cardholderName: cardholderName.trim(),
        cardNumber: cardNumber.trim(),
        expirationMonth: expirationMonth.trim(),
        expirationYear: expirationYear.trim(),
        cvv: cvv.trim(),
        pin: pin.trim() || undefined,
        tags,
        notes: notes.trim() || undefined,
      };
    } else {
      payload = {
        type: 'identity',
        title: title.trim(),
        fullName: fullName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        company: company.trim() || undefined,
        nationalId: nationalId.trim() || undefined,
        tags,
        notes: notes.trim() || undefined,
      };
    }

    try {
      await saveEntry({
        id: editingEntry?.id,
        type,
        title: title.trim(),
        isFavorite,
        payload,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to save item.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div className="bg-[#0c0d0a] border border-vault-border rounded w-full max-w-xl max-h-[90vh] flex flex-col select-none shadow-2xl">
        {/* Modal Header */}
        <div className="h-12 border-b border-vault-border px-5 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-vault-textPrimary">
            {editingEntry ? 'Edit Entry' : 'Create New Entry'}
          </h3>
          <button
            onClick={closeEntryModal}
            className="p-1 text-vault-textSecondary hover:text-white rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="p-2.5 rounded bg-vault-danger/20 border border-vault-danger/40 text-vault-danger text-xs">
              {error}
            </div>
          )}

          {/* Type Selector Tabs (Only when creating new) */}
          {!editingEntry && (
            <div>
              <label className="text-[10px] uppercase tracking-wider text-vault-textMuted block font-semibold mb-1.5">
                Item Type
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {(
                  [
                    { id: 'login', label: 'Login', icon: <KeyRound className="w-3.5 h-3.5" /> },
                    { id: 'note', label: 'Note', icon: <FileText className="w-3.5 h-3.5" /> },
                    { id: 'card', label: 'Card', icon: <CreditCard className="w-3.5 h-3.5" /> },
                    { id: 'identity', label: 'Identity', icon: <UserCheck className="w-3.5 h-3.5" /> },
                  ] as const
                ).map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setType(tab.id)}
                    className={`flex items-center justify-center space-x-1.5 py-1.5 px-2 rounded text-xs transition-colors ${
                      type === tab.id
                        ? 'bg-vault-border text-vault-lime font-medium'
                        : 'bg-vault-surface text-vault-textSecondary hover:text-vault-textPrimary'
                    }`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-vault-textMuted block font-semibold mb-1">
              Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. GitHub, Work WiFi, Personal ID"
              className="w-full bg-black border border-vault-border text-xs rounded px-3 py-2 text-vault-textPrimary focus:outline-none focus:border-vault-lime transition-colors"
            />
          </div>

          {/* Login Fields */}
          {type === 'login' && (
            <div className="space-y-3 pt-1">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-vault-textMuted block font-semibold mb-1">
                  Website URL
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full bg-black border border-vault-border text-xs rounded px-3 py-2 text-vault-textPrimary focus:outline-none focus:border-vault-lime transition-colors"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-vault-textMuted block font-semibold mb-1">
                  Username or Email
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full bg-black border border-vault-border text-xs rounded px-3 py-2 text-vault-textPrimary focus:outline-none focus:border-vault-lime transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] uppercase tracking-wider text-vault-textMuted font-semibold">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={handleQuickGeneratePassword}
                    className="flex items-center space-x-1 text-[11px] text-vault-lime hover:underline"
                  >
                    <Dna className="w-3 h-3" />
                    <span>Generate Secure</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter or generate password"
                  className="w-full bg-black border border-vault-border text-xs font-mono rounded px-3 py-2 text-vault-textPrimary focus:outline-none focus:border-vault-lime transition-colors"
                />
              </div>
            </div>
          )}

          {/* Note Fields */}
          {type === 'note' && (
            <div className="pt-1">
              <label className="text-[10px] uppercase tracking-wider text-vault-textMuted block font-semibold mb-1">
                Note Content
              </label>
              <textarea
                rows={6}
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Secure markdown notes, recovery keys, server configurations..."
                className="w-full bg-black border border-vault-border text-xs font-mono rounded px-3 py-2 text-vault-textPrimary focus:outline-none focus:border-vault-lime transition-colors resize-none leading-relaxed"
              />
            </div>
          )}

          {/* Card Fields */}
          {type === 'card' && (
            <div className="space-y-3 pt-1">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-vault-textMuted block font-semibold mb-1">
                  Cardholder Name
                </label>
                <input
                  type="text"
                  value={cardholderName}
                  onChange={e => setCardholderName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full bg-black border border-vault-border text-xs rounded px-3 py-2 text-vault-textPrimary focus:outline-none focus:border-vault-lime transition-colors"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-vault-textMuted block font-semibold mb-1">
                  Card Number
                </label>
                <input
                  type="text"
                  value={cardNumber}
                  onChange={e => setCardNumber(e.target.value)}
                  placeholder="4000 1234 5678 9010"
                  className="w-full bg-black border border-vault-border text-xs font-mono rounded px-3 py-2 text-vault-textPrimary focus:outline-none focus:border-vault-lime transition-colors"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-vault-textMuted block font-semibold mb-1">
                    Month
                  </label>
                  <input
                    type="text"
                    maxLength={2}
                    value={expirationMonth}
                    onChange={e => setExpirationMonth(e.target.value)}
                    placeholder="12"
                    className="w-full bg-black border border-vault-border text-xs font-mono rounded px-3 py-2 text-vault-textPrimary focus:outline-none focus:border-vault-lime transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-vault-textMuted block font-semibold mb-1">
                    Year
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={expirationYear}
                    onChange={e => setExpirationYear(e.target.value)}
                    placeholder="2028"
                    className="w-full bg-black border border-vault-border text-xs font-mono rounded px-3 py-2 text-vault-textPrimary focus:outline-none focus:border-vault-lime transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-vault-textMuted block font-semibold mb-1">
                    CVV
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={cvv}
                    onChange={e => setCvv(e.target.value)}
                    placeholder="123"
                    className="w-full bg-black border border-vault-border text-xs font-mono rounded px-3 py-2 text-vault-textPrimary focus:outline-none focus:border-vault-lime transition-colors"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Identity Fields */}
          {type === 'identity' && (
            <div className="space-y-3 pt-1">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-vault-textMuted block font-semibold mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Jane Doe"
                  className="w-full bg-black border border-vault-border text-xs rounded px-3 py-2 text-vault-textPrimary focus:outline-none focus:border-vault-lime transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-vault-textMuted block font-semibold mb-1">
                    Email
                  </label>
                  <input
                    type="text"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="jane@example.com"
                    className="w-full bg-black border border-vault-border text-xs rounded px-3 py-2 text-vault-textPrimary focus:outline-none focus:border-vault-lime transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-vault-textMuted block font-semibold mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+1 555-0199"
                    className="w-full bg-black border border-vault-border text-xs rounded px-3 py-2 text-vault-textPrimary focus:outline-none focus:border-vault-lime transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-vault-textMuted block font-semibold mb-1">
                  Physical Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="123 Market St, Suite 400"
                  className="w-full bg-black border border-vault-border text-xs rounded px-3 py-2 text-vault-textPrimary focus:outline-none focus:border-vault-lime transition-colors"
                />
              </div>
            </div>
          )}

          {/* Tags & Favorite */}
          <div className="pt-2 border-t border-vault-border space-y-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-vault-textMuted block font-semibold mb-1">
                Tags (comma separated)
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={e => setTagsInput(e.target.value)}
                placeholder="personal, banking, work"
                className="w-full bg-black border border-vault-border text-xs rounded px-3 py-2 text-vault-textPrimary focus:outline-none focus:border-vault-lime transition-colors"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-vault-textMuted block font-semibold mb-1">
                Internal Notes
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Additional notes or security hints..."
                className="w-full bg-black border border-vault-border text-xs rounded px-3 py-2 text-vault-textPrimary focus:outline-none focus:border-vault-lime transition-colors resize-none"
              />
            </div>

            <label className="flex items-center space-x-2 text-xs text-vault-textSecondary cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={isFavorite}
                onChange={e => setIsFavorite(e.target.checked)}
                className="rounded border-vault-border text-vault-lime focus:ring-0 bg-black"
              />
              <span>Add to Favorites</span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-2 pt-4 border-t border-vault-border">
            <button
              type="button"
              onClick={closeEntryModal}
              className="px-4 py-2 rounded text-xs text-vault-textSecondary hover:text-vault-textPrimary hover:bg-vault-surface transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded text-xs font-semibold bg-vault-lime hover:bg-vault-limeHover text-black transition-colors"
            >
              Save Item
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
