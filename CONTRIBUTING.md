# Contributing to Voltrex Vault

Thank you for your interest in contributing to Voltrex Vault! We welcome contributions that maintain our high standards of security, privacy, and code quality.

---

## 1. Development Principles & Non-Negotiables

1. **Security-First Mindset**: All code handling cryptography, storage, IPC, or extension communications must adhere to the [Threat Model](docs/THREAT_MODEL.md).
2. **Zero Native/Rust Dependencies**: Voltrex Vault relies strictly on portable, maintainable TypeScript/JavaScript and verified WebAssembly binaries (`hash-wasm`, `sql.js`). Introducing Rust sidecars, Rust crates, or native C++ addons is prohibited.
3. **Local-First & Offline**: Features must work offline without reliance on external proprietary servers.
4. **No Secrets in Logs or Renderers**: Never log passwords, tokens, keys, or sensitive payloads. The renderer process must never possess encryption keys or master passwords.
5. **Strict TypeScript**: Code must compile under TypeScript strict mode with zero type suppressions (`@ts-ignore` is forbidden).

---

## 2. Setting Up the Development Environment

### Prerequisites
- Node.js `20.x` or `22.x`+
- npm `10.x`+

### Installation
```bash
git clone https://github.com/voltrex/voltrex-vault.git
cd voltrex-vault
npm install
```

### Running Locally
```bash
# Terminal 1: Run Vite dev server for desktop UI
npm run dev:vite

# Terminal 2: Launch Electron desktop app
npm run dev:electron
```

### Building the Browser Extension
```bash
npm run build:extension
npm run register:host
```

---

## 3. Pull Request Checklist

Before submitting a Pull Request, verify that all automated checks pass:

- [ ] **Typecheck**: `npm run typecheck` passes with zero errors.
- [ ] **Test Suite**: `npm test` passes all tests with zero failures.
- [ ] **Build Pipeline**: `npm run build` succeeds cleanly.
- [ ] **Security Review**: No new permissions, network calls, or logging of sensitive variables introduced.
- [ ] **Documentation**: Any new features or configuration flags are documented in `README.md`.
