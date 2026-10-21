/**
 * Voltrex Vault - Core Shared Types
 * Strictly typed interfaces for Vault domain models, IPC schemas, and security parameters.
 */

export type EntryType = 'login' | 'note' | 'card' | 'identity';

export interface BaseEntryPayload {
  title: string;
  tags?: string[];
  notes?: string;
}

export interface LoginPayload extends BaseEntryPayload {
  type: 'login';
  url?: string;
  username: string;
  password: string;
}

export interface NotePayload extends BaseEntryPayload {
  type: 'note';
  content: string;
}

export interface CardPayload extends BaseEntryPayload {
  type: 'card';
  cardholderName: string;
  cardNumber: string;
  expirationMonth: string;
  expirationYear: string;
  cvv: string;
  pin?: string;
}

export interface IdentityPayload extends BaseEntryPayload {
  type: 'identity';
  fullName: string;
  email?: string;
  phone?: string;
  address?: string;
  company?: string;
  nationalId?: string;
}

export type VaultEntryPayload = LoginPayload | NotePayload | CardPayload | IdentityPayload;

export interface VaultEntry {
  id: string;
  type: EntryType;
  title: string;
  isFavorite: boolean;
  createdAt: number;
  updatedAt: number;
  trashedAt?: number | null;
  payload: VaultEntryPayload;
}

export interface EncryptedRecord {
  id: string;
  type: EntryType;
  title: string;
  isFavorite: boolean;
  createdAt: number;
  updatedAt: number;
  trashedAt?: number | null;
  ivHex: string;
  ciphertextHex: string;
  tagHex: string;
  version: number;
}

export interface VaultMetadata {
  version: number;
  vaultId: string;
  kdfSaltHex: string;
  kdfParams: {
    memoryKiB: number;
    iterations: number;
    parallelism: number;
    hashLength: number;
  };
  encryptedDekHex: string;
  dekIvHex: string;
  dekTagHex: string;
  createdAt: number;
  updatedAt: number;
}

export interface VaultSettings {
  autoLockMinutes: number; // 0 = disabled, e.g. 1, 5, 15, 30
  clipboardClearSeconds: number; // e.g. 15, 30, 60, 120
}

export interface VaultStatus {
  isInitialized: boolean;
  isUnlocked: boolean;
  itemCount: number;
  vaultId?: string;
}

export interface PasswordGeneratorOptions {
  length: number;
  includeUppercase: boolean;
  includeLowercase: boolean;
  includeNumbers: boolean;
  includeSymbols: boolean;
  excludeAmbiguous: boolean; // e.g. 0, O, o, 1, l, I
}

export type PasswordStrengthLabel = 'Weak' | 'Fair' | 'Good' | 'Strong' | 'Very Strong';

export interface GeneratedPasswordResult {
  password: string;
  entropyBits: number;
  strengthLabel: PasswordStrengthLabel;
}

export interface ExportData {
  format: 'voltrex-vault-unencrypted-export';
  exportVersion: 1;
  exportedAt: number;
  entries: VaultEntry[];
}

export interface EncryptedBackupContainer {
  format: 'voltrex-vault-encrypted-backup';
  version: 1;
  backupId: string;
  vaultId: string;
  appVersion: string;
  createdAt: number;
  itemCount: number;
  kdf: {
    algorithm: 'argon2id';
    params: {
      memoryKiB: number;
      iterations: number;
      parallelism: number;
      hashLength: number;
    };
    saltHex: string;
  };
  cipher: {
    algorithm: 'aes-256-gcm';
    keyBits: 256;
    ivBits: 96;
    tagBits: 128;
  };
  encryptedDek: {
    ciphertextHex: string;
    ivHex: string;
    tagHex: string;
  };
  authCheck: {
    ciphertextHex: string;
    ivHex: string;
    tagHex: string;
  };
  payload: {
    ciphertextHex: string;
    ivHex: string;
    tagHex: string;
  };
}



export interface RestoreComparison {
  localVaultId: string;
  localItemCount: number;
  localLastModified: number;
  remoteVaultId: string;
  remoteBackupId: string;
  remoteItemCount: number;
  remoteCreatedAt: number;
  isSameVault: boolean;
}

export interface ReleaseAsset {
  name: string;
  sizeBytes: number;
  downloadUrl: string;
  contentType: string;
}

export interface UpdateCheckResult {
  currentVersion: string;
  latestVersion: string;
  isUpdateAvailable: boolean;
  hasReleases: boolean;
  releaseName: string;
  releaseNotes: string;
  publishedAt: string;
  releaseUrl: string;
  assets: ReleaseAsset[];
  recommendedAsset?: ReleaseAsset;
}

export interface DownloadProgress {
  status: 'idle' | 'downloading' | 'completed' | 'error';
  percent: number;
  transferredBytes: number;
  totalBytes: number;
  savedFilePath?: string;
  error?: string;
}
