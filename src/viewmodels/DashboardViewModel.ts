export class DashboardViewModel {
    getQuickStats() {
        return {
            projects: 12,
            active: 3,
            completed: 9,
            templates: 25
        };
    }

    getRecentProjects() {
        return [
            "My Awesome App",
            "Web Scraper Tool", 
            "API Client",
            "Data Visualizer"
        ];
    }
}