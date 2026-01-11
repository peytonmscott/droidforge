import { BoxRenderable, Text, TextAttributes } from "@opentui/core";
import { ActionsViewModel } from '../../viewmodels';
import { Header, SelectMenu } from '../components';
import type { UiTheme } from '../theme';
import { menuHeaderSectionOptions, menuPanelOptions, wireCompactMenuLayout } from '../layout';

export function ActionsView(
    renderer: any,
    viewModel: ActionsViewModel,
    theme: UiTheme,
    onNavigate?: (action: string) => void
): BoxRenderable {
    const container = new BoxRenderable(renderer, {
        id: "actions-container",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        flexGrow: 1,
        backgroundColor: theme.backgroundColor ?? "transparent",
    });

    const headerSection = new BoxRenderable(renderer, menuHeaderSectionOptions());

    headerSection.add(Header(renderer, "Actions", "Commands", theme));
    container.add(headerSection);

    const menuPanel = new BoxRenderable(renderer, menuPanelOptions('actions-panel', theme));

    const selectMenu = SelectMenu(renderer, {
        id: "actions-select",
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

    wireCompactMenuLayout(menuPanel, selectMenu);

    function updateInlineMessage(): void {
        const message = viewModel.inlineMessage;

        headerSection.remove('actions-message');

        if (!message) return;

        headerSection.add(Text({
            id: 'actions-message',
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
