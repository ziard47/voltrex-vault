# Voltrex Vault

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/voltrex/voltrex-vault/actions/workflows/ci.yml/badge.svg)](.github/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](tsconfig.json)

Voltrex Vault is a free, open-source, local-first password and secrets manager built with **Electron**, **React**, **TypeScript (Strict Mode)**, **Vite**, **MUI**, **Tailwind CSS**, and **SQLite**.

> **Documentation**: [Threat Model](docs/THREAT_MODEL.md) | [Architecture](docs/ARCHITECTURE.md) | [Security Policy](SECURITY.md) | [Contributing](CONTRIBUTING.md) | [License](LICENSE)

---

## 1. Architecture Overview

Voltrex Vault adheres to the principle of least privilege, establishing strict boundary separation across three isolated processes:

```
┌─────────────────────────────────────────────────────────────┐
│                       Renderer Process                      │
│   React 18 + MUI + Tailwind CSS + Lucide Icons (WebContext) │
│   - Strictly Sandboxed (sandbox: true, nodeIntegration: false)│
│   - Restrictive Content Security Policy                     │
└──────────────────────────────┬──────────────────────────────┘
                               │
            window.vaultApi    │ (Narrow, Typed contextBridge API)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                        Preload Script                       │
│   - contextIsolation: true                                  │
│   - Zero exposure of ipcRenderer, Node.js, or filesystem    │
│   - Wraps and validates IPC calls                           │
└──────────────────────────────┬──────────────────────────────┘
                               │
          Strict IPC Channels   │ (Frame & Schema Validation)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                         Main Process                        │
│   - Trusted Node.js runtime                                 │
│   - AES-256-GCM authenticated cipher engine                 │
│   - Argon2id KDF + HKDF-SHA256 key separation               │
│   - SQLite Persistence via WebAssembly (sql.js)             │
│   - Backup Scheduler (Debounced & Periodic)                │
│   - Google Drive Service (OAuth 2.0 PKCE + drive.file)      │
│   - In-memory key zeroization on lock/exit                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Cryptographic Specification

### A. Key Derivation & Separation
- **KDF Algorithm**: Argon2id via `hash-wasm` (verified WebAssembly binary with zero native compilation dependencies).
- **Argon2id Parameters**:
  - Memory: `65,536 KiB` (64 MiB)
  - Iterations (`time`): `3`
  - Parallelism: `1`
  - Salt: Cryptographically secure random 32-byte salt (`crypto.randomBytes(32)`).
  - Output Key: 32-byte Master Key.
- **Key Separation via HKDF-SHA256**:
  - `KEK` (Key Encryption Key) = `HKDF-SHA256(MasterKey, info="voltrex-vault-kek-v1", length=32)`
  - `AuthKey` (Authentication Token Key) = `HKDF-SHA256(MasterKey, info="voltrex-vault-auth-v1", length=32)`

### B. Two-Tier Key Hierarchy
1. A random 256-bit **Data Encryption Key (DEK)** is generated using `crypto.randomBytes(32)`.
2. The DEK is encrypted under the KEK using AES-256-GCM with a unique 12-byte IV, producing `encryptedDek` and a 16-byte auth tag.
3. Each individual item payload (credentials, notes, cards, identities) is encrypted under the DEK with AES-256-GCM using a **fresh, unique 12-byte nonce/IV** generated per write operation.
4. An auth verification sentinel token (`"voltrex-vault-auth-token-v1"`) is encrypted under `AuthKey`. This enables instant password validation without exposing or decrypting the DEK.
5. **Master Password Rotation**: Changing the master password re-derives a new KEK with a fresh salt and re-wraps the existing DEK atomically, eliminating the need to re-encrypt every item in the database.

---

## 3. Phase 2: Google Drive & Encrypted Backups

Voltrex Vault provides zero-knowledge, encrypted cloud backups to the user's personal Google Drive account, as well as local encrypted container exports (`.voltrex`).

### A. Architectural Principles
- **No Voltrex Cloud Backend**: Voltrex Vault has zero proprietary cloud servers, zero telemetry, and zero intermediary services. All communications travel directly between the user's desktop application and official Google APIs.
- **Local-First & Offline Resilience**: Voltrex Vault remains fully functional without an internet connection. If offline, scheduled backups gracefully defer without blocking local operations.
- **Backup & Restore, NOT Multi-Master Sync**: Backups represent immutable encrypted snapshots. There is no silent, unprompted last-write-wins merging or concurrent multi-client state corruption.

### B. Google OAuth 2.0 PKCE Flow
- **RFC 7636 PKCE (Proof Key for Code Exchange)**:
  - Generates a cryptographically random 32-byte `code_verifier` (base64url).
  - Derives `code_challenge = BASE64URL(SHA256(code_verifier))`.
  - Generates a random 16-byte `state` parameter to prevent CSRF.
- **Installed App Loopback Server**:
  - Starts a temporary local HTTP server on `127.0.0.1` on an ephemeral OS-assigned port.
  - Launches the user's default operating system browser via `shell.openExternal`.
  - Captures the authorization code from the redirect URI (`http://127.0.0.1:<port>`), exchanges it for tokens with Google, and immediately terminates the server.
