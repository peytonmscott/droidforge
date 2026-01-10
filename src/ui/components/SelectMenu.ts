import { SelectRenderable, SelectRenderableEvents } from "@opentui/core";
import type { MenuOption } from "../../data/schemas";

export interface SelectMenuProps {
    id: string;
    height?: number;
    options: MenuOption[];
    selectedIndex?: number;
    onSelect?: (index: number, option: MenuOption) => void;
    autoFocus?: boolean;
}

export function SelectMenu(renderer: any, props: SelectMenuProps): SelectRenderable {
    const select = new SelectRenderable(renderer, {
        id: props.id,
        height: props.height || 12,
        options: props.options,
        selectedIndex: props.selectedIndex ?? 0,
        backgroundColor: "transparent",
        focusedBackgroundColor: "transparent",
        selectedBackgroundColor: "#1E3A5F",
        textColor: "#E2E8F0",
        selectedTextColor: "#38BDF8",
        descriptionColor: "#64748B",
        selectedDescriptionColor: "#94A3B8",
        showScrollIndicator: true,
        wrapSelection: true,
        showDescription: true,
    });

    if (props.onSelect) {
        select.on(SelectRenderableEvents.ITEM_SELECTED, props.onSelect);
    }

    if (props.autoFocus !== false) {
        select.focus();
    }

    return select;
}