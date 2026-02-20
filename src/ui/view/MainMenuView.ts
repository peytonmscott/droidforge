import { BoxRenderable } from "@opentui/core";
import type { CliRendererLike } from '../../utilities/rendererTypes';
import type { WorkspaceService } from '../../workspace';
import { MainMenuViewModel, type RootMenuMode } from '../../viewmodels';
import { MainHeader, SelectMenu } from '../components';
import type { UiTheme } from '../theme';
import { menuPanelOptions, wireCompactMenuLayout } from '../layout';

export function MainMenuView(
    renderer: CliRendererLike,
    viewModel: MainMenuViewModel,
    theme: UiTheme,
    onNavigate: (view: string) => void,
    workspace: WorkspaceService
): BoxRenderable {
    const mode: RootMenuMode = workspace.isAndroidProject ? 'anvil' : 'forge';
    const screenTitle = 'Droidforge';
    const subtitle = mode === 'anvil' ? 'In project' : 'No project';

    // Create menu container
    const menuContainer = new BoxRenderable(renderer, {
        id: "menu-container",
        alignItems: "center",
        justifyContent: "center",
        flexGrow: 1,
        backgroundColor: theme.backgroundColor ?? "transparent",
    });

    // Create header
    const header = MainHeader(renderer, screenTitle, subtitle, theme);
    menuContainer.add(header);

    // Spacer between title and panel
    const spacer = new BoxRenderable(renderer, { id: 'menu-header-spacer', height: 1, flexShrink: 0 });
    menuContainer.add(spacer);

    // Create select container
    const selectContainer = new BoxRenderable(renderer, menuPanelOptions("main-menu-panel", theme));

    // Create select menu
    const menuOptions = viewModel.getMenuOptions(mode);
    const selectMenu = SelectMenu(renderer, {
        id: "main-menu-select",
        options: menuOptions,
        autoFocus: true,
        theme,
        itemSpacing: 1,
        onSelect: (index, option) => {
            const view = viewModel.onMenuItemSelected(index, option);
            onNavigate(view);
        }
    });

    wireCompactMenuLayout(selectContainer, selectMenu);

    selectContainer.add(selectMenu);
    menuContainer.add(selectContainer);

    return menuContainer;
}
