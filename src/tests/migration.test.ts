import { afterEach, describe, expect, test } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sqlite3 from 'sqlite3';

import { migrateDbFileIfNeeded, readSettingsFromSqlite } from '../bootstrap';

let tempDir: string | null = null;

afterEach(async () => {
    if (tempDir) {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
        tempDir = null;
    }
});

describe('migration helpers', () => {
    test('migrateDbFileIfNeeded moves legacy db file', async () => {
        tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'droidforge-test-'));
        const fromPath = path.join(tempDir, 'legacy.db');
        const toPath = path.join(tempDir, 'new', 'droidforge.db');

        await fs.promises.writeFile(fromPath, 'hello');

        const migrated = await migrateDbFileIfNeeded(fromPath, toPath);
        expect(migrated).toBe(true);
        expect(fs.existsSync(fromPath)).toBe(false);
        expect(fs.existsSync(toPath)).toBe(true);
    });

    test('readSettingsFromSqlite reads theme and preferences', async () => {
        tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'droidforge-test-'));
        const dbPath = path.join(tempDir, 'data.db');

        const theme = { primaryColor: '#1', secondaryColor: '#2', backgroundColor: '#3', textColor: '#4', borderColor: '#5' };
        const preferences = { themeMode: 'dark', language: 'English', autoSave: true, notifications: true };

        await new Promise<void>((resolve, reject) => {
            const db = new sqlite3.Database(dbPath);
            db.serialize(() => {
                db.run(`CREATE TABLE settings (id INTEGER PRIMARY KEY, theme TEXT, preferences TEXT)`);
                db.run(
                    `INSERT INTO settings (id, theme, preferences) VALUES (1, ?, ?)` ,
                    [JSON.stringify(theme), JSON.stringify(preferences)],
                    (err) => {
                        if (err) {
                            db.close();
                            reject(err);
                            return;
                        }
                        db.close();
                        resolve();
                    }
                );
            });
        });

        const settings = await readSettingsFromSqlite(dbPath);
        expect(settings).not.toBeNull();
        expect(settings?.theme.primaryColor).toBe('#1');
        expect(settings?.preferences.language).toBe('English');
    });
});
