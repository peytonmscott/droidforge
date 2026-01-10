import type { Theme as ThemeType, Settings } from '../../data/schemas';

import { ensureConfigFileExists, updateConfig } from '../../config/config';

export class ThemeManager {
    private currentTheme: ThemeType;

    constructor() {
        this.currentTheme = this.getDefaultTheme();
        void this.loadTheme();
    }

    private getDefaultTheme(): ThemeType {
        return {
            primaryColor: "#3b82f6",
            secondaryColor: "#1e40af",
            backgroundColor: "transparent",
            textColor: "#E2E8F0",
            borderColor: "#475569"
        };
    }

    private async loadTheme(): Promise<void> {
        try {
            const config = await ensureConfigFileExists();
            this.currentTheme = config.theme;
        } catch {
            console.warn('Failed to load theme, using defaults');
        }
    }

    getCurrentTheme(): ThemeType {
        return { ...this.currentTheme };
    }

    async updateTheme(newTheme: Partial<ThemeType>): Promise<void> {
        this.currentTheme = { ...this.currentTheme, ...newTheme };

        try {
            await updateConfig({ theme: this.currentTheme });
        } catch {
            console.warn('Failed to save theme');
        }
    }

    // Predefined themes
    getDarkTheme(): ThemeType {
        return {
            primaryColor: "#3b82f6",
            secondaryColor: "#1e40af",
            backgroundColor: "transparent",
            textColor: "#E2E8F0",
            borderColor: "#475569"
        };
    }

    getLightTheme(): ThemeType {
        return {
            primaryColor: "#2563eb",
            secondaryColor: "#1d4ed8",
            backgroundColor: "#ffffff",
            textColor: "#1f2937",
            borderColor: "#d1d5db"
        };
    }
}