- **Restricted Scope**:
  - `https://www.googleapis.com/auth/drive.file`: Gives the app access **only** to files that Voltrex Vault itself creates. It cannot view, list, or modify any personal documents, photos, or other files in the user's Google Drive.
- **Token Security**:
  - Tokens are stored locally on the user's device encrypted via Electron's `safeStorage` (which uses OS keychains: DPAPI on Windows, Keychain on macOS, Secret Service / libsecret on Linux) with restrictive `0600` file permissions.
  - No client secrets are stored in code or repository commits.

### C. Encrypted Container Format (`voltrex-vault-encrypted-backup-v1`)
The backup file format is completely portable and cross-device compatible. It requires only the master password to restore on any device, with no machine-specific or TPM hardware identifiers embedded.

```json
{
  "format": "voltrex-vault-encrypted-backup",
  "version": 1,
  "backupId": "UUID",
  "vaultId": "UUID",
  "appVersion": "1.0.0",
  "createdAt": 1729350000000,
  "itemCount": 42,
  "kdf": {
    "algorithm": "argon2id",
    "params": {
      "memoryKiB": 65536,
      "iterations": 3,
      "parallelism": 1,
      "hashLength": 32
    },
    "saltHex": "..."
  },
  "cipher": {
    "algorithm": "aes-256-gcm",
    "keyBits": 256,
    "ivBits": 96,
    "tagBits": 128
  },
  "encryptedDek": {
    "ciphertextHex": "...",
    "ivHex": "...",
    "tagHex": "..."
  },
  "authCheck": {
    "ciphertextHex": "...",
    "ivHex": "...",
    "tagHex": "..."
  },
  "payload": {
    "ciphertextHex": "...",
    "ivHex": "...",
    "tagHex": "..."
  }
}
```

### D. Automated Scheduler & Retention Pruning
- **Change Debouncing**: When entries are added, modified, or trashed, a backup is scheduled with a 20-second debounce window.
- **Periodic Backups**: Configurable interval (15m, 30m, 1h, 6h, 24h).
- **Exponential Backoff**: Transient network errors trigger retries with exponential backoff and randomized jitter (up to 3 retries max).
- **Retention Pruning**: Retains up to `N` most recent backups (default 5, configurable), automatically pruning older backups while **strictly preserving the last known-good backup** at all times.

### E. Safe Atomic Restore & Safety Snapshots
- **Container Verification**: Prior to modifying local storage, the backup container structure is validated, KDF keys derived, and auth tags checked.
- **Pre-Restore Safety Snapshot**: Before replacing local SQLite data, an atomic copy of the current database is saved as `pre-restore-snapshot-<timestamp>.db` with `0600` permissions.
- **Conflict Comparison**: The UI presents an explicit comparison between the active vault and backup container (item counts, last modified dates, and a prominent warning if the backup originated from a different `vaultId`).
- **Atomic Transaction**: Local database entries are updated within an atomic SQLite transaction. If any failure occurs, the database is rolled back immediately to the safety snapshot.

---

## 4. Threat Model & Security Guarantees

