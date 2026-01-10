import { ThemeManager } from '../ui/theme';

export class SettingsViewModel {
    constructor(private themeManager: ThemeManager) {}

    getPreferences() {
        return {
            theme: "Dark Mode",
            language: "English", 
            autoSave: "Enabled",
            notifications: "On"
        };
    }

    getAdvancedOptions() {
        return {
            cache: "Clear cache",
            data: "Export settings",
            debug: "Enable logging",
            reset: "Factory defaults"
        };
    }

    getCurrentTheme() {
        return this.themeManager.getCurrentTheme();
    }

    async switchToDarkTheme() {
        await this.themeManager.updateTheme(this.themeManager.getDarkTheme());
    }

    async switchToLightTheme() {
        await this.themeManager.updateTheme(this.themeManager.getLightTheme());
    }
}