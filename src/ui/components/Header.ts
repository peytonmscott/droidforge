import { ASCIIFont, BoxRenderable, Text, TextAttributes } from "@opentui/core";
import type { UiTheme } from "../theme";

export function MainHeader(
    renderer: any,
    title: string,
    subtitle?: string,
    theme?: UiTheme,
): BoxRenderable {
    const headerBox = new BoxRenderable(renderer, {
        id: "main-header-box",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 2,
        backgroundColor: theme?.backgroundColor ?? "transparent",
    });

    const asciiElement = ASCIIFont({
        font: "tiny",
        text: title,
        color: theme?.primaryColor ?? theme?.textColor ?? "#FFFFFF",
        backgroundColor: theme?.backgroundColor ?? "transparent",
        selectable: false,
    });
    headerBox.add(asciiElement);

    if (subtitle) {
        const textElement = Text({
            content: subtitle,
            attributes: TextAttributes.DIM,
            fg: theme?.mutedTextColor ?? theme?.textColor,
        });
        headerBox.add(textElement);
    }

    return headerBox;
}

export function Header(
    renderer: any,
    title: string,
    subtitle?: string,
    theme?: UiTheme,
): BoxRenderable {
    const headerBox = new BoxRenderable(renderer, {
        id: "header-box",
        justifyContent: "center",
        alignItems: "flex-start",
        marginLeft: 4,
        marginBottom: 1,
        backgroundColor: theme?.backgroundColor ?? "transparent",
    });

    const titleText = Text({
        content: title,
        attributes: TextAttributes.BOLD,
        fg: theme?.textColor,
    });
    headerBox.add(titleText);

    if (subtitle) {
        const subtitleText = Text({
            content: subtitle,
            attributes: TextAttributes.NONE,
            fg: theme?.mutedTextColor ?? theme?.textColor,
        });
        headerBox.add(subtitleText);
    }

    return headerBox;
}
