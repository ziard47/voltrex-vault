# Voltrex Vault — Comprehensive Threat Model & Security Architecture

**Version**: 1.0.0  
**Target**: Desktop Application (Electron + SQLite + React) & Companion Chromium Extension  
**Classification Date**: October 2026  
**Auditor Disclosure**: *Voltrex Vault has undergone rigorous internal automated testing and security audits. No third-party commercial security audit has occurred to date.*

---

## 1. System Overview & Trust Boundaries

Voltrex Vault is designed under the **principle of least privilege**, establishing rigid trust boundaries:

```
[ UNTRUSTED ]
Malicious Webpages & Cross-Origin Iframes
       │
       ▼ (Pure DOM Inspection / No auto-submit / Explicit user fill)
[ BOUNDARY 1: BROWSER EXTENSION (Chrome MV3) ]
Transient In-Memory Candidates ONLY (No permanent secrets in browser storage)
       │
       ▼ (Chromium Native Messaging Stdio / 1MB message limit / Action allowlist)
[ BOUNDARY 2: NATIVE MESSAGING HOST (com.voltrex.vault) ]
Strict Protocol Parser & Domain Socket Forwarder
       │
       ▼ (Local Unix Domain Socket / Named Pipe with 0600 mode)
[ BOUNDARY 3: ELECTRON MAIN PROCESS (Trusted Cryptographic Authority) ]
Argon2id KDF + AES-256-GCM Authenticated Encryption + sql.js Database
       │
       ▼ (contextBridge with strict senderFrame validation & connect-src: 'none')
[ BOUNDARY 4: RENDERER UI ]
Sandboxed React 18 Desktop Interface
```

---

## 2. Threat Classification Matrix

Threats are categorized as **Mitigated**, **Partially Mitigated**, or **Outside the Protection Boundary**.