| Attack Vector | Mitigation / Guarantee |
| :--- | :--- |
| **Database Stolen at Rest** | Plaintext credentials, notes, and keys are NEVER written to disk. All payloads are AES-256-GCM encrypted. SQLite database file is written with restrictive `0600` permissions. |
| **Ciphertext Tampering** | AES-256-GCM authenticates ciphertext with a 128-bit authentication tag. Tampering with any byte causes immediate rejection (`CryptoIntegrityError`). |
| **Google Cloud Interception** | Cloud storage receives only authenticated AES-256-GCM ciphertext. The master password and raw DEK are never transmitted over the network. |
| **Google Account Compromise** | An attacker with access to the user's Google Drive cannot decrypt the backup containers without the master password (protected by 64 MiB Argon2id). |
| **Renderer / XSS Exploits** | Strict CSP. Preload exposes only validated, typed methods. Navigation locks prevent external redirects. |
| **IPC Spoofing** | Every IPC invocation verifies that `event.senderFrame` corresponds strictly to the trusted mainWindow mainFrame. |
| **Memory Snooping** | In-memory key buffers (DEK, KEK, MasterKey) are zeroized with `buf.fill(0)` immediately upon vault locking or application exit. |

---

## 5. Build, Test, and Launch Instructions

### Prerequisites
- Node.js `>= 18` (Tested on `v24.18.0`)
- npm `>= 9` (Tested on `11.16.0`)

### Installation
```bash
npm install
```

### Running Tests
Execute the full test suite (40 tests across 9 test files covering cryptography, backup containers, atomic restore, Google Drive PKCE, storage, and secret leakage):
```bash
npm test
```

### Type Checking & Linting
Validate strict TypeScript compilation across desktop renderer, Electron processes, and browser extension:
```bash
npm run typecheck
```

### Building the Application & Extension
Build the Vite React desktop bundle, compile Electron main/preload/native-host, and bundle the Chrome extension:
```bash
npm run build
```

Or build individual targets:
```bash
npm run build:vite       # Desktop React renderer
npm run build:electron   # Electron main, preload, and native host
npm run build:extension  # Chromium extension (manifest, popup, background, content)
```

### Launching the Desktop Application
Start the desktop application:
```bash
npm start
```
Or for development with Vite HMR:
```bash
# Terminal 1: Run Vite dev server
npm run dev:vite

# Terminal 2: Run Electron
npm run dev:electron
```

---

## 4. Phase 3: Chromium Browser Extension & Native Messaging

Voltrex Vault includes a companion Chromium extension (Chrome, Brave, Edge, Vivaldi) delivering a seamless autofill experience inspired by 1Password, while strictly keeping the desktop application as the sole cryptographic authority.

```
┌────────────────────────────────────────────────────────┐
│                   Chromium Browser                     │
│                                                        │
│   ┌────────────────────────┐  ┌────────────────────┐   │
│   │   Content Script       │  │    Popup UI        │   │
│   │   - Isolated Frame     │  │    React + Tailwind│   │
│   │   - User-driven Fill   │  │    Voltrex Palette │   │
│   │   - No Auto-Submit     │  │    Entropy Meter   │   │
│   └───────────┬────────────┘  └─────────┬──────────┘   │
│               │                         │              │
│               ▼                         ▼              │
│   ┌────────────────────────────────────────────────┐   │
│   │        Background Service Worker (MV3)         │   │
│   │        - Transient In-Memory Candidates        │   │
│   │        - Active Tab Canonical Origin Match     │   │
│   │        - Zero Secrets in Browser Storage       │   │
│   └───────────────────────┬────────────────────────┘   │
└───────────────────────────┼────────────────────────────┘
                            │ Chrome Native Messaging (stdio)
                            ▼
┌────────────────────────────────────────────────────────┐
│     Native Messaging Host (com.voltrex.vault)          │
│     - Node.js / TypeScript Stdio Host                  │
│     - Strict Command Allowlist & 1MB Length Limit      │
│     - Connects via Local Domain Socket / Named Pipe    │
└───────────────────────────┬────────────────────────────┘
                            │ Unix Domain Socket (`0600`) / Named Pipe
                            ▼
┌────────────────────────────────────────────────────────┐
│             Desktop Application (Electron)             │
│   ┌────────────────────────────────────────────────┐   │
│   │           Extension Bridge Server              │   │
│   │   - Restrictive Socket Permissions (`0600`)   │   │
│   │   - Origin Enforcement on Credential Retrieval │   │
│   │   - Insecure HTTP Autofill Blocking            │   │
│   └───────────────────────┬────────────────────────┘   │
│                           │                            │
│                           ▼                            │
│   ┌────────────────────────────────────────────────┐   │
│   │        Voltrex VaultService (Master Auth)      │   │
│   └────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────┘
```

