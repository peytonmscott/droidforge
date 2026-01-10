import { BoxRenderable, Text, TextAttributes } from "@opentui/core";
import { ActionsViewModel } from '../../viewmodels';
import { Header, SelectMenu } from '../components';

export function ActionsView(
    renderer: any,
    viewModel: ActionsViewModel,
    onNavigate?: (action: string) => void
): BoxRenderable {
    const container = new BoxRenderable(renderer, {
        id: "actions-container",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        flexGrow: 1,
    });

    const headerSection = new BoxRenderable(renderer, {
        alignItems: "flex-start",
        justifyContent: "flex-start",
        width: 108,
    });

    headerSection.add(Header(renderer, "🐘 Gradle - Test, Build, Run and Deploy!"));
    container.add(headerSection);

    const menuPanel = new BoxRenderable(renderer, {
        id: "menu-panel",
        width: 100,
        height: 20,
        border: true,
        borderStyle: "single",
        borderColor: "#475569",
        title: "Actions",
        titleAlignment: "center",
        margin: 2,
    });

    const selectMenu = SelectMenu(renderer, {
        id: "actions-select",
        options: viewModel.getMenuOptions(),
        height: 18,
        autoFocus: true,
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

        headerSection.remove('actions-message');

        if (!message) return;

        headerSection.add(Text({
            id: 'actions-message',
            content: message,
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
