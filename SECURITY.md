# Security Policy

## Reporting Security Vulnerabilities

We take the security of Voltrex Vault extremely seriously. If you discover a security vulnerability or potential exploit, please report it responsibly so we can resolve it before public disclosure.

### How to Report

- **Email**: Send your disclosure to `security@voltrex.digital` (or create a private GitHub Security Advisory).
- **Required Details**:
  - Description of the vulnerability and its potential impact.
  - Step-by-step instructions or proof-of-concept (PoC) to reproduce the issue.
  - Software version and platform (e.g., Linux, macOS, Windows).
  - Any proposed remediations or patches.

### Response Timelines

- **Initial Acknowledgment**: Within 48 hours of receipt.
- **Triage & Assessment**: Within 5 business days.
- **Fix & Advisory Release**: Coordinated with the reporter, aiming for critical patches within 14 days.

---

## Security Audit Disclosure

> **Independent Security Audit Status**:  
> **No independent third-party commercial security audit has been performed on Voltrex Vault to date.**  
> The application has undergone rigorous internal code audits, automated cryptographic lifecycle testing, memory leakage audits, and automated static analysis. We encourage independent security researchers to review the codebase.

---

## Security Boundaries & Out-of-Scope Items

The following items are outside the trust boundary:
- Physical attacks where an attacker has unfettered hardware access or cold-boot memory extraction capabilities.
- Compromised host operating systems with active kernel rootkits, keyloggers, or memory injection tools.
- Lost or forgotten master passwords (zero-knowledge design means recovery without the master password is mathematically impossible).
- Denial of Service attacks caused by corrupted local storage or arbitrary process termination.
