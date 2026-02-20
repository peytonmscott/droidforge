import { BoxRenderable } from "@opentui/core";
import type { CliRendererLike } from '../../utilities/rendererTypes';
import { GradleViewModel } from '../../viewmodels';
import { MainHeader, SelectMenu } from '../components';
import type { UiTheme } from '../theme';
import { menuPanelOptions, wireCompactMenuLayout } from '../layout';
import { SPACING } from "../constants";

export interface GradleViewTitles {
    headerTitle: string;
    panelTitle: string;
}

export function GradleView(
    renderer: CliRendererLike,
    viewModel: GradleViewModel,
    theme: UiTheme,
    onNavigate?: (action: string) => void,
    titles: GradleViewTitles = { headerTitle: 'Gradle Tasks', panelTitle: 'Gradle' }
): BoxRenderable {
    const container = new BoxRenderable(renderer, {
        id: "gradle-container",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        flexGrow: 1,
        backgroundColor: theme.backgroundColor ?? "transparent",
    });

    const header = MainHeader(renderer, titles.headerTitle, titles.panelTitle, theme);
    container.add(header);

    const spacer = new BoxRenderable(renderer, { id: 'gradle-header-spacer', height: SPACING.NORMAL, flexShrink: 0 });
    container.add(spacer);

    const selectContainer = new BoxRenderable(renderer, menuPanelOptions('gradle-menu-panel', theme));

    const selectMenu = SelectMenu(renderer, {
        id: "gradle-select",
        options: viewModel.getMenuOptions(),
        autoFocus: true,
        theme,
        itemSpacing: 1,
        onSelect: (_index, option) => {
            const value = typeof option.value === 'string' ? option.value : '';
            const result = viewModel.handleMenuSelection(value);

            if (result.action === 'navigate' && onNavigate) {
                onNavigate(`actionoutputview:${result.command}`);
            }
        },
    });

    wireCompactMenuLayout(selectContainer, selectMenu);

    function refreshMenu(): void {
        selectMenu.options = viewModel.getMenuOptions();
    }

    viewModel.setMenuUpdateCallback(refreshMenu);

    selectContainer.add(selectMenu);
    container.add(selectContainer);

    refreshMenu();

    return container;
}
