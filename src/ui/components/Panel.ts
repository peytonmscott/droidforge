import { BoxRenderable } from "@opentui/core";
import type { UiTheme } from "../theme";

export interface PanelProps {
    id: string;
    title?: string;
    width?: number;
    height?: number;
    flexGrow?: number;
    border?: boolean;
    margin?: number;
    titleAlignment?: "left" | "center" | "right";
    theme?: UiTheme;
}

export function Panel(renderer: any, props: PanelProps): BoxRenderable {
    const panel = new BoxRenderable(renderer, {
        id: props.id,
        width: props.width,
        height: props.height,
        flexGrow: props.flexGrow,
        border: props.border !== false,
        borderStyle: "single",
        borderColor: props.theme?.borderColor ?? "#475569",
        backgroundColor: props.theme?.panelBackgroundColor ?? "transparent",
        margin: props.margin || 1,
        title: props.title,
        titleAlignment: props.titleAlignment || "left",
    });

    return panel;
}
