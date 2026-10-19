"use strict";
/**
 * Voltrex Vault - Database Engine (SQLite via sql.js)
 * Provides transactional, atomic, disk-persisted SQLite storage with strict file permissions.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseManager = void 0;
const sql_js_1 = __importDefault(require("sql.js"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
let sqlEngine = null;
class DatabaseManager {
    db = null;
    dbPath;
    constructor(dbPath) {
        this.dbPath = dbPath;
    }
    async initialize() {
        if (!sqlEngine) {
            sqlEngine = await (0, sql_js_1.default)();
        }
        const dir = node_path_1.default.dirname(this.dbPath);
        if (!node_fs_1.default.existsSync(dir)) {
            node_fs_1.default.mkdirSync(dir, { recursive: true, mode: 0o700 });
        }
        if (node_fs_1.default.existsSync(this.dbPath)) {
            const fileBuffer = node_fs_1.default.readFileSync(this.dbPath);
            this.db = new sqlEngine.Database(fileBuffer);
        }
        else {
            this.db = new sqlEngine.Database();
            this.persist();
        }
    }
    getDb() {
        if (!this.db) {
            throw new Error('Database is not initialized. Call initialize() first.');
        }
        return this.db;
    }
    run(sql, params) {
        const db = this.getDb();
        if (params && params.length > 0) {
            db.run(sql, params);
        }
        else {
            db.run(sql);
        }
    }
    exec(sql) {
        return this.getDb().exec(sql);
    }
    query(sql, params) {
        const db = this.getDb();
        const stmt = db.prepare(sql);
        if (params && params.length > 0) {
            stmt.bind(params);
        }
        const results = [];
        while (stmt.step()) {
            results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
    }
    queryOne(sql, params) {
        const results = this.query(sql, params);
        return results.length > 0 ? results[0] : null;
    }
    /**
     * Persists database atomically to disk with restrictive 0600 file permissions.
     */
    persist() {
        if (!this.db)
            return;
        const binaryArray = this.db.export();
        const buffer = Buffer.from(binaryArray);
        const tempPath = `${this.dbPath}.tmp.${Date.now()}`;
        try {
            node_fs_1.default.writeFileSync(tempPath, buffer, { mode: 0o600 });
            node_fs_1.default.renameSync(tempPath, this.dbPath);
            // Ensure file permissions are restrictive (owner read/write only)
            try {
                node_fs_1.default.chmodSync(this.dbPath, 0o600);
            }
            catch {
                // Ignored if OS doesn't support chmod
            }
        }
        catch (err) {
            if (node_fs_1.default.existsSync(tempPath)) {
                try {
                    node_fs_1.default.unlinkSync(tempPath);
                }
                catch { /* ignore */ }
            }
            throw err;
        }
    }
    /**
     * Executes a callback within a SQLite transaction.
     * Automatically commits on success and rolls back on failure.
     */
    transaction(callback) {
        const db = this.getDb();
        db.run('BEGIN TRANSACTION;');
        try {
            const result = callback();
            db.run('COMMIT;');
            this.persist();
            return result;
        }
        catch (error) {
            try {
                db.run('ROLLBACK;');
            }
            catch {
                // Rollback error ignored
            }
            throw error;
        }
    }
    close() {
        if (this.db) {
            this.persist();
            this.db.close();
            this.db = null;
        }
    }
}
exports.DatabaseManager = DatabaseManager;
