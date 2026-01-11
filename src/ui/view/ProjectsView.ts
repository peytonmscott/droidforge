import { BoxRenderable } from "@opentui/core";
import { ProjectsViewModel } from '../../viewmodels';
import { Header, SelectMenu } from '../components';
import type { UiTheme } from '../theme';
import { menuPanelOptions, wireCompactMenuLayout } from '../layout';

export function ProjectsView(
    renderer: any,
    viewModel: ProjectsViewModel,
    theme: UiTheme,
    onNavigate?: (action: string) => void,
    onSelectCreated?: (select: any) => void,
    onStatusText?: (text: string) => void,
): BoxRenderable {
    // Create projects container
    const projectsContainer = new BoxRenderable(renderer, {
        id: "projects-container",
        alignItems: "center",
        justifyContent: "center",
        flexGrow: 1,
        backgroundColor: theme.backgroundColor ?? "transparent",
    });

    // Header
    const header = Header(renderer, "Project Ledger", "Projects", theme);
    projectsContainer.add(header);

    // Create select container
    const selectContainer = new BoxRenderable(renderer, menuPanelOptions('projects-panel', theme));

    // Create select menu with all options
    const selectMenu = SelectMenu(renderer, {
        id: "projects-select",
        options: viewModel.getAllMenuOptions(),
        autoFocus: true,
        theme,
        selectedIndex: viewModel.getInitialSelectedIndex(),
        itemSpacing: 0.5,
        onSelect: (index, option) => {
            const action = viewModel.onMenuItemSelected(index, option);
            if (onNavigate) {
                onNavigate(action);
            }
        }
    });

    wireCompactMenuLayout(selectContainer, selectMenu);

    onSelectCreated?.(selectMenu);

    function refreshMenu(): void {
        selectMenu.options = viewModel.getAllMenuOptions();
        selectMenu.setSelectedIndex(viewModel.getInitialSelectedIndex());

        onStatusText?.(viewModel.getFooterText());

        selectMenu.focus();
    }

    viewModel.setMenuUpdateCallback(refreshMenu);

    selectContainer.add(selectMenu);
    projectsContainer.add(selectContainer);

    onStatusText?.(viewModel.getFooterText());

    return projectsContainer;
}
