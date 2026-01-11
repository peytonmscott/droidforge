import { createCliRenderer, Text, BoxRenderable, TextAttributes, type KeyEvent } from "@opentui/core";
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
    ActionOutputView,
    ComingSoonView,
    GradleView,
} from './ui/view';

const targetDir = process.argv[2];
if (targetDir) {
    const resolvedPath = path.resolve(targetDir);
    try {
        process.chdir(resolvedPath);
    } catch {
        // Invalid path - continue with current directory
    }
}

// Walk up to Android project root if needed
const projectDetection = new ProjectDetection();
const detectedRoot = projectDetection.findAndroidProjectRoot(process.cwd());
if (detectedRoot) {
    process.chdir(detectedRoot);
}

await bootstrap();

// Initialize DI
await setupDIModules();

const themeManager = diContainer.get('ThemeManager') as any;
await themeManager.reloadThemes();

themeManager.onThemeChange?.(() => {
    renderCurrentView();
});

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

// App shell: content area + persistent statusline.
const appShell = new BoxRenderable(renderer, {
    id: 'app-shell',
    flexDirection: 'column',
    flexGrow: 1,
    width: '100%',
    height: '100%',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
});

const contentHost = new BoxRenderable(renderer, {
    id: 'content-host',
    flexDirection: 'column',
    flexGrow: 1,
    width: '100%',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
});

const statusLine = new BoxRenderable(renderer, {
    id: 'status-line',
    height: 1,
    width: '100%',
    alignSelf: 'stretch',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingLeft: 1,
});

function setStatusLineText(content: string, theme: any): void {
    const background =
        theme?.panelBackgroundColor ??
        theme?.footerBackgroundColor ??
        theme?.backgroundColor ??
        '#111827';

    const textColor = theme?.textColor ?? theme?.footerTextColor ?? '#E5E7EB';

    statusLine.backgroundColor = background === 'transparent' ? '#111827' : background;

    const resolvedFg = textColor === 'transparent'
        ? '#E5E7EB'
        : textColor === statusLine.backgroundColor
            ? (theme?.accentColor ?? theme?.primaryColor ?? '#FFFFFF')
            : textColor;

    statusLine.remove('status-line-text');
    statusLine.add(Text({
        id: 'status-line-text',
        content,
        fg: resolvedFg,
        attributes: TextAttributes.BOLD,
        wrapMode: 'char',
    }));
}

appShell.add(contentHost);
appShell.add(statusLine);
renderer.root.add(appShell);

function statusTextForView(view: string): string {
    if (view.startsWith('actionoutputview:')) {
        return 'j/k: scroll • c: copy • ESC: cancel/back';
    }

    switch (view) {
        case 'menu':
            return '↑↓: navigate • ENTER: select • CTRL+C: quit';
        case 'projects': {
            const vm = diContainer.get('ProjectsViewModel') as any;
            return vm.getFooterText?.() ?? 'ESC: back';
        }
        case 'settings':
            return 'ESC: back • M: mode • D/L: set dark/light • R: reload';
        case 'about':
            return 'ESC: back • T: themes';
        case 'dashboard':
            return 'ESC: back • TAB: navigate • ENTER: select';
        case 'tools':
            return 'ESC: back';
        case 'actions':
        case 'hammer-list':
        case 'blueprints':
            return '↑↓: navigate • ENTER: select • ESC: back';
        default:
            return 'ESC: back';
    }
}

