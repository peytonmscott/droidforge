import { BoxRenderable } from "@opentui/core";

type DisposableRenderable = BoxRenderable & { __dispose?: () => void };

function removeRenderableFromParentOrRoot(renderer: any, renderable: any): void {
    const id = renderable?.id;
    if (!id) return;

    const parent = renderable?.parent;
    if (parent && typeof parent.remove === 'function') {
        try {
            parent.remove(id);
            return;
        } catch {
            // ignore
        }
    }

    try {
        renderer.root.remove(id);
    } catch {
        // ignore
    }
}

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
            try {
                (element as any).destroyRecursively();
            } catch {
                removeRenderableFromParentOrRoot(renderer, element);
            }
        } else {
            removeRenderableFromParentOrRoot(renderer, element);
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
            try {
                menuSelect.destroyRecursively();
            } catch {
                removeRenderableFromParentOrRoot(renderer, menuSelect);
            }
        } else if (typeof menuSelect.destroy === 'function') {
            try {
                menuSelect.destroy();
            } catch {
                removeRenderableFromParentOrRoot(renderer, menuSelect);
            }
        } else {
            removeRenderableFromParentOrRoot(renderer, menuSelect);
        }
    }
}
