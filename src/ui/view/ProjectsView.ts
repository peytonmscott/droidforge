import { BoxRenderable } from "@opentui/core";
import { ProjectsViewModel } from '../../viewmodels';
import { Header, Footer, SelectMenu } from '../components';

export function ProjectsView(
    renderer: any,
    viewModel: ProjectsViewModel,
    onNavigate?: (action: string) => void
): BoxRenderable {
    // Create projects container
    const projectsContainer = new BoxRenderable(renderer, {
        id: "projects-container",
        alignItems: "center",
        justifyContent: "center",
        flexGrow: 1,
    });

    // Header
    const header = Header(renderer, "📂 Projects - Create & Manage");
    projectsContainer.add(header);

    // Create select container
    const selectContainer = new BoxRenderable(renderer, {
        id: "select-container",
        width: 120,
        height: 20,
        border: true,
        borderStyle: "single",
        borderColor: "#475569",
        backgroundColor: "transparent",
        title: "Projects & Actions",
        titleAlignment: "center",
        margin: 2
    });

    // Create select menu with all options
    const menuOptions = viewModel.getAllMenuOptions();
    const selectMenu = SelectMenu(renderer, {
        id: "projects-select",
        options: menuOptions,
        height: 18,
        autoFocus: true,
        onSelect: (index, option) => {
            if (option.value === "separator") return; // Skip separator
            const action = viewModel.onMenuItemSelected(index, option);
            if (onNavigate) {
                onNavigate(action);
            }
        }
    });

    selectContainer.add(selectMenu);
    projectsContainer.add(selectContainer);

    // Footer
    const footer = Footer(renderer, "ESC: Back to Menu | ↑↓: Navigate | ENTER: Select");
    projectsContainer.add(footer);

    return projectsContainer;
}
