import { BoxRenderable } from '@opentui/core';
import type { NavigationManager } from '../utilities/navigation';
import type { CliRendererLike, SelectLike } from '../utilities/rendererTypes';
import type { UiTheme } from '../ui/theme';
import type {
    ProjectsViewModel,
    MainMenuViewModel,
    DashboardViewModel,
    ActionsViewModel,
    SettingsViewModel,
    AboutViewModel,
    DevicesViewModel,
    MirrorViewModel,
    LogcatViewModel,
    AdbActionsViewModel,
} from '../viewmodels';
import {
    MainMenuView,
    DashboardView,
    ProjectsView,
    SettingsView,
    AboutView,
    ActionsView,
    ActionOutputView,
    ComingSoonView,
    DevicesView,
    MirrorView,
    LogcatView,
    AdbActionsView,
} from '../ui/view';
import type { WorkspaceService } from '../workspace';
import { getAndroidApplicationId } from '../utilities';

export interface ViewRouterContext {
    renderer: CliRendererLike;
    contentHost: BoxRenderable;
    navigation: NavigationManager;
    theme: UiTheme;
    ansiPalette: Record<string, import('@opentui/core').RGBA>;
    themeManager: { getTheme: () => UiTheme };
    diContainer: { get<T>(key: string): T };
    setStatusText: (text: string) => void;
    setSelectElement: (el: SelectLike | null) => void;
    onNavigateThenRender: (view: string) => void;
    onGoBackThenRender: () => void;
}

const VIEW_LABELS: Record<string, string> = {
    menu: 'Main',
    projects: 'Projects',
    settings: 'Themes',
    about: 'About',
    devices: 'Devices',
    adb: 'ADB Actions',
    'app-logs': 'App Logs',
    'device-logs': 'Device Logs',
    'screen-mirror': 'Screen Mirror',
};

export function getStatusTextForView(
    view: string,
    diContainer: { get<T>(key: string): T }
): string {
    if (view.startsWith('actionoutputview:')) {
        return 'j/k: scroll • c: copy • ESC: cancel/back';
    }

    const label = VIEW_LABELS[view];
    const sep = ' · ';

    switch (view) {
        case 'menu':
            return (label ? label + sep : '') + '↑↓: navigate • ENTER: select • CTRL+C: quit';
        case 'projects': {
            const vm = diContainer.get<ProjectsViewModel>('ProjectsViewModel');
            const hint = vm.getFooterText?.() ?? 'ESC: back';
            return (label ? label + sep : '') + hint;
        }
        case 'settings':
            return (label ? label + sep : '') + 'ESC: back • M: mode • D/L: set dark/light • R: reload';
        case 'about':
            return (label ? label + sep : '') + 'ESC: back • T: themes';
        case 'dashboard':
            return (label ? label + sep : '') + 'ESC: back • TAB: navigate • ENTER: select';
        case 'actions':
            return (label ? label + sep : '') + '↑↓: navigate • ENTER: select • ESC: back';
        default:
            return (label ? label + sep : '') + 'ESC: back';
    }
}

export interface ViewRouterResult {
    view: BoxRenderable;
    statusText: string;
}

