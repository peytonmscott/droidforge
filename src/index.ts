import { createCliRenderer, type KeyEvent } from "@opentui/core";
import path from 'path';

import { bootstrap } from './bootstrap';
import { setupDIModules, diContainer } from './di';
import { NavigationManager, clearCurrentView, getAndroidProjectName, normalizeProjectPath, projectIdFromPath } from './utilities';
import { ProjectDetection } from './utilities/projectDetection';
import {
    MainMenuView,
    DashboardView,
    ProjectsView,
    ToolsView,
    SettingsView,
    AboutView,
    ActionsView,
    GradleView,
    ActionOutputView,
    ComingSoonView
} from './ui/view';

const targetDir = process.argv[2];
if (targetDir) {
    const resolvedPath = path.resolve(targetDir);
    process.chdir(resolvedPath);
}

// Walk up to Android project root if needed
const projectDetection = new ProjectDetection();
const detectedRoot = projectDetection.findAndroidProjectRoot(process.cwd());
if (detectedRoot) {
    process.chdir(detectedRoot);
}

await bootstrap();

// Initialize DI
setupDIModules();

async function rememberCurrentAndroidProject(): Promise<void> {
    const detection = projectDetection.detectAndroidProject(process.cwd());
    if (!detection.isAndroidProject || !detection.projectRoot) return;

    const root = normalizeProjectPath(detection.projectRoot);
    const projectRepo = diContainer.get('ProjectRepository') as any;

    const projectId = projectIdFromPath(root);
    const now = new Date();

    const existing = await projectRepo.getProjectById(projectId);
    const createdAt = existing?.createdAt ?? now;

    await projectRepo.saveProject({
        id: projectId,
        name: getAndroidProjectName(root),
        path: root,
        status: 'active',
        description: existing?.description,
        createdAt,
        updatedAt: now,
    });
}

await rememberCurrentAndroidProject();

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
            navigation.goBack();
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
                if (action === 'noop') return;

                if (action.startsWith('open-project-')) {
                    const id = action.slice('open-project-'.length);
                    void (async () => {
                        try {
                            const projectRepo = diContainer.get('ProjectRepository') as any;
                            const project = await projectRepo.getProjectById(id);
                            if (!project?.path) return;

                            process.chdir(project.path);

                            // Touch updated time
                            await projectRepo.saveProject({
                                ...project,
                                updatedAt: new Date(),
                            });

                            navigation.navigateTo('menu');
                            renderCurrentView();
                        } catch (error) {
                            console.error('Failed to open project:', error);
                        }
                    })();
                    return;
                }

                if (action.startsWith('confirm-remove:')) {
                    void viewModel.confirmRemove();
                    return;
                }

                if (action === 'cancel-remove') {
                    viewModel.cancelRemove();
                    return;
                }
            }, (select) => {
                currentSelectElement = select;
            });
            renderer.root.add(view);
            currentViewElements.push(view);
            break;
        }
        case "gradle": {
            const viewModel = diContainer.get('GradleViewModel') as any;
            const view = GradleView(renderer, viewModel, (action) => {
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
        case "hammer-list": {
            const viewModel = diContainer.get('HammerListViewModel') as any;
            const view = GradleView(renderer, viewModel, (action) => {
                navigation.navigateTo(action);
                renderCurrentView();
            }, {
                headerTitle: 'Hammer List (Pinned Tasks)',
                panelTitle: 'Pinned Tasks',
            });
            renderer.root.add(view);
            currentViewElements.push(view);
            break;
        }
        case "blueprints": {
            const viewModel = diContainer.get('BlueprintsViewModel') as any;
            const view = GradleView(renderer, viewModel, (action) => {
                navigation.navigateTo(action);
                renderCurrentView();
            }, {
                headerTitle: 'Blueprints (All Tasks)',
                panelTitle: 'All Tasks',
            });
            renderer.root.add(view);
            currentViewElements.push(view);
            break;
        }
        case "devices": {
            const view = ComingSoonView(
                renderer,
                'Smithy (Devices)',
                'Manage emulators and connected devices',
            );
            renderer.root.add(view);
            currentViewElements.push(view);
            break;
        }
        case "adb": {
            const view = ComingSoonView(
                renderer,
                'Command Tongs (ADB)',
                'Quick ADB actions without the finger burns',
            );
            renderer.root.add(view);
            currentViewElements.push(view);
            break;
        }
        case "kiln-view": {
            const view = ComingSoonView(
                renderer,
                'Kiln View (App Logs)',
                'App-focused Logcat (package/PID filtered)',
            );
            renderer.root.add(view);
            currentViewElements.push(view);
            break;
        }
        case "foundry-logs": {
            const view = ComingSoonView(
                renderer,
                'Foundry Logs (Device Logs)',
                'Full device Logcat with filters',
            );
            renderer.root.add(view);
            currentViewElements.push(view);
            break;
        }
        case "looking-glass": {
            const view = ComingSoonView(
                renderer,
                'Looking Glass (Mirror)',
                'Mirror a physical device display',
            );
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
    const currentView = navigation.getCurrentView();

    if (key.name === 'escape') {
        if (currentView.startsWith('actionoutputview:')) {
            return;
        }

        if (currentView === 'projects') {
            const projectsViewModel = diContainer.get('ProjectsViewModel') as any;
            if (projectsViewModel.isConfirmingRemoval()) {
                projectsViewModel.cancelRemove();
                return;
            }
        }

        if (currentView !== 'menu') {
            navigation.navigateTo('menu');
            renderCurrentView();
        }
        return;
    }

    if (currentView === 'projects') {
        const projectsViewModel = diContainer.get('ProjectsViewModel') as any;
        const keyName = (key.name || '').toLowerCase();

        if (projectsViewModel.isConfirmingRemoval()) {
            if (keyName === 'y') {
                void projectsViewModel.confirmRemove();
            }
            if (keyName === 'n') {
                projectsViewModel.cancelRemove();
            }
            return;
        }

        if (keyName === 'r') {
            const select = currentSelectElement;
            const selectedOption = select?.getSelectedOption?.();
            const selectedValue = typeof selectedOption?.value === 'string' ? selectedOption.value : '';

            if (selectedValue.startsWith('open-project-')) {
                const id = selectedValue.slice('open-project-'.length);
                const selectedIndex = select?.getSelectedIndex?.() ?? 0;
                void projectsViewModel.requestRemoveProjectById(id, selectedIndex);
            }
        }
    }
});

// Initialize with main menu
renderCurrentView();
