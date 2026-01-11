import { BoxRenderable, Text, TextAttributes } from "@opentui/core";
import { MainHeader } from "../components";
import type { UiTheme } from "../theme";
import { MENU_PANEL_MAX_WIDTH, MENU_PANEL_MIN_WIDTH, MENU_PANEL_WIDTH } from "../layout";

export function ComingSoonView(
    renderer: any,
    theme: UiTheme,
    title: string,
    description: string
): BoxRenderable {
    const container = new BoxRenderable(renderer, {
        id: "coming-soon-container",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        flexGrow: 1,
        backgroundColor: theme.backgroundColor ?? "transparent",
    });

    container.add(MainHeader(renderer, title, "Coming soon", theme));

    const body = new BoxRenderable(renderer, {
        id: "coming-soon-body",
        width: MENU_PANEL_WIDTH,
        maxWidth: MENU_PANEL_MAX_WIDTH,
        minWidth: MENU_PANEL_MIN_WIDTH,
        flexGrow: 0,
        border: true,
        borderStyle: "single",
        borderColor: theme.borderColor ?? "#475569",
        backgroundColor: theme.panelBackgroundColor ?? "transparent",
        padding: 1,
        margin: 2,
    });

    body.add(Text({
        id: "coming-soon-description",
        content: description,
        attributes: TextAttributes.NONE,
        fg: theme.textColor,
        wrapMode: 'word',
    }));


    container.add(body);

    return container;
}
