import { Text, BoxRenderable } from "@opentui/core";
import type { CliRendererLike } from '../../utilities/rendererTypes';
import { DashboardViewModel } from '../../viewmodels';
import { Header, Panel } from '../components';
import type { UiTheme } from '../theme';
import type { Project } from '../../data/schemas';

export function DashboardView(renderer: CliRendererLike, viewModel: DashboardViewModel, theme: UiTheme): BoxRenderable {
    const dashboardContainer = new BoxRenderable(renderer, {
        id: "dashboard-container",
        flexDirection: "column",
        flexGrow: 1,
        backgroundColor: theme.backgroundColor ?? 'transparent',
    });

    const header = Header(renderer, "Dashboard - Quick Actions", undefined, theme);
    dashboardContainer.add(header);

    const contentBox = new BoxRenderable(renderer, {
        id: "dashboard-content",
        flexDirection: "row",
        flexGrow: 1,
    });

    const leftPanel = Panel(renderer, {
        id: "projects-panel",
        title: "Recent Projects",
        flexGrow: 1,
        theme,
    });

    const rightPanel = Panel(renderer, {
        id: "stats-panel",
        title: "Quick Stats",
        flexGrow: 1,
        theme,
    });

    const loadingText = Text({ content: "Loading...", margin: 1, fg: theme.mutedTextColor });
    leftPanel.add(loadingText);

    const projectsText = Text({ content: "Projects: ...", margin: 1, fg: theme.textColor });
    const recentText = Text({ content: "Recent: ...", margin: 1, fg: theme.textColor });
    rightPanel.add(projectsText);
    rightPanel.add(recentText);

    contentBox.add(leftPanel);
    contentBox.add(rightPanel);
    dashboardContainer.add(contentBox);

    const loadData = async () => {
        try {
            const [stats, projects] = await Promise.all([
                viewModel.getQuickStats(),
                viewModel.getRecentProjects(5),
            ]);

            leftPanel.remove(loadingText.id!);
            projects.forEach((project: Project) => {
                leftPanel.add(Text({ content: `  ${project.name}`, margin: 1, fg: theme.textColor }));
            });

            rightPanel.remove(projectsText.id!);
            rightPanel.remove(recentText.id!);
            rightPanel.add(Text({ content: `Projects: ${stats.projects}`, margin: 1, fg: theme.textColor }));
            rightPanel.add(Text({ content: `Recent (24h): ${stats.recent}`, margin: 1, fg: theme.textColor }));
        } catch {
            leftPanel.remove(loadingText.id!);
            leftPanel.add(Text({ content: "  Unable to load", margin: 1, fg: theme.mutedTextColor }));
        }
    };

    loadData();

    return dashboardContainer;
}
