import type { MenuOption } from '../data/schemas';

export class ProjectsViewModel {
    private projects = [
        { name: "My Awesome App", status: "Active" },
        { name: "Web Scraper Tool", status: "Completed" },
        { name: "API Client", status: "In Progress" },
        { name: "Data Visualizer", status: "Draft" }
    ];

    getProjects(): MenuOption[] {
        return this.projects.map((project, index) => ({
            name: project.name,
            description: `Status: ${project.status}`,
            value: `open-project-${index}`
        }));
    }

    getAllMenuOptions(): MenuOption[] {
        return [
            ...this.getProjects(),
        ];
    }

    onMenuItemSelected(index: number, option: MenuOption): string {
        return option.value as string;
    }
}