export function renderView(currentView: string, ctx: ViewRouterContext): ViewRouterResult {
    const statusText = getStatusTextForView(currentView, ctx.diContainer);

    if (currentView.startsWith('actionoutputview:')) {
        const command = currentView.slice('actionoutputview:'.length);
        const viewModel = ctx.diContainer.get<ActionsViewModel>('ActionsViewModel');
        const view = ActionOutputView(
            ctx.renderer,
            viewModel,
            command,
            ctx.theme,
            ctx.ansiPalette,
            ctx.setStatusText,
            () => {
                ctx.onGoBackThenRender();
            }
        );
        return { view, statusText };
    }

    switch (currentView) {
        case 'menu': {
            const viewModel = ctx.diContainer.get<MainMenuViewModel>('MainMenuViewModel');
            const ws = ctx.diContainer.get<WorkspaceService>('WorkspaceService');
            const view = MainMenuView(
                ctx.renderer,
                viewModel,
                ctx.theme,
                ctx.onNavigateThenRender,
                ws
            );
            return { view, statusText };
        }
        case 'dashboard': {
            const viewModel = ctx.diContainer.get<DashboardViewModel>('DashboardViewModel');
            const view = DashboardView(ctx.renderer, viewModel, ctx.theme);
            return { view, statusText };
        }
        case 'projects': {
            const viewModel = ctx.diContainer.get<ProjectsViewModel>('ProjectsViewModel');
            const view = ProjectsView(
                ctx.renderer,
                viewModel,
                ctx.theme,
                (action: string) => {
                    if (action === 'noop') return;
                    if (action.startsWith('open-project-')) {
                        const id = action.slice('open-project-'.length);
                        void (async () => {
                            try {
                                const projectRepo = ctx.diContainer.get<import('../data/repositories').ProjectRepository>('ProjectRepository');
                                const project = await projectRepo.getProjectById(id);
                                if (!project?.path) return;
                                process.chdir(project.path);
                                const workspace = ctx.diContainer.get<WorkspaceService>('WorkspaceService');
                                workspace.updateCwd(process.cwd());
                                await projectRepo.saveProject({
                                    ...project,
                                    updatedAt: new Date(),
                                });
                                ctx.onNavigateThenRender('menu');
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
                },
                (select) => {
                    ctx.setSelectElement(select);
                },
                ctx.setStatusText
            );
            return { view, statusText };
        }
        case 'actions': {
            const viewModel = ctx.diContainer.get<ActionsViewModel>('ActionsViewModel');
            const view = ActionsView(ctx.renderer, viewModel, ctx.theme, (action: string) => {
                if (action === 'back') {
                    ctx.onNavigateThenRender('menu');
                } else {
                    ctx.onNavigateThenRender(action);
                }
            });
            return { view, statusText };
        }
        case 'settings': {
            const viewModel = ctx.diContainer.get<SettingsViewModel>('SettingsViewModel');
            const view = SettingsView(ctx.renderer, viewModel, ctx.theme, ctx.onGoBackThenRender);
            return { view, statusText };
        }
        case 'about': {
            const viewModel = ctx.diContainer.get<AboutViewModel>('AboutViewModel');
            const view = AboutView(ctx.renderer, viewModel, ctx.theme);
            return { view, statusText };
        }
        case 'devices': {
            const viewModel = ctx.diContainer.get<DevicesViewModel>('DevicesViewModel');
            const view = DevicesView(
                ctx.renderer,
                viewModel,
                ctx.theme,
                (action: string, data?: string) => {
                    ctx.onNavigateThenRender('menu');
                },
                (select) => {
                    ctx.setSelectElement(select);
                }
            );
            return { view, statusText };
        }
        case 'adb': {
            const viewModel = ctx.diContainer.get<AdbActionsViewModel>('AdbActionsViewModel');
            const view = AdbActionsView(ctx.renderer, viewModel, ctx.theme);
            return { view, statusText };
        }
        case 'app-logs': {
            const viewModel = ctx.diContainer.get<LogcatViewModel>('LogcatViewModel');
            const ws = ctx.diContainer.get<WorkspaceService>('WorkspaceService');
            // Filter by the real applicationId; without one, fall back to full device logs.
            const applicationId = getAndroidApplicationId(ws.getCwd());
            const view = LogcatView(
                ctx.renderer,
                viewModel,
                applicationId ? { packageName: applicationId } : {},
                ctx.theme,
                ctx.setStatusText,
                () => ctx.onGoBackThenRender()
            );
            return { view, statusText: 'j/k: scroll • p: pause • c: clear • ESC: back' };
        }
        case 'device-logs': {
            const viewModel = ctx.diContainer.get<LogcatViewModel>('LogcatViewModel');
            const view = LogcatView(
                ctx.renderer,
                viewModel,
                {},
                ctx.theme,
                ctx.setStatusText,
                () => ctx.onGoBackThenRender()
            );
            return { view, statusText: 'j/k: scroll • p: pause • c: clear • ESC: back' };
        }
        case 'screen-mirror': {
            const viewModel = ctx.diContainer.get<MirrorViewModel>('MirrorViewModel');
            const view = MirrorView(ctx.renderer, viewModel, ctx.theme);
            return { view, statusText };
        }
        default: {
            const view = ComingSoonView(ctx.renderer, ctx.theme, 'Coming soon', `No UI exists yet for: ${currentView}`);
            return { view, statusText };
        }
    }
}
