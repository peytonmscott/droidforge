import { Text, BoxRenderable } from "@opentui/core";
import { DashboardViewModel } from '../../viewmodels';
import { Header, Footer, Panel } from '../components';

export function DashboardView(renderer: any, viewModel: DashboardViewModel): BoxRenderable {
    const dashboardContainer = new BoxRenderable(renderer, {
        id: "dashboard-container",
        flexDirection: "column",
        flexGrow: 1,
    });

    // Header
    const header = Header(renderer, "🏠 Dashboard - Quick Actions");
    dashboardContainer.add(header);

    // Main content
    const contentBox = new BoxRenderable(renderer, {
        id: "dashboard-content",
        flexDirection: "row",
        flexGrow: 1,
    });

    // Left panel - Recent projects
    const leftPanel = Panel(renderer, {
        id: "projects-panel",
        title: "📁 Recent Projects",
        flexGrow: 1
    });
    
    viewModel.getRecentProjects().forEach(project => {
        leftPanel.add(Text({ content: `• ${project}`, margin: 1 }));
    });

    // Right panel - Quick stats
    const rightPanel = Panel(renderer, {
        id: "stats-panel",
        title: "📊 Quick Stats",
        flexGrow: 1
    });
    
    const stats = viewModel.getQuickStats();
    rightPanel.add(Text({ content: `Projects: ${stats.projects}`, margin: 1 }));
    rightPanel.add(Text({ content: `Active: ${stats.active}`, margin: 1 }));
    rightPanel.add(Text({ content: `Completed: ${stats.completed}`, margin: 1 }));
    rightPanel.add(Text({ content: `Templates: ${stats.templates}`, margin: 1 }));

    contentBox.add(leftPanel);
    contentBox.add(rightPanel);
    dashboardContainer.add(contentBox);

    // Footer
    const footer = Footer(renderer, "ESC: Back to Menu | TAB: Navigate | ENTER: Select");
    dashboardContainer.add(footer);

    return dashboardContainer;
}