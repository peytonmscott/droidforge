import { BoxRenderable, Text, TextAttributes } from "@opentui/core";
import { MainHeader } from "../components";

export function ComingSoonView(
    renderer: any,
    title: string,
    description: string
): BoxRenderable {
    const container = new BoxRenderable(renderer, {
        id: "coming-soon-container",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        flexGrow: 1,
    });

    container.add(MainHeader(renderer, title, "Coming soon"));

    const body = new BoxRenderable(renderer, {
        id: "coming-soon-body",
        width: 120,
        border: true,
        borderStyle: "single",
        borderColor: "#475569",
        backgroundColor: "transparent",
        padding: 1,
        margin: 2,
    });

    body.add(Text({
        id: "coming-soon-description",
        content: description,
        attributes: TextAttributes.NONE,
        wrapMode: 'word',
    }));

    body.add(Text({
        id: "coming-soon-hint",
        content: "\nESC: Back",
        attributes: TextAttributes.DIM,
        wrapMode: 'word',
    }));

    container.add(body);

    return container;
}
