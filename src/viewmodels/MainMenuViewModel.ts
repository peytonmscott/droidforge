import type { MenuOption } from '../data/schemas';

export type RootMenuMode = 'forge' | 'anvil';

export class MainMenuViewModel {
    private forgeMenuOptions: MenuOption[] = [
        {
            name: 'Project Ledger',
            description: 'Find, open, and switch Android projects',
            value: 'projects',
        },
        {
            name: 'Smithy (Devices)',
            description: 'Manage emulators and connected devices',
            value: 'devices',
        },
        {
            name: 'Command Tongs (ADB)',
            description: 'Quick ADB actions without the finger burns',
            value: 'adb',
        },
        {
            name: 'Maker’s Mark',
            description: 'About Droidforge, version, links',
            value: 'about',
        },
    ];

    private anvilMenuOptions: MenuOption[] = [
        {
            name: 'Strike (Run)',
            description: 'Build → install → launch → open Logcat',
            value: 'actionoutputview:installDebug',
        },
        {
            name: 'Temper (Build)',
            description: 'Build the project without deploying',
            value: 'actionoutputview:assembleDebug',
        },
        {
            name: 'Kiln View (App Logs)',
            description: 'App-focused Logcat (package/PID filtered)',
            value: 'kiln-view',
        },
        {
            name: 'Foundry Logs (Device Logs)',
            description: 'Full device Logcat with filters',
            value: 'foundry-logs',
        },
        {
            name: 'Looking Glass (Mirror)',
            description: 'Mirror a physical device display',
            value: 'looking-glass',
        },
        {
            name: 'Hammer List (Pinned Tasks)',
            description: 'Your most-used Gradle tasks',
            value: 'hammer-list',
        },
        {
            name: 'Blueprints (All Tasks)',
            description: 'Browse/search every Gradle task in the project',
            value: 'blueprints',
        },
    ];

    getMenuOptions(mode: RootMenuMode): MenuOption[] {
        return mode === 'anvil' ? [...this.anvilMenuOptions] : [...this.forgeMenuOptions];
    }

    onMenuItemSelected(_index: number, option: MenuOption): string {
        return option.value as string;
    }
}
