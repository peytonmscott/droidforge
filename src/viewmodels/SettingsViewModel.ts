import type { ThemeInfo } from '../ui/theme';
import type { ThemeModePreference } from '../ui/theme';
import { ThemeManager } from '../ui/theme';

export class SettingsViewModel {
    constructor(private themeManager: ThemeManager) {}

    listThemes(): ThemeInfo[] {
        return this.themeManager.listThemes();
    }

    getSelectedThemeId(): string {
        return this.themeManager.getThemeId();
    }

    getThemeModePreference(): ThemeModePreference {
        return this.themeManager.getThemeModePreference();
    }

    getEffectiveThemeMode(): 'dark' | 'light' {
        return this.themeManager.getEffectiveThemeMode();
    }

    async selectTheme(themeId: string): Promise<void> {
        await this.themeManager.setTheme(themeId);
    }

    async selectThemeForMode(themeId: string, mode: 'dark' | 'light'): Promise<void> {
        await this.themeManager.setThemeForMode(themeId, mode);
    }

    async setThemeModePreference(mode: ThemeModePreference): Promise<void> {
        await this.themeManager.setThemeModePreference(mode);
    }

    async reloadThemes(): Promise<void> {
        await this.themeManager.reloadThemes();
    }
}
