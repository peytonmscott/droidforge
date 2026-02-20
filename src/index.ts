import { createCliRenderer, Text, BoxRenderable, TextAttributes, type KeyEvent } from "@opentui/core";
import path from 'path';

import { bootstrap } from './bootstrap';
import { setupDIModules, diContainer } from './di';
import { WorkspaceService } from './workspace';
import {
    NavigationManager,
    clearCurrentView,
    getAndroidProjectName,
    normalizeProjectPath,
    projectIdFromPath,
    type CliRendererLike,
    type DisposableRenderable,
    type SelectLike,
} from './utilities';
import { ProjectDetection } from './utilities/projectDetection';
import type { UiTheme } from './ui/theme';
import type { ProjectsViewModel, SettingsViewModel } from './viewmodels';
import { renderView } from './app/ViewRouter';

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
    try {
        process.chdir(detectedRoot);
    } catch {
        // Inaccessible project root - continue with current directory
    }
}

const workspace = new WorkspaceService(process.cwd());

await bootstrap();

// Initialize DI (workspace is the single source of truth for project root)
await setupDIModules(workspace);

const themeManager = diContainer.get<import('./ui/theme').ThemeManager>('ThemeManager');
await themeManager.reloadThemes();

themeManager.onThemeChange?.(() => {
    renderCurrentView();
});

async function rememberCurrentAndroidProject(): Promise<void> {
    const ws = diContainer.get<WorkspaceService>('WorkspaceService');
    const detection = ws.getDetection();
    if (!detection.isAndroidProject || !detection.projectRoot) return;

    const root = normalizeProjectPath(detection.projectRoot);
    const projectRepo = diContainer.get<import('./data/repositories').ProjectRepository>('ProjectRepository');

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
const renderer = (await createCliRenderer({ exitOnCtrlC: true })) as CliRendererLike;
const navigation = new NavigationManager();
let currentViewElements: DisposableRenderable[] = [];
let currentSelectElement: SelectLike | null = null;

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
    paddingTop: 1,
    paddingBottom: 1,
});

const statusLine = new BoxRenderable(renderer, {
    id: 'status-line',
    height: 2,
    minHeight: 2,
    width: '100%',
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: 2,
    paddingRight: 2,
    border: true,
    borderStyle: 'single',
});

function setStatusLineText(content: string, theme: UiTheme): void {
    const background =
        theme?.footerBackgroundColor ??
        theme?.panelBackgroundColor ??
        theme?.backgroundColor ??
        '#111827';

    const borderColor = theme?.footerBorderColor ?? theme?.borderColor ?? theme?.primaryColor ?? '#475569';
    const textColor = theme?.footerTextColor ?? theme?.textColor ?? '#E5E7EB';

    statusLine.backgroundColor = background === 'transparent' ? '#111827' : background;
    statusLine.borderColor = borderColor;

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
        wrapMode: 'word',
    }));
}

appShell.add(contentHost);
appShell.add(statusLine);
renderer.root.add(appShell);

function renderCurrentView(): void {
    clearCurrentView(renderer, currentViewElements, currentSelectElement);
    currentSelectElement = null;

    const currentView = navigation.getCurrentView();
    const theme = themeManager.getTheme();
    const ansiPalette = themeManager.getAnsiPaletteMap();

    const ctx: import('./app/ViewRouter').ViewRouterContext = {
        renderer,
        contentHost,
        navigation,
        theme,
        ansiPalette,
        themeManager,
        diContainer,
        setStatusText: (text: string) => setStatusLineText(text, themeManager.getTheme()),
        setSelectElement: (el) => {
            currentSelectElement = el;
        },
        onNavigateThenRender: (view: string) => {
            navigation.navigateTo(view);
            renderCurrentView();
        },
        onGoBackThenRender: () => {
            navigation.goBack();
            renderCurrentView();
        },
    };

    const result = renderView(currentView, ctx);
    setStatusLineText(result.statusText, theme);
    contentHost.add(result.view);
    currentViewElements.push(result.view);
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
        const settingsViewModel = diContainer.get<SettingsViewModel>('SettingsViewModel');

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

    // Global home shortcut
    if (keyName === 'q' && currentView !== 'menu') {
        navigation.clear();
        navigation.navigateTo('menu');
        renderCurrentView();
        return;
    }

    if (key.name === 'escape') {
        if (currentView === 'projects') {
            const projectsViewModel = diContainer.get<ProjectsViewModel>('ProjectsViewModel');
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
        const projectsViewModel = diContainer.get<ProjectsViewModel>('ProjectsViewModel');

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
