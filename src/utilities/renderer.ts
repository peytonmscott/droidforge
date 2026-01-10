import { BoxRenderable } from "@opentui/core";

export function clearCurrentView(renderer: any, currentViewElements: BoxRenderable[], menuSelect?: any): void {
    // Clear existing elements
    currentViewElements.forEach(element => {
        if (element && typeof element === 'object' && element.id) {
            renderer.root.remove(element.id);
        }
    });
    currentViewElements.length = 0;

    // Clear select element if it exists
    if (menuSelect) {
        menuSelect.destroy();
    }
}