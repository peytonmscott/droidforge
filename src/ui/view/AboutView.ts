import { Text, BoxRenderable, ASCIIFont, TextAttributes } from "@opentui/core";
import { AboutViewModel } from '../../viewmodels';
import { Header, Footer } from '../components';

export function AboutView(renderer: any, viewModel: AboutViewModel): BoxRenderable {
    const aboutContainer = new BoxRenderable(renderer, {
        id: "about-container",
        flexDirection: "column",
        flexGrow: 1,
    });

    // Header
    const header = Header(renderer, "ℹ️ About - Droid Forge");
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
    infoBox.add(ASCIIFont({ font: "tiny", text: info.name }));
    infoBox.add(Text({ content: `Version ${info.version}`, margin: 1 }));
    infoBox.add(Text({ content: info.description, margin: 1 }));
    infoBox.add(Text({ content: "", margin: 1 }));
    infoBox.add(Text({ content: info.builtWith, margin: 1 }));
    infoBox.add(Text({ content: info.tagline, margin: 1 }));
    infoBox.add(Text({ content: "", margin: 1 }));
    infoBox.add(Text({ content: "Features:", attributes: 1, margin: 1 })); // BOLD
    
    viewModel.getFeatures().forEach(feature => {
        infoBox.add(Text({ content: `• ${feature}`, margin: 1 }));
    });

    contentBox.add(infoBox);
    aboutContainer.add(contentBox);

    // Footer
    const footer = Footer(renderer, "ESC: Back to Menu | Visit opentui.com for more info");
    aboutContainer.add(footer);

    return aboutContainer;
}