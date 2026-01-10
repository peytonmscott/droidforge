import { Text, BoxRenderable } from "@opentui/core";
import { ToolsViewModel } from '../../viewmodels';
import { Header, Footer, Panel } from '../components';

export function ToolsView(renderer: any, viewModel: ToolsViewModel): BoxRenderable {
    const toolsContainer = new BoxRenderable(renderer, {
        id: "tools-container",
        flexDirection: "column",
        flexGrow: 1,
    });

    // Header
    const header = Header(renderer, "🔧 Tools - Development Utilities");
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
        flexGrow: 1
    });
    
    viewModel.getCodeGenerators().forEach(generator => {
        leftPanel.add(Text({ content: `• ${generator}`, margin: 1 }));
    });

    // Utilities
    const rightPanel = Panel(renderer, {
        id: "tools-utilities",
        title: "Utilities",
        flexGrow: 1
    });
    
    viewModel.getUtilities().forEach(utility => {
        rightPanel.add(Text({ content: `• ${utility}`, margin: 1 }));
    });

    contentBox.add(leftPanel);
    contentBox.add(rightPanel);
    toolsContainer.add(contentBox);

    // Footer
    const footer = Footer(renderer, "ESC: Back to Menu | Click tools to use them");
    toolsContainer.add(footer);

    return toolsContainer;
}