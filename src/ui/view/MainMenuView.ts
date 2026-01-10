import { BoxRenderable } from "@opentui/core";
import { MainMenuViewModel } from '../../viewmodels';
import { MainHeader as Header, Footer, SelectMenu } from '../components';
import { ProjectDetection } from "../../utilities/projectDetection";

export function MainMenuView(
    renderer: any,
    viewModel: MainMenuViewModel,
    onNavigate: (view: string) => void
): BoxRenderable {
    const detector = new ProjectDetection();
    const isAndroid = detector.detectAndroidProject(process.cwd())

    // Create menu container
    const menuContainer = new BoxRenderable(renderer, {
        id: "menu-container",
        alignItems: "center",
        justifyContent: "center",
        flexGrow: 1,
    });

    // Create header
    const header = Header(renderer, "Droid Forge", isAndroid.isAndroidProject.toString() + process.cwd());
    menuContainer.add(header);

    // Create select container
    const selectContainer = new BoxRenderable(renderer, {
        id: "select-container",
        width: 100,
        height: 15,
        border: true,
        borderStyle: "single",
        borderColor: "#475569",
        backgroundColor: "transparent",
        title: "Main Menu",
        titleAlignment: "center",
        margin: 2
    });

    // Create select menu
    const menuOptions = viewModel.getMenuOptions();
    const selectMenu = SelectMenu(renderer, {
        id: "main-menu-select",
        options: menuOptions,
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
