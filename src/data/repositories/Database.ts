import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';

import { getDbPath, getLegacyDbPath } from '../../utilities/paths';

export class Database {
    private db: sqlite3.Database;

    constructor(dbPath: string = getDbPath()) {
        this.migrateLegacyDbIfNeeded(dbPath);

        // Ensure directory exists
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        this.db = new sqlite3.Database(dbPath);
        this.initializeTables();
    }

    private migrateLegacyDbIfNeeded(dbPath: string): void {
        const legacyPath = getLegacyDbPath();

        if (legacyPath === dbPath) return;
        if (!fs.existsSync(legacyPath)) return;
        if (fs.existsSync(dbPath)) return;

        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        try {
            fs.renameSync(legacyPath, dbPath);
        } catch {
            fs.copyFileSync(legacyPath, dbPath);
            try {
                fs.unlinkSync(legacyPath);
            } catch {
                // ignore
            }
        }
    }

    private initializeTables(): void {
        // Projects table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                path TEXT,
                status TEXT NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Migrate older DBs that don't have `path`
        this.db.serialize(() => {
            this.db.all('PRAGMA table_info(projects)', (err, rows: any[]) => {
                if (err) return;

                const hasPath = Array.isArray(rows) && rows.some((row: any) => row?.name === 'path');
                if (!hasPath) {
                    this.db.run('ALTER TABLE projects ADD COLUMN path TEXT');
                }

                this.db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_path ON projects(path)');
            });
        });

        // Settings table (single row)
        this.db.run(`
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY DEFAULT 1,
                theme TEXT,
                preferences TEXT
            )
        `);
    }

    getDb(): sqlite3.Database {
        return this.db;
    }

    close(): void {
        this.db.close();
    }
}