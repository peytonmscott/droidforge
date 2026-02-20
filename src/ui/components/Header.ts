import { ASCIIFont, BoxRenderable, Text, TextAttributes } from "@opentui/core";
import type { CliRendererLike } from "../../utilities/rendererTypes";
import type { UiTheme } from "../theme";
import { LAYOUT } from "../constants";

export function MainHeader(
    renderer: CliRendererLike,
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
    renderer: CliRendererLike,
    title: string,
    subtitle?: string,
    theme?: UiTheme,
): BoxRenderable {
    const headerBox = new BoxRenderable(renderer, {
        id: "header-box",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "flex-start",
        marginLeft: LAYOUT.HEADER_MARGIN_LEFT,
        marginBottom: LAYOUT.HEADER_MARGIN_BOTTOM,
        backgroundColor: theme?.backgroundColor ?? "transparent",
    });

    const titleText = Text({
        content: title,
        attributes: TextAttributes.BOLD,
        fg: theme?.primaryColor ?? theme?.textColor,
    });
    headerBox.add(titleText);

    if (subtitle) {
        const subtitleText = Text({
            content: subtitle,
            attributes: TextAttributes.DIM,
            fg: theme?.mutedTextColor ?? theme?.textColor,
        });
        headerBox.add(subtitleText);
    }

    return headerBox;
}
