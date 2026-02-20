import type { BoxRenderable } from "@opentui/core";

import type { SettingsViewModel } from '../../viewmodels';
import type { UiTheme } from '../theme';

import { ThemePickerView } from './ThemePickerView';

// Settings currently acts as the theme picker.
export function SettingsView(
    renderer: import('../../utilities/rendererTypes').CliRendererLike,
    viewModel: SettingsViewModel,
    theme: UiTheme,
    onBack?: () => void,
): BoxRenderable {
    return ThemePickerView(renderer, viewModel, theme, onBack);
}
