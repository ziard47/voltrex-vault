import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VaultService } from '../src/main/services/vault-service';
import fs from 'node:fs';
import path from 'node:path';

const LEAKAGE_DB_PATH = path.join(__dirname, 'leakage_test_vault.db');

describe('Security & Secret Leakage Prevention Audit', () => {
  let service: VaultService;
  const consoleLogSpy = vi.spyOn(console, 'log');
  const consoleErrorSpy = vi.spyOn(console, 'error');
  const consoleWarnSpy = vi.spyOn(console, 'warn');

  const SENSITIVE_MASTER_PASSWORD = 'AuditMasterPassword#2026!';
  const SENSITIVE_ENTRY_PASSWORD = 'SuperSensitivePasswordPlaintext123$';
  const SENSITIVE_CARD_NUMBER = '4111222233334444';
  const SENSITIVE_NOTE = 'TopSecretSecretRecoveryPhraseWords';

  beforeEach(async () => {
    consoleLogSpy.mockClear();
    consoleErrorSpy.mockClear();
    consoleWarnSpy.mockClear();

    if (fs.existsSync(LEAKAGE_DB_PATH)) {
      try { fs.unlinkSync(LEAKAGE_DB_PATH); } catch { /* ignore */ }
    }
    service = new VaultService(LEAKAGE_DB_PATH);
    await service.initialize();
  });

  afterEach(() => {
    if (service) {
      service.close();
    }
    if (fs.existsSync(LEAKAGE_DB_PATH)) {
      try { fs.unlinkSync(LEAKAGE_DB_PATH); } catch { /* ignore */ }
    }
  });

  it('verifies plaintext passwords, card numbers, and secret notes are never written to disk unencrypted', async () => {
    await service.setupVault(SENSITIVE_MASTER_PASSWORD);

    service.saveEntry({
      type: 'login',
      title: 'Banking Portal',
      payload: {
        type: 'login',
        title: 'Banking Portal',
        username: 'bankuser@example.com',
        password: SENSITIVE_ENTRY_PASSWORD,
      },
    });

    service.saveEntry({
      type: 'card',
      title: 'Corporate Visa',
      payload: {
        type: 'card',
        title: 'Corporate Visa',
        cardholderName: 'Alice Auditor',
        cardNumber: SENSITIVE_CARD_NUMBER,
        expirationMonth: '05',
        expirationYear: '2029',
        cvv: '987',
      },
    });

    service.saveEntry({
      type: 'note',
      title: 'Secret Notes',
      payload: {
        type: 'note',
        title: 'Secret Notes',
        content: SENSITIVE_NOTE,
      },
    });

    // Close and flush to disk
    service.close();

    // Inspect the raw bytes of the SQLite database file
    const rawDbBuffer = fs.readFileSync(LEAKAGE_DB_PATH);
    const rawDbString = rawDbBuffer.toString('utf8');

    expect(rawDbString).not.toContain(SENSITIVE_MASTER_PASSWORD);
    expect(rawDbString).not.toContain(SENSITIVE_ENTRY_PASSWORD);
    expect(rawDbString).not.toContain(SENSITIVE_CARD_NUMBER);
    expect(rawDbString).not.toContain(SENSITIVE_NOTE);
  });

  it('verifies that failed decryption or auth failures do not leak secrets to console logs', async () => {
    await service.setupVault(SENSITIVE_MASTER_PASSWORD);
    service.lockVault();

    // Attempt unlock with wrong password
    await expect(service.unlockVault('WrongSecretGuess')).rejects.toThrow();

    const allConsoleCalls = [
      ...consoleLogSpy.mock.calls,
      ...consoleErrorSpy.mock.calls,
      ...consoleWarnSpy.mock.calls,
    ].flat().join(' ');

    expect(allConsoleCalls).not.toContain(SENSITIVE_MASTER_PASSWORD);
    expect(allConsoleCalls).not.toContain('WrongSecretGuess');
  });
});
