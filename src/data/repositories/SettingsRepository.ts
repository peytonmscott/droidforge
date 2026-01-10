import { Database } from './Database';
import type { Settings } from '../schemas';

export class SettingsRepository {
    constructor(private db: Database) {}

    async getSettings(): Promise<Settings> {
        return new Promise((resolve, reject) => {
            this.db.getDb().get('SELECT * FROM settings WHERE id = 1', (err, row: any) => {
                if (err) reject(err);
                else if (row) {
                    resolve({
                        theme: JSON.parse(row.theme),
                        preferences: JSON.parse(row.preferences)
                    });
                } else {
                    // Return default settings
                    resolve({
                        theme: {
                            primaryColor: "#3b82f6",
                            secondaryColor: "#1e40af",
                            backgroundColor: "transparent",
                            textColor: "#E2E8F0",
                            borderColor: "#475569"
                        },
                        preferences: {
                            themeMode: 'dark',
                            language: 'English',
                            autoSave: true,
                            notifications: true
                        }
                    });
                }
            });
        });
    }

    async saveSettings(settings: Settings): Promise<void> {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT OR REPLACE INTO settings (id, theme, preferences)
                VALUES (1, ?, ?)
            `;
            const params = [
                JSON.stringify(settings.theme),
                JSON.stringify(settings.preferences)
            ];

            this.db.getDb().run(sql, params, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
}