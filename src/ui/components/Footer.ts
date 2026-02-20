import { Text, BoxRenderable } from "@opentui/core";
import type { CliRendererLike } from "../../utilities/rendererTypes";
import type { UiTheme } from "../theme";
import { LAYOUT } from "../constants";

export function Footer(renderer: CliRendererLike, content: string, theme?: UiTheme): BoxRenderable {
    const footerBox = new BoxRenderable(renderer, {
        id: "footer-box",
        height: LAYOUT.FOOTER_HEIGHT,
        width: "100%",
        alignSelf: "stretch",
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
            wrapMode: "word",
        }),
    );

    return footerBox;
}
