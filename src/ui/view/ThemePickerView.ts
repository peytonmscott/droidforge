import { BoxRenderable } from '@opentui/core';

import { menuHeaderSectionOptions, menuPanelOptions, wireCompactMenuLayout } from '../layout';

import type { MenuOption } from '../../data/schemas';
import type { SettingsViewModel } from '../../viewmodels';
import type { UiTheme } from '../theme';

import { Header, SelectMenu } from '../components';

export function ThemePickerView(
    renderer: any,
    viewModel: SettingsViewModel,
    theme: UiTheme,
    onBack?: () => void,
    onSelectCreated?: (select: any) => void,
): BoxRenderable {
    const container = new BoxRenderable(renderer, {
        id: 'theme-picker-container',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        flexGrow: 1,
        backgroundColor: theme.backgroundColor ?? 'transparent',
    });

    const headerSection = new BoxRenderable(renderer, menuHeaderSectionOptions());

    const modePref = viewModel.getThemeModePreference();
    const effectiveMode = viewModel.getEffectiveThemeMode();
    headerSection.add(Header(renderer, 'Themes', `Mode: ${modePref} (${effectiveMode}) • Current: ${viewModel.getSelectedThemeId()}`, theme));
    container.add(headerSection);

    const panel = new BoxRenderable(renderer, menuPanelOptions('theme-menu-panel', theme));

    const themes = viewModel.listThemes();
    const selectedId = viewModel.getSelectedThemeId();

    const options: MenuOption[] = themes.map((entry) => ({
        name: entry.displayName,
        description: `${entry.id} (${entry.source})`,
        value: entry.id,
    }));

    const initialIndex = Math.max(0, options.findIndex((opt) => opt.value === selectedId));

    const selectMenu = SelectMenu(renderer, {
        id: 'theme-select',
        options,
        selectedIndex: initialIndex,
        theme,
        autoFocus: true,
        itemSpacing: 1,
        onSelect: (_idx, option) => {
            const themeId = typeof option.value === 'string' ? option.value : '';
            void viewModel.selectTheme(themeId);
        },
    });

    wireCompactMenuLayout(panel, selectMenu);

    panel.add(selectMenu);
    container.add(panel);

    onSelectCreated?.(selectMenu);

    return container;
}
