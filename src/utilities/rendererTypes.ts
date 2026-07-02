/**
 * Minimal types for OpenTUI renderer and renderables so we don't rely on `any`.
 */

import type { RenderContext } from "@opentui/core";

/**
 * The subset of CliRenderer the app uses: the full RenderContext (so views can
 * construct renderables) plus the root container.
 */
export interface CliRendererLike extends RenderContext {
    root: { add: (child: unknown) => void; remove: (id: string) => void };
}

/** Renderable that may have dispose/destroy and optional __dispose. */
export interface DisposableRenderable {
    id?: string;
    parent?: { remove: (id: string) => void } | null;
    __dispose?: () => void;
    destroyRecursively?: () => void;
    destroy?: () => void;
}

/** Select-like component (e.g. SelectRenderable) for view state. */
export interface SelectLike {
    getSelectedOption?: () => { value?: unknown } | null | undefined;
    getSelectedIndex?: () => number;
    __dispose?: () => void;
    destroyRecursively?: () => void;
    destroy?: () => void;
}
