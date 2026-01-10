import { Text, BoxRenderable } from "@opentui/core";
import { SettingsViewModel } from '../../viewmodels';
import { Header, Footer, Panel } from '../components';

export function SettingsView(renderer: any, viewModel: SettingsViewModel): BoxRenderable {
    const settingsContainer = new BoxRenderable(renderer, {
        id: "settings-container",
        flexDirection: "column",
        flexGrow: 1,
    });

    // Header
    const header = Header(renderer, "⚙️ Settings - Configuration");
    settingsContainer.add(header);

    // Main content
    const contentBox = new BoxRenderable(renderer, {
        id: "settings-content",
        flexDirection: "row",
        flexGrow: 1,
    });

    // Preferences
    const leftPanel = Panel(renderer, {
        id: "preferences-panel",
        title: "Preferences",
        flexGrow: 1
    });
    
    const prefs = viewModel.getPreferences();
    leftPanel.add(Text({ content: `Theme: ${prefs.theme}`, margin: 1 }));
    leftPanel.add(Text({ content: `Language: ${prefs.language}`, margin: 1 }));
    leftPanel.add(Text({ content: `Auto-save: ${prefs.autoSave}`, margin: 1 }));
    leftPanel.add(Text({ content: `Notifications: ${prefs.notifications}`, margin: 1 }));

    // Advanced
    const rightPanel = Panel(renderer, {
        id: "advanced-panel",
        title: "Advanced",
        flexGrow: 1
    });
    
    const advanced = viewModel.getAdvancedOptions();
    rightPanel.add(Text({ content: `Cache: ${advanced.cache}`, margin: 1 }));
    rightPanel.add(Text({ content: `Data: ${advanced.data}`, margin: 1 }));
    rightPanel.add(Text({ content: `Debug: ${advanced.debug}`, margin: 1 }));
    rightPanel.add(Text({ content: `Reset: ${advanced.reset}`, margin: 1 }));

    contentBox.add(leftPanel);
    contentBox.add(rightPanel);
    settingsContainer.add(contentBox);

    // Footer
    const footer = Footer(renderer, "ESC: Back to Menu | SPACE: Toggle options");
    settingsContainer.add(footer);

    return settingsContainer;
}