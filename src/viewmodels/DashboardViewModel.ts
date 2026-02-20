import type { ProjectRepository } from '../data/repositories/ProjectRepository';

export class DashboardViewModel {
    constructor(private projectRepo: ProjectRepository) {}

    async getQuickStats() {
        const projects = await this.projectRepo.getAllProjects();
        return {
            projects: projects.length,
            recent: projects.filter(p => {
                const dayAgo = new Date();
                dayAgo.setDate(dayAgo.getDate() - 1);
                return p.updatedAt && new Date(p.updatedAt) > dayAgo;
            }).length,
        };
    }

    async getRecentProjects(limit = 5) {
        const projects = await this.projectRepo.getAllProjects();
        return projects.slice(0, limit);
    }
}
