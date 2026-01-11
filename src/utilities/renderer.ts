import { BoxRenderable } from "@opentui/core";

type DisposableRenderable = BoxRenderable & { __dispose?: () => void };

export function clearCurrentView(renderer: any, currentViewElements: DisposableRenderable[], menuSelect?: any): void {
    // Dispose and destroy existing elements.
    for (const element of currentViewElements) {
        if (!element || typeof element !== 'object') continue;

        try {
            element.__dispose?.();
        } catch {
            // ignore
        }

        if (typeof (element as any).destroyRecursively === 'function') {
            (element as any).destroyRecursively();
        } else if ((element as any).id) {
            renderer.root.remove((element as any).id);
        }
    }

    currentViewElements.length = 0;

    // Clear select element if it exists.
    if (menuSelect) {
        if (typeof menuSelect.__dispose === 'function') {
            try {
                menuSelect.__dispose();
            } catch {
                // ignore
            }
        }

        if (typeof menuSelect.destroyRecursively === 'function') {
            menuSelect.destroyRecursively();
        } else if (typeof menuSelect.destroy === 'function') {
            menuSelect.destroy();
        }
    }
}
