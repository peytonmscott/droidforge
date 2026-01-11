export class NavigationManager {
    private currentView: string = "menu";
    private viewStack: string[] = ["menu"];

    constructor() {
        const initialView = this.getInitialView();
        this.currentView = initialView;
        this.viewStack = [initialView]
    }

    getInitialView(): string {
        // The root screen adapts based on whether we're in a project.
        return "menu";
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
