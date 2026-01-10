import type { MenuOption, Project } from '../data/schemas';
import type { ProjectRepository } from '../data/repositories/ProjectRepository';

export class ProjectsViewModel {
    private projects: Project[] = [];

    private mode: 'normal' | 'confirm-remove' = 'normal';
    private removalTarget: Project | null = null;
    private lastSelectedIndex = 0;

    private onMenuUpdate: (() => void) | null = null;

    constructor(private projectRepo: ProjectRepository) {
        void this.refresh();
    }

    setMenuUpdateCallback(callback: () => void): void {
        this.onMenuUpdate = callback;
        this.onMenuUpdate?.();
    }

    private notifyMenuUpdate(): void {
        this.onMenuUpdate?.();
    }

    isConfirmingRemoval(): boolean {
        return this.mode === 'confirm-remove' && this.removalTarget !== null;
    }

    getRemovalTarget(): Project | null {
        return this.removalTarget;
    }

    async refresh(): Promise<void> {
        try {
            this.projects = await this.projectRepo.getAllProjects();
        } catch {
            this.projects = [];
        }
        this.notifyMenuUpdate();
    }

    async requestRemoveProjectById(projectId: string, selectedIndex: number): Promise<void> {
        const target = this.projects.find((project) => project.id === projectId) ?? null;
        if (!target) return;

        this.lastSelectedIndex = selectedIndex;
        this.mode = 'confirm-remove';
        this.removalTarget = target;
        this.notifyMenuUpdate();
    }

    async confirmRemove(): Promise<void> {
        if (!this.removalTarget) return;

        await this.projectRepo.deleteProject(this.removalTarget.id);
        this.mode = 'normal';
        this.removalTarget = null;
        await this.refresh();
    }

    cancelRemove(): void {
        this.mode = 'normal';
        this.removalTarget = null;
        this.notifyMenuUpdate();
    }

    getInitialSelectedIndex(): number {
        return this.isConfirmingRemoval() ? 0 : this.lastSelectedIndex;
    }

    getFooterText(): string {
        if (this.isConfirmingRemoval()) {
            const name = this.removalTarget?.name ?? 'this project';
            return `Remove "${name}"? ENTER/Y: Confirm | N/ESC: Cancel`;
        }

        return 'ESC: Back to Menu | ↑↓: Navigate | ENTER: Open | R: Remove';
    }

    getProjects(): MenuOption[] {
        if (this.projects.length === 0) {
            return [
                {
                    name: 'No projects yet',
                    description: 'Run Droidforge inside an Android project to add it',
                    value: 'noop',
                },
            ];
        }

        return this.projects.map((project) => ({
            name: project.name,
            description: project.path,
            value: `open-project-${project.id}`,
        }));
    }

    getAllMenuOptions(): MenuOption[] {
        if (this.isConfirmingRemoval()) {
            const name = this.removalTarget?.name ?? 'this project';
            const id = this.removalTarget?.id ?? '';

            return [
                {
                    name: `Remove: ${name}`,
                    description: 'Permanently remove from the list',
                    value: `confirm-remove:${id}`,
                },
                {
                    name: 'Cancel',
                    description: 'Keep it in the list',
                    value: 'cancel-remove',
                },
            ];
        }

        return [...this.getProjects()];
    }

    onMenuItemSelected(_index: number, option: MenuOption): string {
        return option.value as string;
    }
}
