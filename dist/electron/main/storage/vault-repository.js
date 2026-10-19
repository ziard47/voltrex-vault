"use strict";
/**
 * Voltrex Vault - Vault Data Repository
 * Interface for reading and persisting encrypted records and configuration to SQLite.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VaultRepository = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
class VaultRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    isInitialized() {
        const meta = this.db.queryOne('SELECT id FROM vault_meta WHERE id = 1;');
        return meta !== null;
    }
    getMetadata() {
        const row = this.db.queryOne('SELECT * FROM vault_meta WHERE id = 1;');
        if (!row)
            return null;
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
    saveMetadata(meta, authCheckHex) {
        this.db.transaction(() => {
            this.db.run(`INSERT OR REPLACE INTO vault_meta (
          id, version, vault_id, kdf_salt_hex, kdf_memory_kib, kdf_iterations,
          kdf_parallelism, kdf_hash_length, encrypted_dek_hex,
          dek_iv_hex, dek_tag_hex, auth_check_hex, created_at, updated_at
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`, [
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
            ]);
        });
    }
    updateEncryptedDek(encryptedDekHex, dekIvHex, dekTagHex, authCheckHex, kdfSaltHex) {
        this.db.transaction(() => {
            this.db.run(`UPDATE vault_meta SET
          encrypted_dek_hex = ?,
          dek_iv_hex = ?,
          dek_tag_hex = ?,
          auth_check_hex = ?,
          kdf_salt_hex = ?,
          updated_at = ?
         WHERE id = 1;`, [encryptedDekHex, dekIvHex, dekTagHex, authCheckHex, kdfSaltHex, Date.now()]);
        });
    }
    getSettings() {
        const autoLockRow = this.db.queryOne('SELECT value FROM vault_settings WHERE key = "autoLockMinutes";');
        const clipRow = this.db.queryOne('SELECT value FROM vault_settings WHERE key = "clipboardClearSeconds";');
        const clientIdRow = this.db.queryOne('SELECT value FROM vault_settings WHERE key = "gdriveClientId";');
        const autoBackupRow = this.db.queryOne('SELECT value FROM vault_settings WHERE key = "gdriveAutoBackupEnabled";');
        const intervalRow = this.db.queryOne('SELECT value FROM vault_settings WHERE key = "gdriveIntervalMinutes";');
        const retentionRow = this.db.queryOne('SELECT value FROM vault_settings WHERE key = "gdriveRetentionCount";');
        return {
            autoLockMinutes: autoLockRow ? Number(autoLockRow.value) : 15,
            clipboardClearSeconds: clipRow ? Number(clipRow.value) : 30,
            gdriveClientId: clientIdRow?.value,
            gdriveAutoBackupEnabled: autoBackupRow ? autoBackupRow.value === 'true' : false,
            gdriveIntervalMinutes: intervalRow ? Number(intervalRow.value) : 60,
            gdriveRetentionCount: retentionRow ? Number(retentionRow.value) : 5,
        };
    }
    saveSettings(settings) {
        this.db.transaction(() => {
            this.db.run('INSERT OR REPLACE INTO vault_settings (key, value) VALUES ("autoLockMinutes", ?);', [String(settings.autoLockMinutes)]);
            this.db.run('INSERT OR REPLACE INTO vault_settings (key, value) VALUES ("clipboardClearSeconds", ?);', [String(settings.clipboardClearSeconds)]);
            if (settings.gdriveClientId !== undefined) {
                this.db.run('INSERT OR REPLACE INTO vault_settings (key, value) VALUES ("gdriveClientId", ?);', [settings.gdriveClientId]);
            }
            if (settings.gdriveAutoBackupEnabled !== undefined) {
                this.db.run('INSERT OR REPLACE INTO vault_settings (key, value) VALUES ("gdriveAutoBackupEnabled", ?);', [String(settings.gdriveAutoBackupEnabled)]);
            }
            if (settings.gdriveIntervalMinutes !== undefined) {
                this.db.run('INSERT OR REPLACE INTO vault_settings (key, value) VALUES ("gdriveIntervalMinutes", ?);', [String(settings.gdriveIntervalMinutes)]);
            }
            if (settings.gdriveRetentionCount !== undefined) {
                this.db.run('INSERT OR REPLACE INTO vault_settings (key, value) VALUES ("gdriveRetentionCount", ?);', [String(settings.gdriveRetentionCount)]);
            }
        });
    }
    getAllEntries(includeTrashed = false) {
        const sql = includeTrashed
            ? 'SELECT * FROM vault_entries ORDER BY updated_at DESC;'
            : 'SELECT * FROM vault_entries WHERE trashed_at IS NULL ORDER BY updated_at DESC;';
        const rows = this.db.query(sql);
        return rows.map(r => ({
            id: r.id,
            type: r.type,
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
    getEntryById(id) {
        const row = this.db.queryOne('SELECT * FROM vault_entries WHERE id = ?;', [id]);
        if (!row)
            return null;
        return {
            id: row.id,
            type: row.type,
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
    saveEntry(record) {
        this.db.transaction(() => {
            this.db.run(`INSERT OR REPLACE INTO vault_entries (
          id, type, title, is_favorite, created_at, updated_at, trashed_at,
          iv_hex, ciphertext_hex, tag_hex, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`, [
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
            ]);
        });
    }
    softDeleteEntry(id) {
        this.db.transaction(() => {
            this.db.run('UPDATE vault_entries SET trashed_at = ?, updated_at = ? WHERE id = ?;', [Date.now(), Date.now(), id]);
        });
    }
    restoreEntry(id) {
        this.db.transaction(() => {
            this.db.run('UPDATE vault_entries SET trashed_at = NULL, updated_at = ? WHERE id = ?;', [Date.now(), id]);
        });
    }
    permanentDeleteEntry(id) {
        this.db.transaction(() => {
            this.db.run('DELETE FROM vault_entries WHERE id = ?;', [id]);
        });
    }
    batchInsert(records) {
        this.db.transaction(() => {
            for (const record of records) {
                this.db.run(`INSERT OR REPLACE INTO vault_entries (
            id, type, title, is_favorite, created_at, updated_at, trashed_at,
            iv_hex, ciphertext_hex, tag_hex, version
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`, [
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
                ]);
            }
        });
    }
    getItemCount() {
        const row = this.db.queryOne('SELECT COUNT(*) as count FROM vault_entries WHERE trashed_at IS NULL;');
        return row ? row.count : 0;
    }
    replaceAllEntries(records) {
        this.db.transaction(() => {
            this.db.run('DELETE FROM vault_entries;');
            for (const record of records) {
                this.db.run(`INSERT INTO vault_entries (
            id, type, title, is_favorite, created_at, updated_at, trashed_at,
            iv_hex, ciphertext_hex, tag_hex, version
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`, [
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
                ]);
            }
        });
    }
    createSafetySnapshot(targetPath) {
        const binary = this.db.getDb().export();
        node_fs_1.default.writeFileSync(targetPath, Buffer.from(binary), { mode: 0o600 });
    }
}
exports.VaultRepository = VaultRepository;
