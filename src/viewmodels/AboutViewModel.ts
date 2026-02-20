export class AboutViewModel {
    private version: string;

    constructor() {
        try {
            const pkg = require('../../package.json');
            this.version = pkg.version || 'dev';
        } catch {
            this.version = 'dev';
        }
    }

    getAppInfo() {
        return {
            name: "Droidforge",
            version: this.version,
            description: "A terminal UI companion for Android development",
            builtWith: "Built with OpenTUI",
            tagline: "Neovim companion for Android development"
        };
    }

    getFeatures() {
        return [
            "Project management and switching",
            "Gradle task runner with live output",
            "Device and emulator management",
            "Logcat streaming",
            "30+ color themes"
        ];
    }
}
