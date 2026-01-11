import { BoxRenderable, Text, TextAttributes } from "@opentui/core";
import { GradleViewModel } from '../../viewmodels';
import { Header, SelectMenu } from '../components';
import type { UiTheme } from '../theme';

export interface GradleViewTitles {
    headerTitle: string;
    panelTitle: string;
}

export function GradleView(
    renderer: any,
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

    const headerSection = new BoxRenderable(renderer, {
        alignItems: "flex-start",
        justifyContent: "flex-start",
        width: 108,
    });

    headerSection.add(Header(renderer, titles.headerTitle, titles.panelTitle, theme));
    container.add(headerSection);

    const menuPanel = new BoxRenderable(renderer, {
        id: "gradle-menu-panel",
        width: 100,
        height: 20,
        border: true,
        borderStyle: "single",
        borderColor: theme.borderColor ?? "#475569",
        backgroundColor: theme.panelBackgroundColor ?? "transparent",
        margin: 2,
    });

    const selectMenu = SelectMenu(renderer, {
        id: "gradle-select",
        options: viewModel.getMenuOptions(),
        height: 18,
        autoFocus: true,
        theme,
        onSelect: (_index, option) => {
            const value = typeof option.value === 'string' ? option.value : '';
            const result = viewModel.handleMenuSelection(value);

            if (result.action === 'navigate' && onNavigate) {
                onNavigate(`actionoutputview:${result.command}`);
            }
        },
    });

    function updateInlineMessage(): void {
        const message = viewModel.inlineMessage;

        headerSection.remove('gradle-message');

        if (!message) return;

        headerSection.add(Text({
            id: 'gradle-message',
            content: message,
            fg: theme.mutedTextColor ?? theme.textColor,
            attributes: TextAttributes.DIM,
            margin: 1,
        }));
    }

    function refreshMenu(): void {
        selectMenu.options = viewModel.getMenuOptions();
        updateInlineMessage();
    }

    viewModel.setMenuUpdateCallback(refreshMenu);

    const menuSection = new BoxRenderable(renderer, {
        alignItems: "center",
        justifyContent: "center",
    });

    menuPanel.add(selectMenu);
    menuSection.add(menuPanel);
    container.add(menuSection);

    refreshMenu();

    return container;
}
