/**
 * Voltrex Vault - Schema Migrations
 * Executes deterministic, version-tracked database migrations.
 */

import { DatabaseManager } from './db';

export interface Migration {
  version: number;
  name: string;
  up: (db: DatabaseManager) => void;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial_vault_schema',
    up: (db: DatabaseManager) => {
      // 1. Vault Metadata Table (Stores KDF parameters and encrypted DEK)
      db.run(`
        CREATE TABLE IF NOT EXISTS vault_meta (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          version INTEGER NOT NULL DEFAULT 1,
          kdf_salt_hex TEXT NOT NULL,
          kdf_memory_kib INTEGER NOT NULL,
          kdf_iterations INTEGER NOT NULL,
          kdf_parallelism INTEGER NOT NULL,
          kdf_hash_length INTEGER NOT NULL,
          encrypted_dek_hex TEXT NOT NULL,
          dek_iv_hex TEXT NOT NULL,
          dek_tag_hex TEXT NOT NULL,
          auth_check_hex TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `);

      // 2. Vault Entries Table (Contains encrypted payloads; zero sensitive plaintext)
      db.run(`
        CREATE TABLE IF NOT EXISTS vault_entries (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          is_favorite INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          trashed_at INTEGER,
          iv_hex TEXT NOT NULL,
          ciphertext_hex TEXT NOT NULL,
          tag_hex TEXT NOT NULL,
          version INTEGER NOT NULL DEFAULT 1
        );
      `);

      // 3. Vault Settings Table (Key-Value pairs for user preferences)
      db.run(`
        CREATE TABLE IF NOT EXISTS vault_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);

      // Create helpful indexes for performance
      db.run(`CREATE INDEX IF NOT EXISTS idx_vault_entries_type ON vault_entries(type);`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_vault_entries_favorite ON vault_entries(is_favorite);`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_vault_entries_trashed ON vault_entries(trashed_at);`);
    },
  },
  {
    version: 2,
    name: 'add_vault_id_and_gdrive_support',
    up: (db: DatabaseManager) => {
      try {
        db.run('ALTER TABLE vault_meta ADD COLUMN vault_id TEXT;');
      } catch {
        // Ignored if already added
      }

      const existing = db.queryOne<{ id: number; vault_id: string | null }>('SELECT id, vault_id FROM vault_meta WHERE id = 1;');
      if (existing && !existing.vault_id) {
        const generatedVaultId = require('node:crypto').randomUUID();
        db.run('UPDATE vault_meta SET vault_id = ? WHERE id = 1;', [generatedVaultId]);
      }
    },
  },
];

export function runMigrations(db: DatabaseManager): void {
  // Ensure schema_migrations table exists
  db.run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `);

  const appliedRows = db.query<{ version: number }>('SELECT version FROM schema_migrations ORDER BY version ASC;');
  const appliedSet = new Set(appliedRows.map(r => r.version));

  for (const migration of MIGRATIONS) {
    if (!appliedSet.has(migration.version)) {
      db.transaction(() => {
        migration.up(db);
        db.run(
          'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);',
          [migration.version, migration.name, Date.now()]
        );
      });
    }
  }
}
