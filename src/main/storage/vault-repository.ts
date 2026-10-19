/**
 * Voltrex Vault - Vault Data Repository
 * Interface for reading and persisting encrypted records and configuration to SQLite.
 */

import fs from 'node:fs';
import { DatabaseManager } from './db';
import { EncryptedRecord, VaultMetadata, VaultSettings } from '../../shared/types';

export class VaultRepository {
  private db: DatabaseManager;

  constructor(db: DatabaseManager) {
    this.db = db;
  }

  public isInitialized(): boolean {
    const meta = this.db.queryOne('SELECT id FROM vault_meta WHERE id = 1;');
    return meta !== null;
  }

  public getMetadata(): (VaultMetadata & { authCheckHex: string }) | null {
    const row = this.db.queryOne<{
      id: number;
      version: number;
      vault_id?: string;
      kdf_salt_hex: string;
      kdf_memory_kib: number;
      kdf_iterations: number;
      kdf_parallelism: number;
      kdf_hash_length: number;
      encrypted_dek_hex: string;
      dek_iv_hex: string;
      dek_tag_hex: string;
      auth_check_hex: string;
      created_at: number;
      updated_at: number;
    }>('SELECT * FROM vault_meta WHERE id = 1;');

    if (!row) return null;

    return {
      version: row.version,
      vaultId: row.vault_id || 'default-vault-id',
      kdfSaltHex: row.kdf_salt_hex,
      kdfParams: {
        memoryKiB: row.kdf_memory_kib,
        iterations: row.kdf_iterations,
        parallelism: row.kdf_parallelism,
        hashLength: row.kdf_hash_length,
      },
      encryptedDekHex: row.encrypted_dek_hex,
      dekIvHex: row.dek_iv_hex,
      dekTagHex: row.dek_tag_hex,
      authCheckHex: row.auth_check_hex,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  public saveMetadata(meta: VaultMetadata, authCheckHex: string): void {
    this.db.transaction(() => {
      this.db.run(
        `INSERT OR REPLACE INTO vault_meta (
          id, version, vault_id, kdf_salt_hex, kdf_memory_kib, kdf_iterations,
          kdf_parallelism, kdf_hash_length, encrypted_dek_hex,
          dek_iv_hex, dek_tag_hex, auth_check_hex, created_at, updated_at
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          meta.version,
          meta.vaultId,
          meta.kdfSaltHex,
          meta.kdfParams.memoryKiB,
          meta.kdfParams.iterations,
          meta.kdfParams.parallelism,
          meta.kdfParams.hashLength,
          meta.encryptedDekHex,
          meta.dekIvHex,
          meta.dekTagHex,
          authCheckHex,
          meta.createdAt,
          meta.updatedAt,
        ]
      );
    });
  }

  public updateEncryptedDek(
    encryptedDekHex: string,
    dekIvHex: string,
    dekTagHex: string,
    authCheckHex: string,
    kdfSaltHex: string
  ): void {
    this.db.transaction(() => {
      this.db.run(
        `UPDATE vault_meta SET
          encrypted_dek_hex = ?,
          dek_iv_hex = ?,
          dek_tag_hex = ?,
          auth_check_hex = ?,
          kdf_salt_hex = ?,
          updated_at = ?
         WHERE id = 1;`,
        [encryptedDekHex, dekIvHex, dekTagHex, authCheckHex, kdfSaltHex, Date.now()]
      );
    });
  }

  public getSettings(): VaultSettings {
    const autoLockRow = this.db.queryOne<{ value: string }>('SELECT value FROM vault_settings WHERE key = "autoLockMinutes";');
    const clipRow = this.db.queryOne<{ value: string }>('SELECT value FROM vault_settings WHERE key = "clipboardClearSeconds";');
    const clientIdRow = this.db.queryOne<{ value: string }>('SELECT value FROM vault_settings WHERE key = "gdriveClientId";');
    const autoBackupRow = this.db.queryOne<{ value: string }>('SELECT value FROM vault_settings WHERE key = "gdriveAutoBackupEnabled";');
    const intervalRow = this.db.queryOne<{ value: string }>('SELECT value FROM vault_settings WHERE key = "gdriveIntervalMinutes";');
    const retentionRow = this.db.queryOne<{ value: string }>('SELECT value FROM vault_settings WHERE key = "gdriveRetentionCount";');

    return {
      autoLockMinutes: autoLockRow ? Number(autoLockRow.value) : 15,
      clipboardClearSeconds: clipRow ? Number(clipRow.value) : 30,
      gdriveClientId: clientIdRow?.value,
      gdriveAutoBackupEnabled: autoBackupRow ? autoBackupRow.value === 'true' : false,
      gdriveIntervalMinutes: intervalRow ? Number(intervalRow.value) : 60,
      gdriveRetentionCount: retentionRow ? Number(retentionRow.value) : 5,
    };
  }

  public saveSettings(settings: VaultSettings): void {
    this.db.transaction(() => {
      this.db.run(
        'INSERT OR REPLACE INTO vault_settings (key, value) VALUES ("autoLockMinutes", ?);',
        [String(settings.autoLockMinutes)]
      );
      this.db.run(
        'INSERT OR REPLACE INTO vault_settings (key, value) VALUES ("clipboardClearSeconds", ?);',
        [String(settings.clipboardClearSeconds)]
      );
      if (settings.gdriveClientId !== undefined) {
        this.db.run(
          'INSERT OR REPLACE INTO vault_settings (key, value) VALUES ("gdriveClientId", ?);',
          [settings.gdriveClientId]
        );
      }
      if (settings.gdriveAutoBackupEnabled !== undefined) {
        this.db.run(
          'INSERT OR REPLACE INTO vault_settings (key, value) VALUES ("gdriveAutoBackupEnabled", ?);',
          [String(settings.gdriveAutoBackupEnabled)]
        );
      }
      if (settings.gdriveIntervalMinutes !== undefined) {
        this.db.run(
          'INSERT OR REPLACE INTO vault_settings (key, value) VALUES ("gdriveIntervalMinutes", ?);',
          [String(settings.gdriveIntervalMinutes)]
        );
      }
      if (settings.gdriveRetentionCount !== undefined) {
        this.db.run(
          'INSERT OR REPLACE INTO vault_settings (key, value) VALUES ("gdriveRetentionCount", ?);',
          [String(settings.gdriveRetentionCount)]
        );
      }
    });
  }

  public getAllEntries(includeTrashed = false): EncryptedRecord[] {
    const sql = includeTrashed
      ? 'SELECT * FROM vault_entries ORDER BY updated_at DESC;'
      : 'SELECT * FROM vault_entries WHERE trashed_at IS NULL ORDER BY updated_at DESC;';

    const rows = this.db.query<{
      id: string;
      type: string;
      title: string;
      is_favorite: number;
      created_at: number;
      updated_at: number;
      trashed_at: number | null;
      iv_hex: string;
      ciphertext_hex: string;
      tag_hex: string;
      version: number;
    }>(sql);

    return rows.map(r => ({
      id: r.id,
      type: r.type as EncryptedRecord['type'],
      title: r.title,
      isFavorite: r.is_favorite === 1,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      trashedAt: r.trashed_at,
      ivHex: r.iv_hex,
      ciphertextHex: r.ciphertext_hex,
      tagHex: r.tag_hex,
      version: r.version,
    }));
  }

  public getEntryById(id: string): EncryptedRecord | null {
    const row = this.db.queryOne<{
      id: string;
      type: string;
      title: string;
      is_favorite: number;
      created_at: number;
      updated_at: number;
      trashed_at: number | null;
      iv_hex: string;
      ciphertext_hex: string;
      tag_hex: string;
      version: number;
    }>('SELECT * FROM vault_entries WHERE id = ?;', [id]);

    if (!row) return null;

    return {
      id: row.id,
      type: row.type as EncryptedRecord['type'],
      title: row.title,
      isFavorite: row.is_favorite === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      trashedAt: row.trashed_at,
      ivHex: row.iv_hex,
      ciphertextHex: row.ciphertext_hex,
      tagHex: row.tag_hex,
      version: row.version,
    };
  }

  public saveEntry(record: EncryptedRecord): void {
    this.db.transaction(() => {
      this.db.run(
        `INSERT OR REPLACE INTO vault_entries (
          id, type, title, is_favorite, created_at, updated_at, trashed_at,
          iv_hex, ciphertext_hex, tag_hex, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          record.id,
          record.type,
          record.title,
          record.isFavorite ? 1 : 0,
          record.createdAt,
          record.updatedAt,
          record.trashedAt ?? null,
          record.ivHex,
          record.ciphertextHex,
          record.tagHex,
          record.version,
        ]
      );
    });
  }

  public softDeleteEntry(id: string): void {
    this.db.transaction(() => {
      this.db.run(
        'UPDATE vault_entries SET trashed_at = ?, updated_at = ? WHERE id = ?;',
        [Date.now(), Date.now(), id]
      );
    });
  }

  public restoreEntry(id: string): void {
    this.db.transaction(() => {
      this.db.run(
        'UPDATE vault_entries SET trashed_at = NULL, updated_at = ? WHERE id = ?;',
        [Date.now(), id]
      );
    });
  }

  public permanentDeleteEntry(id: string): void {
    this.db.transaction(() => {
      this.db.run('DELETE FROM vault_entries WHERE id = ?;', [id]);
    });
  }

  public batchInsert(records: EncryptedRecord[]): void {
    this.db.transaction(() => {
      for (const record of records) {
        this.db.run(
          `INSERT OR REPLACE INTO vault_entries (
            id, type, title, is_favorite, created_at, updated_at, trashed_at,
            iv_hex, ciphertext_hex, tag_hex, version
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            record.id,
            record.type,
            record.title,
            record.isFavorite ? 1 : 0,
            record.createdAt,
            record.updatedAt,
            record.trashedAt ?? null,
            record.ivHex,
            record.ciphertextHex,
            record.tagHex,
            record.version,
          ]
        );
      }
    });
  }

  public getItemCount(): number {
    const row = this.db.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM vault_entries WHERE trashed_at IS NULL;'
    );
    return row ? row.count : 0;
  }

  public replaceAllEntries(records: EncryptedRecord[]): void {
    this.db.transaction(() => {
      this.db.run('DELETE FROM vault_entries;');
      for (const record of records) {
        this.db.run(
          `INSERT INTO vault_entries (
            id, type, title, is_favorite, created_at, updated_at, trashed_at,
            iv_hex, ciphertext_hex, tag_hex, version
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            record.id,
            record.type,
            record.title,
            record.isFavorite ? 1 : 0,
            record.createdAt,
            record.updatedAt,
            record.trashedAt ?? null,
            record.ivHex,
            record.ciphertextHex,
            record.tagHex,
            record.version,
          ]
        );
      }
    });
  }

  public createSafetySnapshot(targetPath: string): void {
    const binary = this.db.getDb().export();
    fs.writeFileSync(targetPath, Buffer.from(binary), { mode: 0o600 });
  }
}
