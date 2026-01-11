import { BoxRenderable } from "@opentui/core";
import { MainMenuViewModel, type RootMenuMode } from '../../viewmodels';
import { MainHeader, SelectMenu } from '../components';
import type { UiTheme } from '../theme';
import { menuPanelOptions, wireCompactMenuLayout } from '../layout';
import { ProjectDetection } from "../../utilities/projectDetection";

export function MainMenuView(
    renderer: any,
    viewModel: MainMenuViewModel,
    theme: UiTheme,
    onNavigate: (view: string) => void
): BoxRenderable {
    const detector = new ProjectDetection();
    const detection = detector.detectAndroidProject(process.cwd());

    const mode: RootMenuMode = detection.isAndroidProject ? 'anvil' : 'forge';
    const screenTitle = mode === 'anvil' ? 'The Anvil' : 'Forge';
    const subtitle = mode === 'anvil' ? 'Project menu' : 'Main menu';

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
