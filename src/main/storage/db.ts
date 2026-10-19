/**
 * Voltrex Vault - Database Engine (SQLite via sql.js)
 * Provides transactional, atomic, disk-persisted SQLite storage with strict file permissions.
 */

import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';

let sqlEngine: SqlJsStatic | null = null;

export class DatabaseManager {
  private db: Database | null = null;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  public async initialize(): Promise<void> {
    if (!sqlEngine) {
      sqlEngine = await initSqlJs();
    }

    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }

    if (fs.existsSync(this.dbPath)) {
      const fileBuffer = fs.readFileSync(this.dbPath);
      this.db = new sqlEngine.Database(fileBuffer);
    } else {
      this.db = new sqlEngine.Database();
      this.persist();
    }
  }

  public getDb(): Database {
    if (!this.db) {
      throw new Error('Database is not initialized. Call initialize() first.');
    }
    return this.db;
  }

  public run(sql: string, params?: unknown[]): void {
    const db = this.getDb();
    if (params && params.length > 0) {
      db.run(sql, params as (number | string | Uint8Array | null)[]);
    } else {
      db.run(sql);
    }
  }

  public exec(sql: string): { columns: string[]; values: unknown[][] }[] {
    return this.getDb().exec(sql);
  }

  public query<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[] {
    const db = this.getDb();
    const stmt = db.prepare(sql);
    if (params && params.length > 0) {
      stmt.bind(params as (number | string | Uint8Array | null)[]);
    }

    const results: T[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return results;
  }

  public queryOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | null {
    const results = this.query<T>(sql, params);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Persists database atomically to disk with restrictive 0600 file permissions.
   */
  public persist(): void {
    if (!this.db) return;
    const binaryArray = this.db.export();
    const buffer = Buffer.from(binaryArray);

    const tempPath = `${this.dbPath}.tmp.${Date.now()}`;
    try {
      fs.writeFileSync(tempPath, buffer, { mode: 0o600 });
      fs.renameSync(tempPath, this.dbPath);
      // Ensure file permissions are restrictive (owner read/write only)
      try {
        fs.chmodSync(this.dbPath, 0o600);
      } catch {
        // Ignored if OS doesn't support chmod
      }
    } catch (err) {
      if (fs.existsSync(tempPath)) {
        try { fs.unlinkSync(tempPath); } catch { /* ignore */ }
      }
      throw err;
    }
  }

  /**
   * Executes a callback within a SQLite transaction.
   * Automatically commits on success and rolls back on failure.
   */
  public transaction<T>(callback: () => T): T {
    const db = this.getDb();
    db.run('BEGIN TRANSACTION;');
    try {
      const result = callback();
      db.run('COMMIT;');
      this.persist();
      return result;
    } catch (error) {
      try {
        db.run('ROLLBACK;');
      } catch {
        // Rollback error ignored
      }
      throw error;
    }
  }

  public close(): void {
    if (this.db) {
      this.persist();
      this.db.close();
      this.db = null;
    }
  }
}
