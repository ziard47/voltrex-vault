import React from 'react';
import { useVault } from '../../context/VaultContext';
import { VaultEntry, EntryType } from '../../../shared/types';
import {
  KeyRound,
  FileText,
  CreditCard,
  UserCheck,
  Star,
  Plus,
} from 'lucide-react';

export const EntryList: React.FC = () => {
  const {
    filteredEntries,
    selectedEntry,
    selectEntry,
    toggleFavorite,
    searchQuery,
    activeCategory,
    openCreateModal,
  } = useVault();

  const getIcon = (type: EntryType) => {
    switch (type) {
      case 'login':
        return <KeyRound className="w-3.5 h-3.5 text-vault-olive" />;
      case 'note':
        return <FileText className="w-3.5 h-3.5 text-vault-olive" />;
      case 'card':
        return <CreditCard className="w-3.5 h-3.5 text-vault-olive" />;
      case 'identity':
        return <UserCheck className="w-3.5 h-3.5 text-vault-olive" />;
    }
  };

  const getSubtitle = (entry: VaultEntry): string => {
    switch (entry.type) {
      case 'login':
        return (entry.payload as any).username || (entry.payload as any).url || 'No username';
      case 'note':
        return (entry.payload as any).content?.slice(0, 40) || 'Empty note';
      case 'card': {
        const num = (entry.payload as any).cardNumber || '';
        return num.length > 4 ? `•••• ${num.slice(-4)}` : 'Card';
      }
      case 'identity':
        return (entry.payload as any).fullName || (entry.payload as any).email || 'Identity';
    }
  };

  return (
    <div className="w-80 border-r border-vault-border bg-vault-black flex flex-col h-full select-none">
      {/* Header bar */}
      <div className="h-9 border-b border-vault-border px-3 flex items-center justify-between bg-[#080906]">
        <span className="text-xs font-semibold text-vault-textSecondary uppercase tracking-wider">
          {activeCategory} ({filteredEntries.length})
        </span>
      </div>

      {/* List content */}
      <div className="flex-1 overflow-y-auto divide-y divide-vault-border">
        {filteredEntries.length === 0 ? (
          <div className="p-6 text-center text-vault-textMuted space-y-2">
            <p className="text-xs">
              {searchQuery ? `No items found matching "${searchQuery}"` : `No items in ${activeCategory}`}
            </p>
            {activeCategory !== 'trash' && !searchQuery && (
              <button
                onClick={() => openCreateModal()}
                className="inline-flex items-center space-x-1 text-xs text-vault-lime hover:underline pt-2"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create an item</span>
              </button>
            )}
          </div>
        ) : (
          filteredEntries.map(entry => {
            const isSelected = selectedEntry?.id === entry.id;
            return (
              <div
                key={entry.id}
                onClick={() => selectEntry(entry)}
                className={`p-3 cursor-pointer flex items-start justify-between space-x-2 transition-colors ${
                  isSelected
                    ? 'bg-vault-surfaceActive border-l-2 border-vault-lime'
                    : 'hover:bg-vault-surface'
                }`}
              >
                <div className="flex items-start space-x-2.5 min-w-0">
                  <div className="mt-0.5 p-1 rounded bg-vault-border flex-shrink-0">
                    {getIcon(entry.type)}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-medium text-vault-textPrimary truncate">
                      {entry.title}
                    </h4>
                    <p className="text-[11px] text-vault-textSecondary truncate">
                      {getSubtitle(entry)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-1 flex-shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(entry.id);
                    }}
                    title={entry.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    className={`p-1 rounded hover:bg-vault-border transition-colors ${
                      entry.isFavorite ? 'text-vault-lime' : 'text-vault-textMuted hover:text-vault-textSecondary'
                    }`}
                  >
                    <Star className="w-3.5 h-3.5 fill-current" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
