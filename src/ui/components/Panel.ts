import { Text, BoxRenderable } from "@opentui/core";

export interface PanelProps {
    id: string;
    title?: string;
    width?: number;
    height?: number;
    flexGrow?: number;
    border?: boolean;
    margin?: number;
    titleAlignment?: "left" | "center" | "right";
}

export function Panel(renderer: any, props: PanelProps): BoxRenderable {
    const panel = new BoxRenderable(renderer, {
        id: props.id,
        width: props.width,
        height: props.height,
        flexGrow: props.flexGrow,
        border: props.border !== false,
        borderStyle: "single",
        borderColor: "#475569",
        margin: props.margin || 1,
        title: props.title,
        titleAlignment: props.titleAlignment || "left",
    });

    return panel;
}