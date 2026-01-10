export class AboutViewModel {
    getAppInfo() {
        return {
            name: "Droid Forge",
            version: "1.0.0",
            description: "A powerful development toolkit for building amazing applications with ease.",
            builtWith: "Built with OpenTUI - Terminal UI Framework",
            tagline: "Created for developers, by developers"
        };
    }

    getFeatures() {
        return [
            "Interactive project management",
            "Code generation tools",
            "Built-in utilities", 
            "Extensible plugin system"
        ];
    }
}