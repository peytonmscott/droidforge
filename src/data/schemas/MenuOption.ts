import type { SelectOption } from "@opentui/core";

// OpenTUI's SelectOption plus a `disabled` marker used for headers/spacers.
export type MenuOption = SelectOption & { disabled?: boolean };
