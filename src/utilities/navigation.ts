import { ProjectDetection } from "./projectDetection";

export class NavigationManager {
    private currentView: string = "menu";
    private viewStack: string[] = ["menu"];

    constructor() {
        const initialView = this.getInitialView();
        this.currentView = initialView;
        this.viewStack = [initialView]
    }

    getInitialView(): string {
        const projectDetection = new ProjectDetection();
        const project = projectDetection.detectAndroidProject(process.cwd());

        if (project.isAndroidProject) {
            return "actions"; // In Android project → straight to actions
        }

        return "projects"; // First time → welcome flow
    }

    getCurrentView(): string {
        return this.currentView;
    }

    navigateTo(view: string): void {
        this.currentView = view;
        this.viewStack.push(view);
    }

    goBack(): string {
        if (this.viewStack.length > 1) {
            this.viewStack.pop();
            this.currentView = this.viewStack[this.viewStack.length - 1] || "menu";
        } else {
            this.currentView = "menu";
        }
        return this.currentView;
    }

    canGoBack(): boolean {
        return this.viewStack.length > 1;
    }

}
