import type { MenuOption, Project } from '../data/schemas';
import type { ProjectRepository } from '../data/repositories/ProjectRepository';

export class ProjectsViewModel {
    private projects: Project[] = [];

    constructor(private projectRepo: ProjectRepository) {
        void this.loadProjects();
    }

    private async loadProjects(): Promise<void> {
        try {
            this.projects = await this.projectRepo.getAllProjects();
        } catch {
            this.projects = [];
        }
    }

    getProjects(): MenuOption[] {
        if (this.projects.length === 0) {
            return [
                {
                    name: "No projects yet",
                    description: "Create one to get started",
                    value: "noop",
                },
            ];
        }

        return this.projects.map((project) => ({
            name: project.name,
            description: `Status: ${project.status}`,
            value: `open-project-${project.id}`,
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
