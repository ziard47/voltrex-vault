/**
 * Voltrex Vault - Extension & Native Messaging Protocol Types
 * Strictly enforces message boundaries, command allowlisting, and response schemas.
 */

export const NATIVE_HOST_NAME = 'com.voltrex.vault';
export const MAX_NATIVE_MESSAGE_BYTES = 1024 * 1024; // 1 MB ceiling

export type NativeAction =
  | 'status'
  | 'search-logins'
  | 'get-login'
  | 'generate-password'
  | 'save-login'
  | 'lock-vault';

export const ALLOWED_NATIVE_ACTIONS: ReadonlySet<string> = new Set<NativeAction>([
  'status',
  'search-logins',
  'get-login',
  'generate-password',
  'save-login',
  'lock-vault',
]);

export interface NativeRequest<T = any> {
  id: string;
  action: NativeAction;
  payload?: T;
}

export interface NativeResponse<T = any> {
  id: string;
  success: boolean;
  data?: T;
  error?: string;
}

export interface ExtensionStatus {
  isAppRunning: boolean;
  isUnlocked: boolean;
  vaultId?: string;
  itemCount?: number;
}

export interface MatchedLogin {
  id: string;
  title: string;
  username: string;
  url?: string;
}

export type MatchedLoginSummary = MatchedLogin;

export interface ApprovedLoginCredentials {
  id: string;
  username: string;
  password: string;
  url?: string;
}

export interface SaveLoginRequest {
  origin: string;
  username: string;
  password: string;
  title?: string;
  url?: string;
}

export interface SearchLoginsRequest {
  origin: string;
}

export interface GetLoginRequest {
  id: string;
  origin: string;
}
