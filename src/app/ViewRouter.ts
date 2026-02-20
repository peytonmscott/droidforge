import { BoxRenderable } from '@opentui/core';
import type { NavigationManager } from '../utilities/navigation';
import type { CliRendererLike, SelectLike } from '../utilities/rendererTypes';
import type { UiTheme } from '../ui/theme';
import type {
    ProjectsViewModel,
    MainMenuViewModel,
    DashboardViewModel,
    ToolsViewModel,
    ActionsViewModel,
    SettingsViewModel,
    AboutViewModel,
    GradleViewModel,
} from '../viewmodels';
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
} from '../ui/view';
import type { WorkspaceService } from '../workspace';

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

export function getStatusTextForView(
    view: string,
    diContainer: { get<T>(key: string): T }
): string {
    if (view.startsWith('actionoutputview:')) {
        return 'j/k: scroll • c: copy • ESC: cancel/back';
    }

    switch (view) {
        case 'menu':
            return '↑↓: navigate • ENTER: select • CTRL+C: quit';
        case 'projects': {
            const vm = diContainer.get<ProjectsViewModel>('ProjectsViewModel');
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
        case 'tools': {
            const viewModel = ctx.diContainer.get<ToolsViewModel>('ToolsViewModel');
            const view = ToolsView(ctx.renderer, viewModel, ctx.theme);
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
        case 'hammer-list': {
            const viewModel = ctx.diContainer.get<GradleViewModel>('HammerListViewModel');
            const view = GradleView(
                ctx.renderer,
                viewModel,
                ctx.theme,
                (action: string) => {
                    ctx.onNavigateThenRender(action);
                },
                { headerTitle: 'Hammer List', panelTitle: 'Pinned Gradle Tasks' }
            );
            return { view, statusText };
        }
        case 'blueprints': {
            const viewModel = ctx.diContainer.get<GradleViewModel>('BlueprintsViewModel');
            const view = GradleView(
                ctx.renderer,
                viewModel,
                ctx.theme,
                (action: string) => {
                    ctx.onNavigateThenRender(action);
                },
                { headerTitle: 'Blueprints', panelTitle: 'All Gradle Tasks' }
            );
            return { view, statusText };
        }
        case 'devices': {
            const view = ComingSoonView(ctx.renderer, ctx.theme, 'Smithy', 'Device and emulator management is coming soon.');
            return { view, statusText };
        }
        case 'adb': {
            const view = ComingSoonView(ctx.renderer, ctx.theme, 'Command Tongs', 'ADB shortcuts are coming soon.');
            return { view, statusText };
        }
        case 'kiln-view': {
            const view = ComingSoonView(ctx.renderer, ctx.theme, 'Kiln View', 'App-focused Logcat is coming soon.');
            return { view, statusText };
        }
        case 'foundry-logs': {
            const view = ComingSoonView(ctx.renderer, ctx.theme, 'Foundry Logs', 'Full device Logcat browsing is coming soon.');
            return { view, statusText };
        }
        case 'looking-glass': {
            const view = ComingSoonView(ctx.renderer, ctx.theme, 'Looking Glass', 'Device mirroring is coming soon.');
            return { view, statusText };
        }
        default: {
            const view = ComingSoonView(ctx.renderer, ctx.theme, 'Coming soon', `No UI exists yet for: ${currentView}`);
            return { view, statusText };
        }
    }
}
