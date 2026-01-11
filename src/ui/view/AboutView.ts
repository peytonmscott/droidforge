import { Text, BoxRenderable, ASCIIFont, TextAttributes } from "@opentui/core";
import { AboutViewModel } from '../../viewmodels';
import { Header } from '../components';
import type { UiTheme } from '../theme';

export function AboutView(renderer: any, viewModel: AboutViewModel, theme: UiTheme): BoxRenderable {
    const aboutContainer = new BoxRenderable(renderer, {
        id: "about-container",
        flexDirection: "column",
        flexGrow: 1,
        backgroundColor: theme.backgroundColor ?? "transparent",
    });

    // Header
    const header = Header(renderer, "Maker’s Mark", undefined, theme);
    aboutContainer.add(header);

    // Main content
    const contentBox = new BoxRenderable(renderer, {
        id: "about-content",
        alignItems: "center",
        justifyContent: "center",
        flexGrow: 1,
    });

    const infoBox = new BoxRenderable(renderer, {
        id: "info-box",
        flexDirection: "column",
        alignItems: "center",
        maxWidth: 60,
    });

    const info = viewModel.getAppInfo();
    infoBox.add(ASCIIFont({ font: "tiny", text: info.name, color: theme.primaryColor ?? theme.textColor, backgroundColor: theme.backgroundColor ?? 'transparent', selectable: false }));
    infoBox.add(Text({ content: `Version ${info.version}`, fg: theme.textColor, margin: 1 }));
    infoBox.add(Text({ content: info.description, fg: theme.textColor, margin: 1 }));
    infoBox.add(Text({ content: "", margin: 1 }));
    infoBox.add(Text({ content: info.builtWith, fg: theme.textColor, margin: 1 }));
    infoBox.add(Text({ content: info.tagline, fg: theme.textColor, margin: 1 }));
    infoBox.add(Text({ content: "", margin: 1 }));
    infoBox.add(Text({ content: "Features:", fg: theme.textColor, attributes: 1, margin: 1 })); // BOLD
    
    viewModel.getFeatures().forEach(feature => {
        infoBox.add(Text({ content: `• ${feature}`, fg: theme.textColor, margin: 1 }));
    });

    contentBox.add(infoBox);
    aboutContainer.add(contentBox);

    return aboutContainer;
}