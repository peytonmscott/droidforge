import { BoxRenderable } from '@opentui/core';
import type { CliRendererLike } from '../../utilities/rendererTypes';
import type { MirrorViewModel } from '../../viewmodels/MirrorViewModel';
import type { UiTheme } from '../theme';
import { Header, SelectMenu } from '../components';
import { menuPanelOptions, wireCompactMenuLayout } from '../layout';

export function MirrorView(
    renderer: CliRendererLike,
    viewModel: MirrorViewModel,
    theme: UiTheme,
    onNavigate?: (action: string) => void,
): BoxRenderable {
    const container = new BoxRenderable(renderer, {
        id: 'mirror-container',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        flexGrow: 1,
        backgroundColor: theme.backgroundColor ?? 'transparent',
    });

    const header = Header(renderer, 'Screen Mirror', 'Mirror device display via scrcpy', theme);
    container.add(header);

    const selectContainer = new BoxRenderable(renderer, menuPanelOptions('mirror-panel', theme));

    const selectMenu = SelectMenu(renderer, {
        id: 'mirror-select',
        options: viewModel.getMenuOptions(),
        autoFocus: true,
        theme,
        itemSpacing: 1,
        onSelect: (_index, option) => {
            const value = typeof option.value === 'string' ? option.value : '';
            viewModel.handleMenuSelection(value);
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
