import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';

import { ensureConfigDirExists, ensureConfigFileExists, saveConfig, getDefaultConfig } from './config/config';
import { getConfigDir, getDbPath, getLegacyDbPath } from './utilities/paths';
import type { DroidforgeConfig } from './config/config';

export async function migrateDbFileIfNeeded(fromPath: string, toPath: string): Promise<boolean> {
    try {
        await fs.promises.access(fromPath, fs.constants.F_OK);
    } catch {
        return false;
    }

    try {
        await fs.promises.access(toPath, fs.constants.F_OK);
        return false;
    } catch {
        // continue
    }

    await fs.promises.mkdir(path.dirname(toPath), { recursive: true });

    try {
        await fs.promises.rename(fromPath, toPath);
    } catch {
        await fs.promises.copyFile(fromPath, toPath);
        await fs.promises.unlink(fromPath).catch(() => undefined);
    }

    return true;
}

export async function readSettingsFromSqlite(dbPath: string): Promise<Pick<DroidforgeConfig, 'theme' | 'preferences'> | null> {
    return new Promise((resolve) => {
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                resolve(null);
            }
        });

        db.get('SELECT * FROM settings WHERE id = 1', (err, row: any) => {
            if (err || !row) {
                db.close();
                resolve(null);
                return;
            }

            try {
                const theme = JSON.parse(row.theme);
                const preferences = JSON.parse(row.preferences);
                db.close();
                resolve({ theme, preferences });
            } catch {
                db.close();
                resolve(null);
            }
        });
    });
}

export async function bootstrap(): Promise<void> {
    await ensureConfigDirExists();

    // If there is no JSON config yet, try to import settings from legacy SQLite.
    const configPath = path.join(getConfigDir(), 'droidforge.json');
    const hasConfig = await fs.promises
        .access(configPath, fs.constants.F_OK)
        .then(() => true)
        .catch(() => false);

    if (!hasConfig) {
        const legacyDbPath = getLegacyDbPath();
        const legacySettings = await readSettingsFromSqlite(legacyDbPath);

        if (legacySettings) {
            await saveConfig({
                version: 1,
                theme: legacySettings.theme,
                preferences: legacySettings.preferences,
            });
        } else {
            await saveConfig(getDefaultConfig());
        }
    } else {
        await ensureConfigFileExists();
    }

    // Migrate DB location from legacy path if needed.
    await migrateDbFileIfNeeded(getLegacyDbPath(), getDbPath());
}
