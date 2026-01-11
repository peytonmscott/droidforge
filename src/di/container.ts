// Simple DI container inspired by Koin
type Factory<T> = () => T;
type Singleton<T> = { instance: T | null, factory: Factory<T> };

class DIContainer {
    private singletons = new Map<string, Singleton<any>>();
    private factories = new Map<string, Factory<any>>();

    // Register a singleton
    single<T>(key: string, factory: Factory<T>): void {
        this.singletons.set(key, { instance: null, factory });
    }

    // Register a factory (new instance each time)
    factory<T>(key: string, factory: Factory<T>): void {
        this.factories.set(key, factory);
    }

    // Get an instance
    get<T>(key: string): T {
        // Check singletons first
        const singleton = this.singletons.get(key);
        if (singleton) {
            if (!singleton.instance) {
                singleton.instance = singleton.factory();
            }
            return singleton.instance;
        }

        // Check factories
        const factory = this.factories.get(key);
        if (factory) {
            return factory();
        }

        throw new Error(`No registration found for key: ${key}`);
    }
}

// Global container instance
export const diContainer = new DIContainer();

// Module definitions (like Koin modules)
export async function setupDIModules() {
    // Dynamic imports avoid circular deps and support Bun ESM modules.
    const { Database, ProjectRepository } = await import('../data/repositories');
    const { ThemeManager } = await import('../ui/theme');
    const {
        MainMenuViewModel,
        DashboardViewModel,
        ProjectsViewModel,
        ToolsViewModel,
        SettingsViewModel,
        AboutViewModel,
        ActionsViewModel,
        GradleViewModel,
    } = await import('../viewmodels');

    // Database singleton
    diContainer.single('Database', () => new Database());

    // Repositories singletons
    diContainer.single('ProjectRepository', () => new ProjectRepository(diContainer.get('Database')));

    // Theme singleton
    diContainer.single('ThemeManager', () => new ThemeManager());

    // ViewModels
    diContainer.factory('MainMenuViewModel', () => new MainMenuViewModel());
    diContainer.factory('DashboardViewModel', () => new DashboardViewModel());

    // ProjectsViewModel needs to hold state (selection/confirm flows)
    diContainer.single('ProjectsViewModel', () => new ProjectsViewModel(diContainer.get('ProjectRepository')));

    diContainer.factory('ToolsViewModel', () => new ToolsViewModel());
    diContainer.factory('SettingsViewModel', () => new SettingsViewModel(diContainer.get('ThemeManager')));
    diContainer.factory('AboutViewModel', () => new AboutViewModel());
    diContainer.factory('ActionsViewModel', () => new ActionsViewModel());
    diContainer.factory('GradleViewModel', () => new GradleViewModel());

    // Project-scoped Gradle menus (no toggle)
    diContainer.factory('HammerListViewModel', () => new GradleViewModel({ mode: 'curated', showToggle: false }));
    diContainer.factory('BlueprintsViewModel', () => new GradleViewModel({ mode: 'all', showToggle: false }));
}
