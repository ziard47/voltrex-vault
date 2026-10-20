# Voltrex Vault — Architecture & System Design

Voltrex Vault is architected as an offline-first, local-first password manager with an optional Google Drive encrypted backup layer and a Chromium companion extension.

---

## 1. High-Level Process Architecture

```
┌────────────────────────────────────────────────────────┐
│                   Chromium Browser                     │
│   ┌────────────────────────┐  ┌────────────────────┐   │
│   │     Content Script     │  │    Popup UI        │   │
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
│   │   - Restrictive Socket Permissions (`0600`)    │   │
│   │   - Origin Enforcement on Credential Retrieval │   │
│   │   - Insecure HTTP Autofill Blocking            │   │
│   └───────────────────────┬────────────────────────┘   │
│                           │                            │
│                           ▼                            │
│   ┌────────────────────────────────────────────────┐   │
│   │        Voltrex VaultService (Master Auth)      │   │
│   │        - Argon2id KDF (hash-wasm WebAssembly)  │   │
│   │        - AES-256-GCM Authenticated Encryption  │   │
│   │        - SQLite Storage Engine (sql.js Wasm)   │   │
│   │        - In-Memory Key Zeroization on Lock/Quit│   │
│   └───────────────────────┬────────────────────────┘   │
│                           │                            │
│           contextBridge   │ (Narrow, Typed API,        │
│                           │  senderFrame Verification, │
│                           │  connect-src 'none')       │
│                           ▼                            │
│   ┌────────────────────────────────────────────────┐   │
│   │               Renderer Process                 │   │
│   │   - React 18 + MUI + Tailwind CSS              │   │
│   │   - Sandbox: true, nodeIntegration: false      │   │
│   │   - Strict CSP & frame isolation               │   │
│   └────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────┘
```

---

## 2. Cryptographic Lifecycle

### Setup & Unlock
1. **Master Password Input**: Entered into renderer UI and transmitted via IPC to `VaultService`.
2. **Argon2id KDF**:
   - `65,536 KiB` RAM, `3` iterations, `1` parallelism, 32-byte random salt.
   - Computes 32-byte `MasterKey`.
3. **HKDF-SHA256 Derivation**:
   - `KEK = HKDF-SHA256(MasterKey, info="voltrex-vault-kek-v1", length=32)`
   - `AuthKey = HKDF-SHA256(MasterKey, info="voltrex-vault-auth-v1", length=32)`
4. **Sentinels & Verification**:
   - Compares decrypted auth token sentinel against expected constant.
   - If valid, decrypts `encryptedDek` using `KEK` with AES-256-GCM.
   - DEK is held in a protected Buffer during the unlocked session.
5. **Locking & Exit**:
   - Upon lock or quit, `DEK.fill(0)`, `KEK.fill(0)`, `AuthKey.fill(0)` are executed to zero memory.

---

## 3. Storage Architecture

- **SQLite Database**: Executed via WebAssembly (`sql.js`), writing to `voltrex_vault.db` with `0600` permissions.
- **Table Schemas**:
  - `metadata`: Vault ID, KDF salt, Argon2id parameters, encrypted DEK, encrypted auth sentinel.
  - `entries`: UUID, type, title, is_favorite, created_at, updated_at, trashed_at, iv_hex, ciphertext_hex, tag_hex.
  - `settings`: Auto-lock timeout, clipboard clearance interval, Google Drive preferences.
- **Zero Plaintext on Disk**: Every entry payload is individually encrypted under AES-256-GCM with a fresh 12-byte IV.

---

## 4. Google Drive Cloud Backups

- **Authentication**: Installed app OAuth 2.0 with RFC 7636 PKCE and ephemeral loopback redirect server.
- **Scope Restriction**: `https://www.googleapis.com/auth/drive.file` only.
- **Container Format**: Encrypted `.voltrex` snapshot containing full vault state, encrypted with master password using Argon2id + AES-256-GCM.
- **Restore Safety**: Pre-restore backup snapshots (`pre-restore-snapshot-*.db`) are saved before importing or restoring.
