import { BoxRenderable } from "@opentui/core";

import type { UiTheme } from "./theme";

export const MENU_PANEL_MAX_WIDTH = 96;
export const MENU_PANEL_MIN_WIDTH = 40;
export const MENU_PANEL_WIDTH: `${number}%` = "85%";

export const MENU_PANEL_MAX_HEIGHT = 20;
export const MENU_PANEL_MIN_HEIGHT = 8;

export const COMPACT_WIDTH_THRESHOLD = 70;

export function createMenuContainer(renderer: any, id: string, theme: UiTheme): BoxRenderable {
    return new BoxRenderable(renderer, {
        id,
        flexDirection: "column",
        flexGrow: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.backgroundColor ?? "transparent",
    });
}

export function menuHeaderSectionOptions() {
    return {
        width: MENU_PANEL_WIDTH,
        maxWidth: MENU_PANEL_MAX_WIDTH,
        minWidth: MENU_PANEL_MIN_WIDTH,
        alignItems: "flex-start",
        justifyContent: "flex-start",
        flexShrink: 0,
    } as const;
}

export function menuPanelOptions(id: string, theme: UiTheme, overrides: Record<string, unknown> = {}) {
    return {
        id,
        width: MENU_PANEL_WIDTH,
        maxWidth: MENU_PANEL_MAX_WIDTH,
        minWidth: MENU_PANEL_MIN_WIDTH,
        flexGrow: 1,
        maxHeight: MENU_PANEL_MAX_HEIGHT,
        minHeight: MENU_PANEL_MIN_HEIGHT,
        border: true,
        borderStyle: "single",
        borderColor: theme.borderColor ?? "#475569",
        backgroundColor: theme.panelBackgroundColor ?? "transparent",
        margin: 2,
        ...overrides,
    } as const;
}

export function applyCompactMenuLayout(options: {
    panel: any;
    select?: any;
    force?: boolean;
}): void {
    const width = options.panel?.width ?? 0;
    const compact = options.force ?? (width > 0 && width < COMPACT_WIDTH_THRESHOLD);

    if (options.select && typeof options.select.showDescription !== "undefined") {
        options.select.showDescription = !compact;
    }

    // Tighten spacing a bit when cramped.
    if (options.panel) {
        options.panel.margin = compact ? 1 : 2;
    }

    if (options.select && typeof options.select.itemSpacing !== "undefined") {
        options.select.itemSpacing = compact ? 0 : 1;
    }
}

export function wireCompactMenuLayout(panel: any, select: any): void {
    const update = function (this: any) {
        applyCompactMenuLayout({ panel: this, select });
    };

    panel.onSizeChange = update;

    // Run once after initial layout pass.
    queueMicrotask(() => {
        try {
            applyCompactMenuLayout({ panel, select });
        } catch {
            // ignore
        }
    });
}
