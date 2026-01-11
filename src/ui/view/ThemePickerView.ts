import { BoxRenderable } from '@opentui/core';

import type { MenuOption } from '../../data/schemas';
import type { SettingsViewModel } from '../../viewmodels';
import type { UiTheme } from '../theme';

import { Header, Footer, SelectMenu } from '../components';

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

    const headerSection = new BoxRenderable(renderer, {
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        width: 108,
    });

    const modePref = viewModel.getThemeModePreference();
    const effectiveMode = viewModel.getEffectiveThemeMode();
    headerSection.add(Header(renderer, 'Themes', `Mode: ${modePref} (${effectiveMode}) • Current: ${viewModel.getSelectedThemeId()}`, theme));
    headerSection.add(Header(renderer, 'Colorschemes', undefined, theme));
    container.add(headerSection);

    const panel = new BoxRenderable(renderer, {
        id: 'theme-menu-panel',
        width: 100,
        height: 20,
        border: true,
        borderStyle: 'single',
        borderColor: theme.borderColor ?? '#475569',
        backgroundColor: theme.panelBackgroundColor ?? 'transparent',
        margin: 2,
    });

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
        height: 18,
        selectedIndex: initialIndex,
        theme,
        autoFocus: true,
        onSelect: (_idx, option) => {
            const themeId = typeof option.value === 'string' ? option.value : '';
            void viewModel.selectTheme(themeId);
        },
    });

    panel.add(selectMenu);
    container.add(panel);

    onSelectCreated?.(selectMenu);

    const footer = Footer(renderer, 'ESC: Back | M: Mode | D/L: Set dark/light | R: Reload', theme);
    container.add(footer);

    return container;
}
