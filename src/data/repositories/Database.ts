import sqlite3 from 'sqlite3';
import path from 'path';
import os from 'os';

export class Database {
    private db: sqlite3.Database;

    constructor() {
        const dbPath = path.join(os.homedir(), '.droidforge', 'data.db');
        
        // Ensure directory exists
        const fs = require('fs');
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        this.db = new sqlite3.Database(dbPath);
        this.initializeTables();
    }

    private initializeTables(): void {
        // Projects table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                status TEXT NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

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