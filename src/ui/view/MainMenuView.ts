import { BoxRenderable } from "@opentui/core";
import { MainMenuViewModel, type RootMenuMode } from '../../viewmodels';
import { MainHeader, SelectMenu } from '../components';
import { ProjectDetection } from "../../utilities/projectDetection";

export function MainMenuView(
    renderer: any,
    viewModel: MainMenuViewModel,
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
    });

    // Create header
    const header = MainHeader(renderer, screenTitle, subtitle);
    menuContainer.add(header);

    // Create select container
    const selectContainer = new BoxRenderable(renderer, {
        id: "select-container",
        width: 120,
        height: 20,
        border: true,
        borderStyle: "single",
        borderColor: "#475569",
        backgroundColor: "transparent",
        margin: 2
    });

    // Create select menu
    const menuOptions = viewModel.getMenuOptions(mode);
    const selectMenu = SelectMenu(renderer, {
        id: "main-menu-select",
        options: menuOptions,
        height: 18,
        autoFocus: true,
        onSelect: (index, option) => {
            const view = viewModel.onMenuItemSelected(index, option);
            onNavigate(view);
        }
    });

    selectContainer.add(selectMenu);
    menuContainer.add(selectContainer);

    return menuContainer;
}
