import { Text, BoxRenderable } from "@opentui/core";
import type { UiTheme } from "../theme";

export function Footer(renderer: any, content: string, theme?: UiTheme): BoxRenderable {
    const footerBox = new BoxRenderable(renderer, {
        id: "footer-box",
        height: 2,
        backgroundColor: theme?.footerBackgroundColor ?? theme?.secondaryColor ?? "#1e40af",
        border: true,
        borderStyle: "single",
        borderColor: theme?.footerBorderColor ?? theme?.primaryColor ?? "#1d4ed8",
    });

    footerBox.add(
        Text({
            content,
            fg: theme?.footerTextColor ?? theme?.textColor ?? "#dbeafe",
            margin: 1,
        }),
    );

    return footerBox;
}
