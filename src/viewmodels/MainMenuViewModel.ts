import type { MenuOption } from '../data/schemas';

export class MainMenuViewModel {
    private menuOptions: MenuOption[] = [
        {
            name: "Actions",
            description: "will write something creative later",
            value: "actions"
        },
        {
            name: "Projects",
            description: "Manage and create new projects with interactive tools",
            value: "projects"
        },
        {
            name: "Gradle",
            description: "Development utilities and code generators",
            value: "tools"
        },
        {
            name: "Settings",
            description: "Configure application preferences and options",
            value: "settings"
        },
        {
            name: "About",
            description: "Learn about Droid Forge and get help",
            value: "about"
        }
    ];

    getMenuOptions(): MenuOption[] {
        return [...this.menuOptions];
    }

    onMenuItemSelected(index: number, option: MenuOption): string {
        return option.value as string;
    }
}