| Threat Category | Description | Status | Architectural Defense / Residual Risk |
|---|---|---|---|
| **Offline Password Guessing** | Attacker obtains SQLite database or backup file and attempts dictionary/brute-force attacks. | **Mitigated** | Defended by Argon2id with memory-hard parameters (64 MiB RAM, 3 iterations, 1 thread) and 32-byte cryptographically secure random salt. Rate of guessing on GPU/ASIC is computationally constrained. |
| **Weak Master Passwords** | User selects a low-entropy or dictionary password. | **Partially Mitigated** | Master password strength meter and Shannon entropy calculation warn user during setup and password change. Residual risk: User can override warnings and choose a weak password. |
| **Memory Exposure & Cold Boot** | Process memory inspection (dumps, core dumps, debuggers). | **Partially Mitigated** | Sensitive keys (DEK, master keys) are stored in Node.js `Buffer` objects and overwritten with zeroes (`buffer.fill(0)`) upon vault lock, application quit, or failed auth. **Residual Risk Limitation**: In JavaScript/Node.js, immutable strings and V8 garbage collector relocations may leave transient fragments in unmanaged process memory. No software password manager in JS can guarantee zero memory artifacts. |
| **Clipboard Snooping** | Malicious background process monitors OS clipboard. | **Partially Mitigated** | `ClipboardManager` automatically tracks copied entries and purges the clipboard after a user-configured timeout (default 30 seconds). If another application overwrites the clipboard before timeout, Voltrex avoids clobbering the new contents. Residual risk: Malware actively polling clipboard at millisecond frequency can capture secrets during the exposure window. |
| **Compromised Operating System / Root Malware** | Malware with kernel access, keyloggers, or memory injection. | **Outside Boundary** | An adversary with administrative/root control or active keyloggers on the host OS can capture keystrokes during master password entry or dump process address spaces. No desktop application can withstand a compromised supervisor OS. |
| **Database & File Tampering** | Attacker modifies encrypted database rows or file bytes. | **Mitigated** | AES-256-GCM provides authenticated encryption with associated data (AEAD). Any bit flip or payload alteration invalidates the 128-bit authentication tag, causing immediate decryption rejection and abort. |
| **Renderer Process Compromise** | Cross-Site Scripting (XSS) or renderer exploit in desktop UI. | **Mitigated** | Electron is hardened with `sandbox: true`, `contextIsolation: true`, and `nodeIntegration: false`. Content Security Policy (`connect-src 'none'`) blocks exfiltration. All IPC handlers enforce strict schema validation and verify `event.senderFrame === mainWindow.webContents.mainFrame`. |
| **Malicious Webpages & Phishing** | Untrusted websites attempting to harvest credentials via extension. | **Mitigated** | **Canonical Origin Matching**: Scheme, hostname, and port are strictly parsed per RFC 3986. Strict subdomain isolation prevents `evil.example.com` or `phishing-example.com` from receiving credentials for `example.com`. Plain HTTP autofill is blocked by default. |
| **Cross-Origin Iframes** | Malicious embedded iframes in web pages. | **Mitigated** | Content script checks `isSafeFrameContext()` (`window.self === window.top` or matching parent origin) and refuses execution in cross-origin frames. |
| **Extension Autofill Abuse** | Webpages silently submitting forms to steal credentials. | **Mitigated** | **Zero Auto-Fill on Page Load**: Credentials are never injected without explicit user interaction in the popup. **No Auto-Submit**: Content script strictly forbids calling `form.submit()` or simulating Enter keys. |
| **Native Messaging Host Hijacking** | Malicious extensions attempting to communicate with `com.voltrex.vault`. | **Mitigated** | Chromium restricts native messaging to allowed extension IDs specified in `allowed_origins`. The native host enforces a 1 MB payload ceiling and a strict command allowlist (`status`, `search-logins`, `get-login`, `generate-password`, `save-login`, `lock-vault`). Full database dumping is impossible. |
| **OAuth Token Theft (Google Drive)** | Malware extracting Google Drive authorization tokens. | **Mitigated** | OAuth 2.0 PKCE ensures no client secrets exist. Tokens are encrypted on disk using Electron's `safeStorage` (OS DPAPI / Keychain / libsecret) with `0600` permissions. Scope is strictly restricted to `https://www.googleapis.com/auth/drive.file` (access only to Voltrex-created backup files). |
| **Backup Corruption / Transfer Failure** | Network disconnects or corrupted backup downloads. | **Mitigated** | Backups are serialized into self-contained `voltrex-vault-encrypted-backup-v1` containers with SHA-256 payload integrity tags. Atomic restore writes to temporary files first and creates a safety snapshot (`pre-restore-snapshot-*.db`) of the current vault before replacing it. |
| **Backup Version Rollback / Replay** | Attacker replaces cloud backup with an older snapshot. | **Partially Mitigated** | Backup containers contain embedded creation timestamps and vault version counters. Restoration prompts a comparison view displaying entry count deltas and timestamps. |
| **Malicious Import Payloads** | Specially crafted JSON or CSV imports attempting injection. | **Mitigated** | Import inputs pass strict type, length, and character validation in `src/shared/validation.ts`. Invalid records are rejected without aborting clean records. |
| **Dependency Supply-Chain Compromise** | Malicious upstream npm package update. | **Partially Mitigated** | Verified lockfiles (`package-lock.json`), automated `npm audit` in CI, pinned dependencies, zero Rust sidecars/addons, and pure WebAssembly crypto engines (`hash-wasm`, `sql.js`). |
| **Forgotten Master Password** | User forgets their master password. | **Outside Boundary** | Zero-knowledge architecture guarantees that no backdoor, recovery key, or reset mechanism exists. Without the master password, encrypted data is mathematically unrecoverable. |

---

## 3. Cryptographic Invariants & Guarantees

1. **Argon2id Memory Hardness**:
   - Memory: `65,536 KiB` (64 MiB)
   - Iterations: `3`
   - Parallelism: `1`
   - Salt: 32 bytes cryptographically random (`crypto.randomBytes(32)`).
2. **Two-Tier Key Hierarchy**:
   - Master Key derives `KEK` and `AuthKey` using HKDF-SHA256 with distinct domain separation strings (`"voltrex-vault-kek-v1"`, `"voltrex-vault-auth-v1"`).
   - Data Encryption Key (DEK) is generated using 256 bits of CSPRNG entropy and encrypted under KEK.
   - Master password rotation re-wraps DEK without re-encrypting records.
3. **Nonce Uniqueness**:
   - AES-256-GCM uses a fresh 12-byte random IV (`crypto.randomBytes(12)`) per record and per write operation. Nonces are never reused.
4. **Zero Knowledge Cloud Backups**:
   - Backup containers encrypt data under a fresh salt and key derived from master password. Google Drive only ever receives ciphertext.

---

## 4. Residual Risks & Disclosures

1. **V8 Memory Reclamation**: Node.js and Chromium do not provide deterministic memory locking (`mlock`) for JavaScript strings. While buffers are explicitly zeroized, garbage collection schedules and V8 string interning mean ephemeral plaintext may persist in heap space until reclaimed.
2. **Endpoint Security Assumption**: The user's operating system environment must be free from active keyloggers, screen scrapers, or kernel-level compromises.
3. **No Multi-Master Real-Time Sync**: Backups represent immutable periodic snapshots; concurrent edits on multiple offline devices require manual review during restore.
