import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseManager } from '../src/main/storage/db';
import { runMigrations } from '../src/main/storage/migrations';
import { VaultRepository } from '../src/main/storage/vault-repository';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB_PATH = path.join(__dirname, 'test_vault.db');

describe('Storage & Migration Engine', () => {
  let dbManager: DatabaseManager;
  let repo: VaultRepository;

  beforeEach(async () => {
    if (fs.existsSync(TEST_DB_PATH)) {
      try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }
    }
    dbManager = new DatabaseManager(TEST_DB_PATH);
    await dbManager.initialize();
    runMigrations(dbManager);
    repo = new VaultRepository(dbManager);
  });

  afterEach(() => {
    if (dbManager) {
      dbManager.close();
    }
    if (fs.existsSync(TEST_DB_PATH)) {
      try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }
    }
  });

  it('runs schema migrations and creates required tables', () => {
    const applied = dbManager.query<{ version: number }>('SELECT version FROM schema_migrations;');
    expect(applied.some(m => m.version === 1)).toBe(true);

    expect(repo.isInitialized()).toBe(false);
  });

  it('persists and retrieves vault settings', () => {
    const initial = repo.getSettings();
    expect(initial.autoLockMinutes).toBe(15);
    expect(initial.clipboardClearSeconds).toBe(30);

    repo.saveSettings({ autoLockMinutes: 5, clipboardClearSeconds: 60 });
    const updated = repo.getSettings();
    expect(updated.autoLockMinutes).toBe(5);
    expect(updated.clipboardClearSeconds).toBe(60);
  });

  it('performs CRUD operations on encrypted records', () => {
    const record = {
      id: 'rec-1',
      type: 'login' as const,
      title: 'Amazon',
      isFavorite: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      trashedAt: null,
      ivHex: 'abcdef1234567890abcdef12',
      ciphertextHex: '0123456789abcdef',
      tagHex: '1234567890abcdef1234567890abcdef',
      version: 1,
    };

    repo.saveEntry(record);
    expect(repo.getItemCount()).toBe(1);

    const fetched = repo.getEntryById('rec-1');
    expect(fetched).not.toBeNull();
    expect(fetched?.title).toBe('Amazon');
    expect(fetched?.isFavorite).toBe(true);

    // Soft delete
    repo.softDeleteEntry('rec-1');
    expect(repo.getAllEntries(false)).toHaveLength(0);
    expect(repo.getAllEntries(true)).toHaveLength(1);

    // Restore
    repo.restoreEntry('rec-1');
    expect(repo.getAllEntries(false)).toHaveLength(1);

    // Permanent delete
    repo.permanentDeleteEntry('rec-1');
    expect(repo.getAllEntries(true)).toHaveLength(0);
  });
});