### A. Security Boundaries & Threat Model

1. **Desktop App is the Sole Authority**:
   - The browser extension never possesses the Argon2id KDF keys, the master password, the DEK, or the SQLite database.
   - When the vault is locked or the desktop application is closed, the extension cannot retrieve passwords.
2. **Zero Plaintext Stored in Browser**:
   - The extension stores no plaintext passwords or credentials in `chrome.storage.local`, `chrome.storage.sync`, or IndexedDB.
   - Captured candidate logins are stored in volatile service worker memory for that specific tab and are purged on tab close or page navigation.
3. **Dedicated Native Messaging Host (`com.voltrex.vault`)**:
   - No local unauthenticated HTTP server or exposed WebSocket.
   - Communicates strictly over standard input/output (`stdio`) mediated by Chromium's native messaging infrastructure.
   - Connects to the desktop app via an OS-level Unix domain socket with restrictive `0600` permissions (or Windows Named Pipe).
4. **Command Allowlist & Payload Guards**:
   - Native host strictly validates input length with a 1 MB ceiling (`MAX_NATIVE_MESSAGE_BYTES = 1,048,576`).
   - Allowed commands only: `status`, `search-logins`, `get-login`, `generate-password`, `save-login`, `lock-vault`.
   - All search queries omit secret passwords; only title, username, and ID are returned for display.
5. **Canonical Origin Matching**:
   - Origins are normalized according to RFC 3986 (scheme, host, port).
   - Strict subdomain separation: `app.service.com` will never receive credentials saved for `billing.service.com` or `service.com`.
   - Internationalized Domain Names (IDN) and Punycode spoofing defense via standard URL host normalization.
   - Insecure plain `http:` origins are blocked by default from autofill.
6. **No Auto-Submit & User-Driven Autofill**:
   - Credentials are NEVER injected on page load. Autofill requires an explicit user click on "Fill" in the extension popup.
   - The content script never submits forms (`form.submit()` or simulating Enter is forbidden).
   - Frame isolation: Autofill is blocked inside untrusted third-party or cross-origin iframes.

### B. Installing & Registering the Browser Extension

#### 1. Register the Native Messaging Host
Register the host manifest `com.voltrex.vault.json` for installed Chromium browsers (including both native packages and Flatpak installations on SteamOS / Linux):
```bash
npm run register:host
```
*Supported browsers: Google Chrome, Chromium, Brave, Microsoft Edge, Vivaldi.*

> **SteamOS & Flatpak Note**: `register:host` automatically configures `flatpak-spawn --host` bridge manifests and permissions (`flatpak override --user --talk-name=org.freedesktop.Flatpak`) for sandboxed Flatpak browsers (e.g. Edge on Steam Deck). If you are using a Flatpak browser, completely close and reopen your browser once after running `register:host` for the new sandbox permissions to take effect.

#### 2. Build the Extension
```bash
npm run build:extension
```
This generates the standalone unpacked extension bundle in `dist/extension/`.

#### 3. Load the Extension in Your Browser
1. Open your Chromium browser and navigate to `chrome://extensions` (or `brave://extensions`, `edge://extensions`).
2. Enable **Developer mode** (toggle in top right).
3. Click **Load unpacked** and select the `dist/extension` directory inside the `voltrex-vault` project.
4. Copy the Extension ID (e.g., `abcdefghijklmnopqrstuvwxyz123456`) and register it with the native host:
   ```bash
   npm run register:host -- --extension-id <YOUR_EXTENSION_ID>
   ```
5. Launch the desktop app (`npm start`), unlock your vault, and click the Voltrex Vault extension icon in your browser toolbar to autofill, generate passwords, and capture logins.
