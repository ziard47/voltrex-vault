"use strict";
/**
 * Voltrex Vault - Main Process Vault Service
 * Coordinates cryptographic operations, key lifecycle, persistence, and state transitions.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VaultService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const db_1 = require("../storage/db");
const migrations_1 = require("../storage/migrations");
const vault_repository_1 = require("../storage/vault-repository");
const kdf_1 = require("../crypto/kdf");
const cipher_1 = require("../crypto/cipher");
const zeroize_1 = require("../crypto/zeroize");
const validation_1 = require("../../shared/validation");
const container_1 = require("../backup/container");
const AUTH_CHECK_SENTINEL = 'voltrex-vault-auth-token-v1';
class VaultService {
    dbManager;
    repo;
    dek = null;
    isUnlockedState = false;
    changeListeners = [];
    dbPath;
    constructor(dbPath) {
        this.dbPath = dbPath;
        this.dbManager = new db_1.DatabaseManager(dbPath);
        this.repo = new vault_repository_1.VaultRepository(this.dbManager);
    }
    async initialize() {
        await this.dbManager.initialize();
        (0, migrations_1.runMigrations)(this.dbManager);
    }
    getDbPath() {
        return this.dbPath;
    }
    getRepository() {
        return this.repo;
    }
    getDek() {
        return this.dek;
    }
    onVaultChanged(listener) {
        this.changeListeners.push(listener);
        return () => {
            this.changeListeners = this.changeListeners.filter(l => l !== listener);
        };
    }
    notifyChange() {
        for (const listener of this.changeListeners) {
            try {
                listener();
            }
            catch { /* ignore */ }
        }
    }
    getStatus() {
        const isInit = this.repo.isInitialized();
        const meta = isInit ? this.repo.getMetadata() : null;
        return {
            isInitialized: isInit,
            isUnlocked: this.isUnlockedState && this.dek !== null,
            itemCount: isInit ? this.repo.getItemCount() : 0,
            vaultId: meta?.vaultId,
        };
    }
    getSettings() {
        return this.repo.getSettings();
    }
    updateSettings(settings) {
        const current = this.repo.getSettings();
        const validated = (0, validation_1.validateSettings)({
            autoLockMinutes: settings.autoLockMinutes ?? current.autoLockMinutes,
            clipboardClearSeconds: settings.clipboardClearSeconds ?? current.clipboardClearSeconds,
            gdriveClientId: settings.gdriveClientId !== undefined ? settings.gdriveClientId : current.gdriveClientId,
            gdriveAutoBackupEnabled: settings.gdriveAutoBackupEnabled !== undefined ? settings.gdriveAutoBackupEnabled : current.gdriveAutoBackupEnabled,
            gdriveIntervalMinutes: settings.gdriveIntervalMinutes ?? current.gdriveIntervalMinutes,
            gdriveRetentionCount: settings.gdriveRetentionCount ?? current.gdriveRetentionCount,
        });
        this.repo.saveSettings(validated);
        return validated;
    }
    /**
     * Initializes a new vault with the specified master password.
     */
    async setupVault(masterPassword) {
        if (this.repo.isInitialized()) {
            throw new Error('Vault is already initialized.');
        }
        if (!masterPassword || masterPassword.length < 8) {
            throw new validation_1.ValidationError('Master password must be at least 8 characters long.');
        }
        const salt = (0, cipher_1.generateRandomBytes)(32);
        const kdfParams = kdf_1.DEFAULT_ARGON2_PARAMS;
        const { masterKey, kek, authKey } = await (0, kdf_1.deriveAllKeys)(masterPassword, salt, kdfParams);
        try {
            // Generate a fresh random 256-bit Data Encryption Key (DEK)
            const newDek = (0, cipher_1.generateDek)();
            // Encrypt the DEK with the KEK
            const encryptedDekRecord = (0, cipher_1.encryptDek)(newDek, kek);
            // Create authentication verification token
            const authPayload = (0, cipher_1.encryptPayload)(AUTH_CHECK_SENTINEL, authKey);
            const authCheckHex = JSON.stringify(authPayload);
            const metadata = {
                version: 1,
                vaultId: node_crypto_1.default.randomUUID(),
                kdfSaltHex: salt.toString('hex'),
                kdfParams,
                encryptedDekHex: encryptedDekRecord.encryptedDekHex,
                dekIvHex: encryptedDekRecord.dekIvHex,
                dekTagHex: encryptedDekRecord.dekTagHex,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };
            this.repo.saveMetadata(metadata, authCheckHex);
            // Keep DEK in memory and transition to unlocked state
            this.dek = newDek;
            this.isUnlockedState = true;
        }
        finally {
            (0, zeroize_1.zeroizeBuffers)(masterKey, kek, authKey);
        }
    }
    /**
     * Unlocks the vault using the master password.
     */
    async unlockVault(masterPassword) {
        if (!this.repo.isInitialized()) {
            throw new Error('Vault is not initialized. Please set up the vault first.');
        }
        if (this.isUnlockedState && this.dek) {
            return true;
        }
        const metadata = this.repo.getMetadata();
        if (!metadata) {
            throw new Error('Vault metadata could not be loaded.');
        }
        const salt = Buffer.from(metadata.kdfSaltHex, 'hex');
        const { masterKey, kek, authKey } = await (0, kdf_1.deriveAllKeys)(masterPassword, salt, metadata.kdfParams);
        try {
            // 1. Verify password validity using the auth check token
            try {
                const authPayload = JSON.parse(metadata.authCheckHex);
                const decryptedSentinel = (0, cipher_1.decryptPayload)(authPayload, authKey);
                if (decryptedSentinel !== AUTH_CHECK_SENTINEL) {
                    throw new Error('Invalid master password.');
                }
            }
            catch {
                throw new Error('Invalid master password.');
            }
            // 2. Decrypt the Data Encryption Key (DEK)
            const decryptedDek = (0, cipher_1.decryptDek)(metadata.encryptedDekHex, metadata.dekIvHex, metadata.dekTagHex, kek);
            this.dek = decryptedDek;
            this.isUnlockedState = true;
            return true;
        }
        finally {
            (0, zeroize_1.zeroizeBuffers)(masterKey, kek, authKey);
        }
    }
    /**
     * Locks the vault immediately and securely zeroizes memory buffers.
     */
    lockVault() {
        if (this.dek) {
            (0, zeroize_1.zeroizeBuffer)(this.dek);
            this.dek = null;
        }
        this.isUnlockedState = false;
    }
    /**
     * Changes the master password, re-encrypting the existing DEK under the new KEK.
     */
    async changeMasterPassword(currentPassword, newPassword) {
        this.ensureUnlocked();
        if (!newPassword || newPassword.length < 8) {
            throw new validation_1.ValidationError('New master password must be at least 8 characters long.');
        }
        // Verify current password first
        const metadata = this.repo.getMetadata();
        if (!metadata)
            throw new Error('Metadata missing.');
        const oldSalt = Buffer.from(metadata.kdfSaltHex, 'hex');
        const oldKeys = await (0, kdf_1.deriveAllKeys)(currentPassword, oldSalt, metadata.kdfParams);
        try {
            const authPayload = JSON.parse(metadata.authCheckHex);
            const decryptedSentinel = (0, cipher_1.decryptPayload)(authPayload, oldKeys.authKey);
            if (decryptedSentinel !== AUTH_CHECK_SENTINEL) {
                throw new Error('Current master password verification failed.');
            }
        }
        catch {
            throw new Error('Current master password verification failed.');
        }
        finally {
            (0, zeroize_1.zeroizeBuffers)(oldKeys.masterKey, oldKeys.kek, oldKeys.authKey);
        }
        // Derive new keys with fresh salt
        const newSalt = (0, cipher_1.generateRandomBytes)(32);
        const newKeys = await (0, kdf_1.deriveAllKeys)(newPassword, newSalt, metadata.kdfParams);
        try {
            // Re-encrypt existing DEK under new KEK
            const encryptedDekRecord = (0, cipher_1.encryptDek)(this.dek, newKeys.kek);
            const newAuthPayload = (0, cipher_1.encryptPayload)(AUTH_CHECK_SENTINEL, newKeys.authKey);
            this.repo.updateEncryptedDek(encryptedDekRecord.encryptedDekHex, encryptedDekRecord.dekIvHex, encryptedDekRecord.dekTagHex, JSON.stringify(newAuthPayload), newSalt.toString('hex'));
        }
        finally {
            (0, zeroize_1.zeroizeBuffers)(newKeys.masterKey, newKeys.kek, newKeys.authKey);
        }
    }
    /**
     * Retrieves and decrypts all entries in the vault.
     */
    listEntries(includeTrashed = false) {
        this.ensureUnlocked();
        const records = this.repo.getAllEntries(includeTrashed);
        const results = [];
        for (const record of records) {
            try {
                const payload = (0, cipher_1.decryptPayload)({
                    ivHex: record.ivHex,
                    ciphertextHex: record.ciphertextHex,
                    tagHex: record.tagHex,
                    version: record.version,
                }, this.dek);
                results.push({
                    id: record.id,
                    type: record.type,
                    title: record.title,
                    isFavorite: record.isFavorite,
                    createdAt: record.createdAt,
                    updatedAt: record.updatedAt,
                    trashedAt: record.trashedAt,
                    payload,
                });
            }
            catch (err) {
                // Skip corrupt entry or log non-sensitive warning
                console.error(`[VaultService] Failed to decrypt entry ${record.id}: integrity check failed.`);
            }
        }
        return results;
    }
    getEntry(id) {
        this.ensureUnlocked();
        const record = this.repo.getEntryById(id);
        if (!record)
            return null;
        const payload = (0, cipher_1.decryptPayload)({
            ivHex: record.ivHex,
            ciphertextHex: record.ciphertextHex,
            tagHex: record.tagHex,
            version: record.version,
        }, this.dek);
        return {
            id: record.id,
            type: record.type,
            title: record.title,
            isFavorite: record.isFavorite,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            trashedAt: record.trashedAt,
            payload,
        };
    }
    saveEntry(entry) {
        this.ensureUnlocked();
        const validatedPayload = (0, validation_1.validatePayload)(entry.payload);
        const id = entry.id || node_crypto_1.default.randomUUID();
        const isFavorite = Boolean(entry.isFavorite);
        const now = Date.now();
        const existing = this.repo.getEntryById(id);
        const createdAt = existing ? existing.createdAt : now;
        // Encrypt the payload with DEK using a unique 12-byte IV
        const encrypted = (0, cipher_1.encryptPayload)(validatedPayload, this.dek);
        const record = {
            id,
            type: entry.type,
            title: entry.title.trim() || validatedPayload.title,
            isFavorite,
            createdAt,
            updatedAt: now,
            trashedAt: null,
            ivHex: encrypted.ivHex,
            ciphertextHex: encrypted.ciphertextHex,
            tagHex: encrypted.tagHex,
            version: 1,
        };
        this.repo.saveEntry(record);
        this.notifyChange();
        return {
            id,
            type: entry.type,
            title: record.title,
            isFavorite,
            createdAt,
            updatedAt: now,
            payload: validatedPayload,
        };
    }
    toggleFavorite(id) {
        this.ensureUnlocked();
        const record = this.repo.getEntryById(id);
        if (!record)
            throw new Error('Entry not found.');
        record.isFavorite = !record.isFavorite;
        record.updatedAt = Date.now();
        this.repo.saveEntry(record);
        this.notifyChange();
        return record.isFavorite;
    }
    softDeleteEntry(id) {
        this.ensureUnlocked();
        this.repo.softDeleteEntry(id);
        this.notifyChange();
    }
    restoreEntry(id) {
        this.ensureUnlocked();
        this.repo.restoreEntry(id);
        this.notifyChange();
    }
    permanentDeleteEntry(id) {
        this.ensureUnlocked();
        this.repo.permanentDeleteEntry(id);
        this.notifyChange();
    }
    /**
     * Generates a plaintext export of the vault entries.
     * STRICT SECURITY REQUIREMENT:
     * Requires master password confirmation.
     */
    async exportVault(masterPassword) {
        this.ensureUnlocked();
        // Verify master password before allowing export
        const metadata = this.repo.getMetadata();
        if (!metadata)
            throw new Error('Metadata missing.');
        const salt = Buffer.from(metadata.kdfSaltHex, 'hex');
        const { masterKey, kek, authKey } = await (0, kdf_1.deriveAllKeys)(masterPassword, salt, metadata.kdfParams);
        try {
            const authPayload = JSON.parse(metadata.authCheckHex);
            const decryptedSentinel = (0, cipher_1.decryptPayload)(authPayload, authKey);
            if (decryptedSentinel !== AUTH_CHECK_SENTINEL) {
                throw new Error('Master password verification failed. Export aborted.');
            }
        }
        catch {
            throw new Error('Master password verification failed. Export aborted.');
        }
        finally {
            (0, zeroize_1.zeroizeBuffers)(masterKey, kek, authKey);
        }
        const entries = this.listEntries(false);
        return {
            format: 'voltrex-vault-unencrypted-export',
            exportVersion: 1,
            exportedAt: Date.now(),
            entries,
        };
    }
    /**
     * Imports validated entries into the vault.
     */
    importVault(rawJsonData) {
        this.ensureUnlocked();
        const validatedData = (0, validation_1.validateExportData)(rawJsonData);
        const recordsToInsert = [];
        const now = Date.now();
        for (const entry of validatedData.entries) {
            const encrypted = (0, cipher_1.encryptPayload)(entry.payload, this.dek);
            recordsToInsert.push({
                id: entry.id || node_crypto_1.default.randomUUID(),
                type: entry.type,
                title: entry.title,
                isFavorite: entry.isFavorite,
                createdAt: entry.createdAt || now,
                updatedAt: now,
                trashedAt: null,
                ivHex: encrypted.ivHex,
                ciphertextHex: encrypted.ciphertextHex,
                tagHex: encrypted.tagHex,
                version: 1,
            });
        }
        this.repo.batchInsert(recordsToInsert);
        this.notifyChange();
        return { importedCount: recordsToInsert.length };
    }
    /**
     * Generates a versioned, zero-knowledge encrypted backup container.
     */
    createBackup() {
        this.ensureUnlocked();
        const meta = this.repo.getMetadata();
        if (!meta)
            throw new Error('Cannot create backup: metadata missing.');
        return (0, container_1.createBackupContainer)(this, meta, this.dek);
    }
    /**
     * Restores vault from decrypted backup data in a single SQLite transaction
     * with safety snapshot rollback on failure.
     */
    restoreFromDecryptedBackup(decrypted) {
        this.ensureUnlocked();
        // 1. Create safety snapshot of current database
        const snapshotPath = node_path_1.default.join(node_path_1.default.dirname(this.dbPath), `pre-restore-snapshot-${Date.now()}.db`);
        try {
            this.repo.createSafetySnapshot(snapshotPath);
        }
        catch (e) {
            console.warn('[VaultService] Failed to create safety snapshot:', e);
        }
        try {
            const now = Date.now();
            const recordsToInsert = [];
            for (const entry of decrypted.entries) {
                const encrypted = (0, cipher_1.encryptPayload)(entry.payload, this.dek);
                recordsToInsert.push({
                    id: entry.id || node_crypto_1.default.randomUUID(),
                    type: entry.type,
                    title: entry.title,
                    isFavorite: entry.isFavorite,
                    createdAt: entry.createdAt || now,
                    updatedAt: now,
                    trashedAt: entry.trashedAt || null,
                    ivHex: encrypted.ivHex,
                    ciphertextHex: encrypted.ciphertextHex,
                    tagHex: encrypted.tagHex,
                    version: 1,
                });
            }
            this.repo.replaceAllEntries(recordsToInsert);
            this.notifyChange();
        }
        catch (err) {
            // Restore from safety snapshot on failure
            if (node_fs_1.default.existsSync(snapshotPath)) {
                try {
                    node_fs_1.default.copyFileSync(snapshotPath, this.dbPath);
                }
                catch { /* ignore */ }
            }
            throw err;
        }
    }
    close() {
        this.lockVault();
        this.dbManager.close();
    }
    ensureUnlocked() {
        if (!this.isUnlockedState || !this.dek) {
            throw new Error('Vault is locked. Please unlock the vault first.');
        }
    }
}
exports.VaultService = VaultService;
