import React from 'react';
import { useVault, CategoryFilter } from '../../context/VaultContext';
import {
  Shield,
  KeyRound,
  FileText,
  CreditCard,
  UserCheck,
  Star,
  Trash2,
  Plus,
  Dna,
  Settings as SettingsIcon,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const {
    entries,
    activeCategory,
    setActiveCategory,
    openCreateModal,
    openGenerator,
    openSettings,
    selectEntry,
  } = useVault();

  const activeEntries = entries.filter(e => !e.trashedAt);
  const trashedEntries = entries.filter(e => e.trashedAt);

  const counts: Record<CategoryFilter, number> = {
    all: activeEntries.length,
    login: activeEntries.filter(e => e.type === 'login').length,
    note: activeEntries.filter(e => e.type === 'note').length,
    card: activeEntries.filter(e => e.type === 'card').length,
    identity: activeEntries.filter(e => e.type === 'identity').length,
    favorites: activeEntries.filter(e => e.isFavorite).length,
    trash: trashedEntries.length,
  };

  const navItems: { id: CategoryFilter; label: string; icon: React.ReactNode }[] = [
    { id: 'all', label: 'All Items', icon: <Shield className="w-4 h-4" /> },
    { id: 'login', label: 'Logins', icon: <KeyRound className="w-4 h-4" /> },
    { id: 'note', label: 'Secure Notes', icon: <FileText className="w-4 h-4" /> },
    { id: 'card', label: 'Payment Cards', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'identity', label: 'Identities', icon: <UserCheck className="w-4 h-4" /> },
    { id: 'favorites', label: 'Favorites', icon: <Star className="w-4 h-4" /> },
    { id: 'trash', label: 'Trash', icon: <Trash2 className="w-4 h-4" /> },
  ];

  const handleSelectCategory = (cat: CategoryFilter) => {
    setActiveCategory(cat);
    selectEntry(null);
  };

  return (
    <aside className="w-60 bg-[#080906] border-r border-vault-border flex flex-col justify-between select-none">
      <div className="p-3 space-y-3">
        {/* Create Item Button */}
        <button
          onClick={() => openCreateModal()}
          className="w-full flex items-center justify-center space-x-2 bg-vault-lime hover:bg-vault-limeHover text-black font-semibold text-xs py-2 px-3 rounded transition-colors"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>New Item</span>
        </button>

        {/* Category Navigation */}
        <nav className="space-y-0.5">
          <div className="px-2 py-1 text-[10px] font-semibold tracking-wider text-vault-textMuted uppercase">
            Categories
          </div>
          {navItems.map(item => {
            const isActive = activeCategory === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectCategory(item.id)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors ${
                  isActive
                    ? 'bg-vault-border text-vault-lime font-medium'
                    : 'text-vault-textSecondary hover:bg-vault-surface hover:text-vault-textPrimary'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <span className={isActive ? 'text-vault-lime' : 'text-vault-textSecondary'}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                  isActive ? 'bg-[#000000] text-vault-lime' : 'text-vault-textMuted'
                }`}>
                  {counts[item.id]}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tools & Settings Footer */}
      <div className="p-3 border-t border-vault-border space-y-1">
        <button
          onClick={openGenerator}
          className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded text-xs text-vault-textSecondary hover:bg-vault-surface hover:text-vault-textPrimary transition-colors"
        >
          <Dna className="w-4 h-4 text-vault-olive" />
          <span>Password Generator</span>
        </button>
        <button
          onClick={openSettings}
          className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded text-xs text-vault-textSecondary hover:bg-vault-surface hover:text-vault-textPrimary transition-colors"
        >
          <SettingsIcon className="w-4 h-4 text-vault-olive" />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
};
