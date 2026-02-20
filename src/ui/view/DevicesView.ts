import { BoxRenderable, Text, TextAttributes } from '@opentui/core';
import type { CliRendererLike } from '../../utilities/rendererTypes';
import type { DevicesViewModel } from '../../viewmodels/DevicesViewModel';
import type { UiTheme } from '../theme';
import { Header, SelectMenu } from '../components';
import { menuPanelOptions, wireCompactMenuLayout } from '../layout';

export function DevicesView(
    renderer: CliRendererLike,
    viewModel: DevicesViewModel,
    theme: UiTheme,
    onNavigate?: (action: string, data?: string) => void,
    onSelectCreated?: (select: any) => void,
): BoxRenderable {
    const container = new BoxRenderable(renderer, {
        id: 'devices-container',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        flexGrow: 1,
        backgroundColor: theme.backgroundColor ?? 'transparent',
    });

    const header = Header(renderer, 'Devices', 'Connected devices and emulators', theme);
    container.add(header);

    const selectContainer = new BoxRenderable(renderer, menuPanelOptions('devices-panel', theme));

    const selectMenu = SelectMenu(renderer, {
        id: 'devices-select',
        options: viewModel.getMenuOptions(),
        autoFocus: true,
        theme,
        itemSpacing: 1,
        onSelect: async (_index, option) => {
            const value = typeof option.value === 'string' ? option.value : '';
            const result = await viewModel.handleMenuSelection(value);
            if (onNavigate && result.action !== 'none' && result.action !== 'refreshed') {
                onNavigate(result.action, result.data);
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

    onSelectCreated?.(selectMenu);

    return container;
}
