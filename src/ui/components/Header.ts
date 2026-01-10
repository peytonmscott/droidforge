import { ASCIIFont, Text, TextAttributes, BoxRenderable } from "@opentui/core";

export function MainHeader(renderer: any, title: string, subtitle?: string): BoxRenderable {
    const headerBox = new BoxRenderable(renderer, {
        id: "main-header-box",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 2,
    });

    const asciiElement = ASCIIFont({ font: "tiny", text: title });
    headerBox.add(asciiElement);

    if (subtitle) {
        const textElement = Text({ content: subtitle, attributes: TextAttributes.DIM });
        headerBox.add(textElement);
    }

    return headerBox;
}

export function Header(renderer: any, title: string, subtitle?: string): BoxRenderable {
    const headerBox = new BoxRenderable(renderer, {
        id: "header-box",
        justifyContent: "center",
        alignItems: "flex-start",
        marginLeft: 4,
        marginBottom: 1,
    });

    const titleText = Text({ content: title, attributes: TextAttributes.BOLD });
    headerBox.add(titleText);

    if (subtitle) {
        const subtitleText = Text({ content: subtitle, attributes: TextAttributes.NONE });
        headerBox.add(subtitleText);
    }

    return headerBox;
}
