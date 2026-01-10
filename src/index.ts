import { createCliRenderer, type KeyEvent } from "@opentui/core";
import { bootstrap } from './bootstrap';
import { setupDIModules, diContainer } from './di';
import { NavigationManager, clearCurrentView } from './utilities';
import {
    MainMenuView,
    DashboardView,
    ProjectsView,
    ToolsView,
    SettingsView,
    AboutView,
    ActionsView,
    ActionOutputView
} from './ui/view';

await bootstrap();

// Initialize DI
setupDIModules();

const targetDir = process.argv[2];
if (targetDir) {
    const path = require('path');
    const resolvedPath = path.resolve(targetDir);
    process.chdir(resolvedPath);
}

// Get dependencies
const renderer = await createCliRenderer({ exitOnCtrlC: true });
const navigation = new NavigationManager();
let currentViewElements: any[] = [];
let currentSelectElement: any = null;

// View rendering function
function renderCurrentView() {

    clearCurrentView(renderer, currentViewElements, currentSelectElement);
    currentSelectElement = null;

    const currentView = navigation.getCurrentView();

    if (currentView.startsWith("actionoutputview:")) {
        const prefix = 'actionoutputview:';
        const command = currentView.slice(prefix.length);

        const viewModel = diContainer.get('ActionsViewModel') as any;
        const view = ActionOutputView(renderer, viewModel, command, () => {
            navigation.navigateTo('actions');
            renderCurrentView();
        });
        renderer.root.add(view);
        currentViewElements.push(view);
        return;
    }
    switch (currentView) {
        case "menu": {
            const viewModel = diContainer.get('MainMenuViewModel') as any;
            const view = MainMenuView(renderer, viewModel, (view) => {
                navigation.navigateTo(view);
                renderCurrentView();
            });
            renderer.root.add(view);
            currentViewElements.push(view);
            break;
        }
        case "dashboard": {
            const viewModel = diContainer.get('DashboardViewModel') as any;
            const view = DashboardView(renderer, viewModel);
            renderer.root.add(view);
            currentViewElements.push(view);
            break;
        }
        case "projects": {
            const viewModel = diContainer.get('ProjectsViewModel') as any;
            const view = ProjectsView(renderer, viewModel, (action) => {
                // Handle project-specific actions here
                if (action.startsWith('open-project-')) {
                    // Handle opening a specific project
                    console.log(`Opening project: ${action}`);
                } else {
                    // Handle other actions like create, template, etc.
                    console.log(`Action: ${action}`);
                }
                // For now, just navigate back to menu on any selection
                navigation.navigateTo('menu');
                renderCurrentView();
            });
            renderer.root.add(view);
            currentViewElements.push(view);
            break;
        }
        case "tools": {
            const viewModel = diContainer.get('ToolsViewModel') as any;
            const view = ToolsView(renderer, viewModel);
            renderer.root.add(view);
            currentViewElements.push(view);
            break;
        }
        case "actions": {
            const viewModel = diContainer.get('ActionsViewModel') as any;
            const view = ActionsView(renderer, viewModel, (action) => {
                if (action === 'back') {
                    navigation.navigateTo('menu');
                } else {
                    navigation.navigateTo(action);
                }
                renderCurrentView();
            });
            renderer.root.add(view);
            currentViewElements.push(view);
            break;
        }
        case "settings": {
            const viewModel = diContainer.get('SettingsViewModel') as any;
            const view = SettingsView(renderer, viewModel);
            renderer.root.add(view);
            currentViewElements.push(view);
            break;
        }
        case "about": {
            const viewModel = diContainer.get('AboutViewModel') as any;
            const view = AboutView(renderer, viewModel);
            renderer.root.add(view);
            currentViewElements.push(view);
            break;
        }
    }
}

// Handle keyboard navigation
renderer.keyInput.on("keypress", (key: KeyEvent) => {
    if (key.name === "escape") {
        if (navigation.getCurrentView() !== "menu") {
            navigation.navigateTo("menu");
            renderCurrentView();
        }
    }
});

// Initialize with main menu
renderCurrentView();
