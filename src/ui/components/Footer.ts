import { Text, BoxRenderable } from "@opentui/core";

export function Footer(renderer: any, content: string, theme?: any): BoxRenderable {
    const footerBox = new BoxRenderable(renderer, {
        id: "footer-box",
        height: 2,
        backgroundColor: theme?.secondaryColor || "#1e40af",
        border: true,
        borderStyle: "single",
        borderColor: theme?.primaryColor || "#1d4ed8"
    });
    
    footerBox.add(Text({ 
        content, 
        fg: "#dbeafe", 
        margin: 1 
    }));

    return footerBox;
}