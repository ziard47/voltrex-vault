import React, { useState, useEffect, useCallback } from 'react';
import { Shield, KeyRound, Wrench } from 'lucide-react';
import { Header } from './components/Header';
import { OriginBar } from './components/OriginBar';
import { MatchingLogins } from './components/MatchingLogins';
import { SaveCandidateCard } from './components/SaveCandidateCard';
import { PasswordGeneratorTab } from './components/PasswordGeneratorTab';
import { DiagnosticsTab } from './components/DiagnosticsTab';
import {
  ActiveTabState,
  CandidateLoginState,
  PopupTab,
  VaultConnectionState,
} from './types';
import {
  MatchedLoginSummary,
  NativeResponse,
  SaveLoginRequest,
} from '../../shared/extension-types';
import { PasswordGeneratorOptions } from '../../shared/types';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<PopupTab>('vault');
  const [activeTabInfo, setActiveTabInfo] = useState<ActiveTabState | null>(null);
  const [candidate, setCandidate] = useState<CandidateLoginState | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<VaultConnectionState>({
    isAppRunning: false,
    isUnlocked: false,
    isHostConnected: false,
  });
  const [logins, setLogins] = useState<MatchedLoginSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Send message to background service worker with typed response
  const sendBackgroundMessage = useCallback(<T = any>(message: any): Promise<T> => {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        resolve(response);
      });
    });
  }, []);

  // Refresh status and active tab information
  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Get active tab info
      const tabInfo = await sendBackgroundMessage<ActiveTabState | null>({
        type: 'GET_ACTIVE_TAB_INFO',
      });
      setActiveTabInfo(tabInfo);

      // 2. Query status from desktop via background
      const statusRes = await sendBackgroundMessage<NativeResponse>({
        type: 'GET_STATUS',
      });

      if (statusRes && statusRes.success && statusRes.data) {
        setConnectionStatus({
          isAppRunning: !!statusRes.data.isAppRunning,
          isUnlocked: !!statusRes.data.isUnlocked,
          isHostConnected: true,
          error: undefined,
        });
      } else {
        setConnectionStatus({
          isAppRunning: false,
          isUnlocked: false,
          isHostConnected: false,
          error: statusRes?.error || 'Cannot connect to native host.',
        });
      }

      // 3. Check for candidate login if tab exists
      if (tabInfo?.tabId) {
        const candidateData = await sendBackgroundMessage<CandidateLoginState | null>({
          type: 'GET_CANDIDATE_LOGIN',
          tabId: tabInfo.tabId,
        });
        setCandidate(candidateData);
      }

      // 4. Fetch matching logins if vault unlocked
      if (statusRes?.data?.isUnlocked && tabInfo?.origin) {
        const loginsRes = await sendBackgroundMessage<NativeResponse<MatchedLoginSummary[]>>({
          type: 'SEARCH_LOGINS',
          origin: tabInfo.origin,
          query: searchQuery || undefined,
        });
        if (loginsRes?.success && Array.isArray(loginsRes.data)) {
          setLogins(loginsRes.data);
        } else {
          setLogins([]);
        }
      } else {
        setLogins([]);
      }
    } catch (err: any) {
      setConnectionStatus({
        isAppRunning: false,
        isUnlocked: false,
        isHostConnected: false,
        error: err.message || 'Error communicating with background worker.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [sendBackgroundMessage, searchQuery]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Handle search query change
  const handleSearchChange = async (query: string) => {
    setSearchQuery(query);
    if (!connectionStatus.isUnlocked) return;

    const res = await sendBackgroundMessage<NativeResponse<MatchedLoginSummary[]>>({
      type: 'SEARCH_LOGINS',
      origin: query ? undefined : activeTabInfo?.origin || undefined,
      query: query || undefined,
    });
    if (res?.success && Array.isArray(res.data)) {
      setLogins(res.data);
    }
  };

  // Lock vault action
  const handleLockVault = async () => {
    await sendBackgroundMessage({ type: 'LOCK_VAULT' });
    refresh();
  };

  // Fill credentials into active tab
  const handleFillLogin = async (login: MatchedLoginSummary): Promise<boolean> => {
    if (!activeTabInfo?.origin || !activeTabInfo.tabId) return false;

    // Fetch credentials for this login with origin verification
    const credRes = await sendBackgroundMessage<NativeResponse<{ username?: string; password?: string }>>({
      type: 'GET_LOGIN',
      id: login.id,
      origin: activeTabInfo.origin,
    });

    if (!credRes?.success || !credRes.data) {
      throw new Error(credRes?.error || 'Authorization failed.');
    }

    // Trigger autofill in active tab
    const fillRes = await sendBackgroundMessage<{ success: boolean }>({
      type: 'FILL_ACTIVE_TAB',
      tabId: activeTabInfo.tabId,
      username: credRes.data.username,
      password: credRes.data.password,
    });

    return !!fillRes?.success;
  };

  // Copy username to clipboard
  const handleCopyUsername = (username: string) => {
    navigator.clipboard.writeText(username);
  };

  // Copy password to clipboard
  const handleCopyPassword = async (loginId: string) => {
    if (!activeTabInfo?.origin) throw new Error('No active origin.');
    const credRes = await sendBackgroundMessage<NativeResponse<{ password?: string }>>({
      type: 'GET_LOGIN',
      id: loginId,
      origin: activeTabInfo.origin,
    });

    if (!credRes?.success || !credRes.data?.password) {
      throw new Error(credRes?.error || 'Failed to fetch password.');
    }

    await navigator.clipboard.writeText(credRes.data.password);
  };

  // Save candidate login
  const handleSaveCandidate = async (candidateData: CandidateLoginState): Promise<boolean> => {
    const payload: SaveLoginRequest = {
      origin: candidateData.origin,
      username: candidateData.username,
      password: candidateData.password,
      url: candidateData.url,
    };

    const res = await sendBackgroundMessage<NativeResponse>({
      type: 'SAVE_LOGIN',
      payload,
      tabId: candidateData.tabId,
    });

    if (res?.success) {
      setCandidate(null);
      refresh();
      return true;
    }
    return false;
  };

  // Dismiss candidate login
  const handleDismissCandidate = async () => {
    if (activeTabInfo?.tabId) {
      await sendBackgroundMessage({
        type: 'DISMISS_CANDIDATE_LOGIN',
        tabId: activeTabInfo.tabId,
      });
      setCandidate(null);
    }
  };

  // Generate password via desktop crypto
  const handleGeneratePassword = async (options: Partial<PasswordGeneratorOptions>) => {
    const res = await sendBackgroundMessage<NativeResponse>({
      type: 'GENERATE_PASSWORD',
      options,
    });
    return res?.success ? res.data : null;
  };

  // Fill password directly from generator
  const handleFillGeneratedPassword = async (password: string): Promise<boolean> => {
    if (!activeTabInfo?.tabId) return false;
    const res = await sendBackgroundMessage<{ success: boolean }>({
      type: 'FILL_ACTIVE_TAB',
      tabId: activeTabInfo.tabId,
      password,
    });
    return !!res?.success;
  };

  return (
    <div className="flex flex-col min-h-[480px] bg-black text-gray-200">
      <Header
        status={connectionStatus}
        onLockVault={handleLockVault}
        onRefresh={refresh}
        isLoading={isLoading}
      />

      <OriginBar origin={activeTabInfo?.origin || null} url={activeTabInfo?.url || ''} />

      {/* Save Candidate Card if intercepted on active tab */}
      {candidate && (
        <SaveCandidateCard
          candidate={candidate}
          onSave={handleSaveCandidate}
          onDismiss={handleDismissCandidate}
        />
      )}

      {/* Main Tab Content */}
      <div className="flex-1">
        {currentTab === 'vault' && (
          <MatchingLogins
            status={connectionStatus}
            origin={activeTabInfo?.origin || null}
            logins={logins}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            onFill={handleFillLogin}
            onCopyUsername={handleCopyUsername}
            onCopyPassword={handleCopyPassword}
            isLoading={isLoading}
          />
        )}

        {currentTab === 'generator' && (
          <PasswordGeneratorTab
            onGenerate={handleGeneratePassword}
            onFillPassword={handleFillGeneratedPassword}
            onCopy={(text) => navigator.clipboard.writeText(text)}
          />
        )}

        {currentTab === 'diagnostics' && (
          <DiagnosticsTab
            status={connectionStatus}
            activeOrigin={activeTabInfo?.origin || null}
            onTestConnection={refresh}
            isLoading={isLoading}
          />
        )}
      </div>

      {/* Navigation Footer */}
      <nav className="flex items-center justify-around py-2 bg-[#11130e] border-t border-[#3E432E]">
        <button
          onClick={() => setCurrentTab('vault')}
          className={`flex flex-col items-center gap-1 text-[11px] font-medium transition-colors ${
            currentTab === 'vault' ? 'text-[#A7D129]' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Vault</span>
        </button>

        <button
          onClick={() => setCurrentTab('generator')}
          className={`flex flex-col items-center gap-1 text-[11px] font-medium transition-colors ${
            currentTab === 'generator' ? 'text-[#A7D129]' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>Generator</span>
        </button>

        <button
          onClick={() => setCurrentTab('diagnostics')}
          className={`flex flex-col items-center gap-1 text-[11px] font-medium transition-colors ${
            currentTab === 'diagnostics' ? 'text-[#A7D129]' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Wrench className="w-4 h-4" />
          <span>Diagnostics</span>
        </button>
      </nav>
    </div>
  );
};

export default App;
