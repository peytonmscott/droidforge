import { BoxRenderable } from "@opentui/core";
import { ProjectsViewModel } from '../../viewmodels';
import { Header, Footer, SelectMenu } from '../components';

export function ProjectsView(
    renderer: any,
    viewModel: ProjectsViewModel,
    onNavigate?: (action: string) => void,
    onSelectCreated?: (select: any) => void
): BoxRenderable {
    // Create projects container
    const projectsContainer = new BoxRenderable(renderer, {
        id: "projects-container",
        alignItems: "center",
        justifyContent: "center",
        flexGrow: 1,
    });

    // Header
    const header = Header(renderer, "Project Ledger");
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
        title: "Project Ledger",
        titleAlignment: "center",
        margin: 2
    });

    // Create select menu with all options
    const selectMenu = SelectMenu(renderer, {
        id: "projects-select",
        options: viewModel.getAllMenuOptions(),
        height: 18,
        autoFocus: true,
        selectedIndex: viewModel.getInitialSelectedIndex(),
        onSelect: (index, option) => {
            const action = viewModel.onMenuItemSelected(index, option);
            if (onNavigate) {
                onNavigate(action);
            }
        }
    });

    onSelectCreated?.(selectMenu);

    function refreshMenu(): void {
        selectMenu.options = viewModel.getAllMenuOptions();
        selectMenu.setSelectedIndex(viewModel.getInitialSelectedIndex());

        projectsContainer.remove('footer-box');
        const footer = Footer(renderer, viewModel.getFooterText());
        projectsContainer.add(footer);

        selectMenu.focus();
    }

    viewModel.setMenuUpdateCallback(refreshMenu);

    selectContainer.add(selectMenu);
    projectsContainer.add(selectContainer);

    // Footer
    const footer = Footer(renderer, viewModel.getFooterText());
    projectsContainer.add(footer);

    return projectsContainer;
}
