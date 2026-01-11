import { SelectRenderable, SelectRenderableEvents } from "@opentui/core";
import type { MenuOption } from "../../data/schemas";
import type { UiTheme } from "../theme";

export interface SelectMenuProps {
    id: string;
    height?: number | "auto" | `${number}%`;
    flexGrow?: number;
    options: MenuOption[];
    selectedIndex?: number;
    onSelect?: (index: number, option: MenuOption) => void;
    autoFocus?: boolean;
    showDescription?: boolean;
    itemSpacing?: number;
    theme?: UiTheme;
}

export function SelectMenu(renderer: any, props: SelectMenuProps): SelectRenderable {
    const select = new SelectRenderable(renderer, {
        id: props.id,
        height: props.height,
        flexGrow: props.flexGrow ?? (props.height ? undefined : 1),
        options: props.options,
        selectedIndex: props.selectedIndex ?? 0,
        backgroundColor: props.theme?.panelBackgroundColor ?? props.theme?.backgroundColor ?? "transparent",
        focusedBackgroundColor: props.theme?.panelBackgroundColor ?? props.theme?.backgroundColor ?? "transparent",
        selectedBackgroundColor: props.theme?.selectedBackgroundColor ?? "#1E3A5F",
        textColor: props.theme?.textColor ?? "#E2E8F0",
        focusedTextColor: props.theme?.textColor ?? "#E2E8F0",
        selectedTextColor: props.theme?.selectedTextColor ?? props.theme?.primaryColor ?? "#38BDF8",
        descriptionColor: props.theme?.descriptionColor ?? props.theme?.mutedTextColor ?? "#64748B",
        selectedDescriptionColor: props.theme?.selectedDescriptionColor ?? props.theme?.mutedTextColor ?? "#94A3B8",
        showScrollIndicator: true,
        wrapSelection: true,
        showDescription: props.showDescription ?? true,
        itemSpacing: props.itemSpacing,
    });

    if (props.onSelect) {
        select.on(SelectRenderableEvents.ITEM_SELECTED, props.onSelect);
    }

    if (props.autoFocus !== false) {
        select.focus();
    }

    return select;
}