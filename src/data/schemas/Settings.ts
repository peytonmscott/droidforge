export interface Theme {
    primaryColor: string;
    secondaryColor: string;
    backgroundColor: string;
    textColor: string;
    borderColor: string;
}

export interface Settings {
    preferences: {
        themeMode: 'dark' | 'light' | 'system';
        themeId: string;
        themeIdDark: string;
        themeIdLight: string;
        language: string;
        autoSave: boolean;
        notifications: boolean;
    };
}