// View rendering function
function renderCurrentView() {

    clearCurrentView(renderer, currentViewElements, currentSelectElement);
    currentSelectElement = null;

    const currentView = navigation.getCurrentView();
    const theme = themeManager.getTheme();
    const ansiPalette = themeManager.getAnsiPaletteMap();

    setStatusLineText(statusTextForView(currentView), theme);

    if (currentView.startsWith("actionoutputview:")) {
        const prefix = 'actionoutputview:';
        const command = currentView.slice(prefix.length);

        const viewModel = diContainer.get('ActionsViewModel') as any;
        const view = ActionOutputView(renderer, viewModel, command, theme, ansiPalette, (text: string) => {
            setStatusLineText(text, themeManager.getTheme());
        }, () => {
            navigation.goBack();
            renderCurrentView();
        });
        contentHost.add(view);
        currentViewElements.push(view);
        return;
    }
    switch (currentView) {
        case "menu": {
            const viewModel = diContainer.get('MainMenuViewModel') as any;
            const view = MainMenuView(renderer, viewModel, theme, (nextView: string) => {
                navigation.navigateTo(nextView);
                renderCurrentView();
            });
            contentHost.add(view);
            currentViewElements.push(view);
            break;
        }
        case "dashboard": {
            const viewModel = diContainer.get('DashboardViewModel') as any;
            const view = DashboardView(renderer, viewModel, theme);
            contentHost.add(view);
            currentViewElements.push(view);
            break;
        }
        case "projects": {
            const viewModel = diContainer.get('ProjectsViewModel') as any;
            const view = ProjectsView(renderer, viewModel, theme, (action: string) => {
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
            }, (text: string) => {
                setStatusLineText(text, themeManager.getTheme());
            });
            contentHost.add(view);
            currentViewElements.push(view);
            break;
        }
        case "tools": {
            const viewModel = diContainer.get('ToolsViewModel') as any;
            const view = ToolsView(renderer, viewModel, theme);
            contentHost.add(view);
            currentViewElements.push(view);
            break;
        }
        case "actions": {
            const viewModel = diContainer.get('ActionsViewModel') as any;
            const view = ActionsView(renderer, viewModel, theme, (action: string) => {
                if (action === 'back') {
                    navigation.navigateTo('menu');
                } else {
                    navigation.navigateTo(action);
                }
                renderCurrentView();
            });
            contentHost.add(view);
            currentViewElements.push(view);
            break;
        }
        case "settings": {
            const viewModel = diContainer.get('SettingsViewModel') as any;
            const view = SettingsView(renderer, viewModel, theme, () => {
                navigation.goBack();
                renderCurrentView();
            });
            contentHost.add(view);
            currentViewElements.push(view);
            break;
        }
        case "about": {
            const viewModel = diContainer.get('AboutViewModel') as any;
            const view = AboutView(renderer, viewModel, theme);
            contentHost.add(view);
            currentViewElements.push(view);
            break;
        }
        case "hammer-list": {
            const viewModel = diContainer.get('HammerListViewModel') as any;
            const view = GradleView(
                renderer,
                viewModel,
                theme,
                (action: string) => {
                    navigation.navigateTo(action);
                    renderCurrentView();
                },
                { headerTitle: 'Hammer List', panelTitle: 'Pinned Gradle Tasks' },
            );
            contentHost.add(view);
            currentViewElements.push(view);
            break;
        }
        case "blueprints": {
            const viewModel = diContainer.get('BlueprintsViewModel') as any;
            const view = GradleView(
                renderer,
                viewModel,
                theme,
                (action: string) => {
                    navigation.navigateTo(action);
                    renderCurrentView();
                },
                { headerTitle: 'Blueprints', panelTitle: 'All Gradle Tasks' },
            );
            contentHost.add(view);
            currentViewElements.push(view);
            break;
        }
        case "devices": {
            const view = ComingSoonView(renderer, theme, 'Smithy', 'Device and emulator management is coming soon.');
            contentHost.add(view);
            currentViewElements.push(view);
            break;
        }
        case "adb": {
            const view = ComingSoonView(renderer, theme, 'Command Tongs', 'ADB shortcuts are coming soon.');
            contentHost.add(view);
            currentViewElements.push(view);
            break;
        }
        case "kiln-view": {
            const view = ComingSoonView(renderer, theme, 'Kiln View', 'App-focused Logcat is coming soon.');
            contentHost.add(view);
            currentViewElements.push(view);
            break;
        }
        case "foundry-logs": {
            const view = ComingSoonView(renderer, theme, 'Foundry Logs', 'Full device Logcat browsing is coming soon.');
            contentHost.add(view);
            currentViewElements.push(view);
            break;
        }
        case "looking-glass": {
            const view = ComingSoonView(renderer, theme, 'Looking Glass', 'Device mirroring is coming soon.');
            contentHost.add(view);
            currentViewElements.push(view);
            break;
        }
        default: {
            const view = ComingSoonView(renderer, theme, 'Coming soon', `No UI exists yet for: ${currentView}`);
            contentHost.add(view);
            currentViewElements.push(view);
            break;
        }
    }
}

// Handle keyboard navigation
renderer.keyInput.on("keypress", (key: KeyEvent) => {
    const currentView = navigation.getCurrentView();
    const keyName = (key.name || '').toLowerCase();

    // ActionOutputView owns key handling (ESC/j/k/c).
    if (currentView.startsWith('actionoutputview:')) {
        return;
    }

    if (currentView === 'about' && keyName === 't') {
        navigation.navigateTo('settings');
        renderCurrentView();
        return;
    }

    if (currentView === 'settings') {
        const settingsViewModel = diContainer.get('SettingsViewModel') as any;

        if (keyName === 'r') {
            void settingsViewModel.reloadThemes().then(renderCurrentView);
            return;
        }

        if (keyName === 'm') {
            const current = themeManager.getThemeModePreference();
            const next = current === 'dark' ? 'light' : current === 'light' ? 'system' : 'dark';
            void settingsViewModel.setThemeModePreference(next).then(renderCurrentView);
            return;
        }

        if (keyName === 'd') {
            void settingsViewModel.selectThemeForMode(themeManager.getThemeId(), 'dark').then(renderCurrentView);
            return;
        }

        if (keyName === 'l') {
            void settingsViewModel.selectThemeForMode(themeManager.getThemeId(), 'light').then(renderCurrentView);
            return;
        }
    }

    if (key.name === 'escape') {
        if (currentView === 'projects') {
            const projectsViewModel = diContainer.get('ProjectsViewModel') as any;
            if (projectsViewModel.isConfirmingRemoval()) {
                projectsViewModel.cancelRemove();
                return;
            }
        }

        if (currentView !== 'menu') {
            navigation.goBack();
            renderCurrentView();
        }
        return;
    }

    if (currentView === 'projects') {
        const projectsViewModel = diContainer.get('ProjectsViewModel') as any;

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
