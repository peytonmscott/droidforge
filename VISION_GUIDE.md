# Droidforge Vision Guide

A reference for maintaining the "heart and feel" of the project during refactoring.

---

## 1. Core Identity

- **Neovim Companion Philosophy**: Droidforge handles builds, devices, and logs while Neovim handles editing. Never bloat into an IDE.
- **Keyboard-First Navigation**: Arrow keys + Enter + Escape. Footer always shows context-specific shortcuts. No mouse required.
- **Two Modes, One Feel**: "Forge" mode for general tools (project switching, settings); "Anvil" mode when an Android project is detected (Gradle tasks, device work). Same UI, different context.
- **Professional Minimalism**: Clean panels, purposeful whitespace, no visual clutter. Theme support (33+ built-in) but always refined, never garish.
- **Fast Dashboard**: Launch, do one thing, leave. Not a place to linger—get in, build/run/check, get back to coding.

---

## 2. Visual Patterns

### Layout Structure
```
Container (centered, flexGrow: 1)
├── Header (MainHeader with ASCII art OR Header with bold text)
├── Spacer (height: 1)
├── Panel (bordered, 85% width, 40-96 char range)
│   └── SelectMenu (auto-height, itemSpacing: 1)
└── Footer (bottom, contextual help)
```

### Key Measurements
- Panel width: `85%` with min 40, max 96 characters
- Panel margin: 2 (reduces to 1 in compact mode < 70 chars)
- Menu item spacing: 1 (reduces to 0.5 in compact mode)
- Header margin: MainHeader has `marginBottom: 2`, regular Header has `marginBottom: 1, marginLeft: 4`

### Header Types
- **MainHeader**: ASCII art title (tiny font) + dimmed subtitle. Used for main menus (The Anvil, Forge).
- **Header**: Bold text title + dimmed subtitle. Used for sub-views (Project Ledger, Gradle Tasks).

### Panel Styling
- Single border style
- Border color from theme (`borderColor`)
- Background from theme (`panelBackgroundColor` or transparent)
- No title on menu panels (title is in header above)

### Footer
- Height: 2 lines
- Styled with `footerBackgroundColor`, `footerBorderColor`, `footerTextColor`
- Shows context-specific keybindings and status

---

## 3. Naming Conventions

### Not "Blacksmith" — "Craft Workshop"
The naming evokes a craftsman's workshop, not fantasy blacksmithing. It's about tools and craftsmanship:

| Category | Pattern | Examples |
|----------|---------|----------|
| Projects | Registry/Record | "Project Ledger" |
| Actions | Verbs (the work) | "Strike (Run)", "Temper (Build)" |
| Logs | Heat/Places | "Kiln View", "Foundry Logs" |
| Tools | Objects | "Hammer List", "Blueprints", "Looking Glass" |
| Meta | Maker's identity | "Maker's Mark" (About) |
| Devices | Workshop place | "Smithy" |
| ADB | Tool | "Command Tongs" |

### Mode Names
- **Forge Mode**: General tools, project switching, settings. The "workshop" itself.
- **Anvil Mode**: Project-specific heavy work. Where the actual building happens.

### Value Naming (for navigation)
- Use lowercase kebab-case for internal values: `actionoutputview:installDebug`, `kiln-view`, `foundry-logs`
- Use PascalCase for view class names: `GradleView`, `ProjectsView`

---

## 4. UI Patterns to Replicate

### View Function Signature
```typescript
export function SomeView(
    renderer: CliRendererLike,
    viewModel: SomeViewModel,
    theme: UiTheme,
    onNavigate?: (action: string) => void,
    // ... other callbacks
): BoxRenderable
```

### ViewModel Pattern
```typescript
export class SomeViewModel {
    private menuOptions: MenuOption[] = [...];
    
    getMenuOptions(): MenuOption[] { return [...this.menuOptions]; }
    onMenuItemSelected(index: number, option: MenuOption): string { ... }
}
```

### SelectMenu Usage
```typescript
const selectMenu = SelectMenu(renderer, {
    id: "unique-id",
    options: viewModel.getMenuOptions(),
    autoFocus: true,
    theme,
    itemSpacing: 1,
    onSelect: (index, option) => { ... }
});

wireCompactMenuLayout(selectContainer, selectMenu);
```

### Container Structure
```typescript
const container = new BoxRenderable(renderer, {
    id: "container-id",
    alignItems: "center",
    justifyContent: "center",
    flexGrow: 1,
    backgroundColor: theme.backgroundColor ?? "transparent",
});
```

### Theme Color Usage
- `primaryColor` - Selected text, titles, emphasis
- `mutedTextColor` / `descriptionColor` - Subtitles, descriptions, dimmed text
- `selectedBackgroundColor` - Active menu item background
- `borderColor` / `borderActiveColor` - Panel borders
- `footerBackgroundColor` - Footer bar

---

## 5. Red Flags to Fix

### Current Issues

1. **Inconsistent Header Usage**: `GradleView` uses `MainHeader` but other sub-views use `Header`. Sub-views should use regular `Header` (bold text, not ASCII art).

2. **Missing Compact Layout**: Some views don't use `wireCompactMenuLayout` - all menu-based views should have responsive behavior.

3. **Hardcoded Fallback Colors**: `Theme.ts:203-223` has hardcoded fallback colors. Consider using theme tokens throughout or make fallback theme configurable.

4. **SettingsView is a Wrapper**: `SettingsView` just delegates to `ThemePickerView`. Either rename or make it a proper settings hub.

5. **Inconsistent Footer Handling**: Some views manage footer via `onStatusText` callback, others don't. Standardize footer communication.

### Code Quality Notes

- Views should NOT contain business logic - delegate to ViewModels
- All theme access should go through `UiTheme` interface, never hardcode colors
- Keep the separation: View renders, ViewModel computes, Service executes

---

## 6. Implementation Checklist

When creating new views or refactoring:

- [ ] Use the standard container → header → spacer → panel → selectMenu structure
- [ ] Pass theme through all components
- [ ] Use `wireCompactMenuLayout` for responsive menus
- [ ] Name menu items with the workshop/craft convention
- [ ] Ensure keyboard navigation works (autoFocus on SelectMenu)
- [ ] Provide footer context text
- [ ] Keep view functions pure (no side effects, return BoxRenderable)
- [ ] Put logic in ViewModel, rendering in View
