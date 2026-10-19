export interface ActiveTabState {
  tabId: number;
  url: string;
  origin: string | null;
}

export interface CandidateLoginState {
  tabId: number;
  origin: string;
  url: string;
  username: string;
  password: string;
  timestamp: number;
}

export interface VaultConnectionState {
  isAppRunning: boolean;
  isUnlocked: boolean;
  isHostConnected: boolean;
  error?: string;
}

export type PopupTab = 'vault' | 'generator' | 'diagnostics';
