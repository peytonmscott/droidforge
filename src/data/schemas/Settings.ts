export interface Theme {
    primaryColor: string;
    secondaryColor: string;
    backgroundColor: string;
    textColor: string;
    borderColor: string;
}

export interface Settings {
    theme: Theme;
    preferences: {
        themeMode: 'dark' | 'light';
        language: string;
        autoSave: boolean;
        notifications: boolean;
    };
}