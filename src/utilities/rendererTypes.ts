/**
 * Minimal types for OpenTUI renderer and renderables so we don't rely on `any`.
 */

export interface CliRendererLike {
    root: { add: (child: unknown) => void; remove: (id: string) => void };
    keyInput: { on: (event: string, handler: (key: { name?: string }) => void) => void };
    requestLive?: () => void;
    dropLive?: () => void;
}

/** Renderable that may have dispose/destroy and optional __dispose. */
export interface DisposableRenderable {
    id?: string;
    parent?: { remove: (id: string) => void };
    __dispose?: () => void;
    destroyRecursively?: () => void;
    destroy?: () => void;
}

/** Select-like component (e.g. SelectRenderable) for view state. */
export interface SelectLike {
    getSelectedOption?: () => { value?: unknown } | undefined;
    getSelectedIndex?: () => number;
    __dispose?: () => void;
    destroyRecursively?: () => void;
    destroy?: () => void;
}
