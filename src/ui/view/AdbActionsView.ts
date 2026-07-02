import { BoxRenderable } from '@opentui/core';
import type { CliRendererLike } from '../../utilities/rendererTypes';
import type { AdbActionsViewModel } from '../../viewmodels/AdbActionsViewModel';
import type { UiTheme } from '../theme';
import { Header, SelectMenu } from '../components';
import { menuPanelOptions, wireCompactMenuLayout } from '../layout';

export function AdbActionsView(
    renderer: CliRendererLike,
    viewModel: AdbActionsViewModel,
    theme: UiTheme,
    onNavigate?: (action: string) => void,
): BoxRenderable {
    const container = new BoxRenderable(renderer, {
        id: 'adb-actions-container',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        flexGrow: 1,
        backgroundColor: theme.backgroundColor ?? 'transparent',
    });

    const device = viewModel.getSelectedDevice();
    const subtitle = device ? `Device: ${device}` : 'Quick device commands';
    const header = Header(renderer, 'ADB Actions', subtitle, theme);
    container.add(header);

    const selectContainer = new BoxRenderable(renderer, menuPanelOptions('adb-actions-panel', theme));

    const selectMenu = SelectMenu(renderer, {
        id: 'adb-actions-select',
        options: viewModel.getMenuOptions(),
        autoFocus: true,
        theme,
        itemSpacing: 1,
        onSelect: async (_index, option) => {
            const value = typeof option.value === 'string' ? option.value : '';
            // Actions run in place; results surface through the menu itself.
            await viewModel.handleMenuSelection(value);
        },
    });

    wireCompactMenuLayout(selectContainer, selectMenu);

    function refreshMenu(): void {
        selectMenu.options = viewModel.getMenuOptions();
    }

    viewModel.setMenuUpdateCallback(refreshMenu);

    selectContainer.add(selectMenu);
    container.add(selectContainer);

    return container;
}
