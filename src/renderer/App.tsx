import React, { useEffect } from 'react';
import { useVault } from './context/VaultContext';
import { TitleBar } from './components/layout/TitleBar';
import { Sidebar } from './components/layout/Sidebar';
import { EntryList } from './components/entries/EntryList';
import { EntryDetail } from './components/entries/EntryDetail';
import { SetupModal } from './components/modals/SetupModal';
import { UnlockModal } from './components/modals/UnlockModal';
import { EntryModal } from './components/entries/EntryModal';
import { PasswordGeneratorModal } from './components/security/PasswordGeneratorModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { RestoreConfirmModal } from './components/modals/RestoreConfirmModal';
import { ToastContainer } from './components/common/ToastContainer';

export const App: React.FC = () => {
  const {
    status,
    lockVault,
    openCreateModal,
    openGenerator,
    closeEntryModal,
    closeGenerator,
    closeSettings,
  } = useVault();

  // Desktop Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+L or Cmd+L -> Lock Vault
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        if (status.isUnlocked) {
          lockVault();
        }
      }
      // Ctrl+N or Cmd+N -> New Item
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        if (status.isUnlocked) {
          openCreateModal();
        }
      }
      // Ctrl+G or Cmd+G -> Password Generator
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        openGenerator();
      }
      // Escape -> Close Modals
      if (e.key === 'Escape') {
        closeEntryModal();
        closeGenerator();
        closeSettings();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status.isUnlocked, lockVault, openCreateModal, openGenerator, closeEntryModal, closeGenerator, closeSettings]);

  return (
    <div className="h-screen w-screen flex flex-col bg-vault-black overflow-hidden font-sans">
      {/* Top draggable desktop bar */}
      <TitleBar />

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden">
        {status.isUnlocked ? (
          <>
            <Sidebar />
            <EntryList />
            <EntryDetail />
          </>
        ) : (
          <div className="flex-1 bg-vault-black flex items-center justify-center" />
        )}
      </main>

      {/* Onboarding & Authentication Modals */}
      <SetupModal />
      <UnlockModal />

      {/* Item & Feature Modals */}
      <EntryModal />
      <PasswordGeneratorModal />
      <SettingsModal />
      <RestoreConfirmModal />

      {/* Feedback Notifications */}
      <ToastContainer />
    </div>
  );
};
