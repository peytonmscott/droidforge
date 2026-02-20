import { Text, BoxRenderable } from "@opentui/core";
import { ToolsViewModel } from '../../viewmodels';
import { Header, Panel } from '../components';
import type { UiTheme } from '../theme';

export function ToolsView(renderer: import('../../utilities/rendererTypes').CliRendererLike, viewModel: ToolsViewModel, theme: UiTheme): BoxRenderable {
    const toolsContainer = new BoxRenderable(renderer, {
        id: "tools-container",
        flexDirection: "column",
        flexGrow: 1,
        backgroundColor: theme.backgroundColor ?? 'transparent',
    });

    // Header
    const header = Header(renderer, "🔧 Tools - Development Utilities", undefined, theme);
    toolsContainer.add(header);

    // Main content
    const contentBox = new BoxRenderable(renderer, {
        id: "tools-content",
        flexDirection: "row",
        flexGrow: 1,
    });

    // Tool categories
    const leftPanel = Panel(renderer, {
        id: "tools-categories",
        title: "Code Generators",
        flexGrow: 1,
        theme,
    });
    
    viewModel.getCodeGenerators().forEach(generator => {
        leftPanel.add(Text({ content: `• ${generator}`, margin: 1 }));
    });

    // Utilities
    const rightPanel = Panel(renderer, {
        id: "tools-utilities",
        title: "Utilities",
        flexGrow: 1,
        theme,
    });
    
    viewModel.getUtilities().forEach(utility => {
        rightPanel.add(Text({ content: `• ${utility}`, margin: 1 }));
    });

    contentBox.add(leftPanel);
    contentBox.add(rightPanel);
    toolsContainer.add(contentBox);

    return toolsContainer;
}