import type { MenuOption } from '../data/schemas';

export type RootMenuMode = 'forge' | 'anvil';

export class MainMenuViewModel {
    private forgeMenuOptions: MenuOption[] = [
        {
            name: 'Projects',
            description: 'Find, open, and switch Android projects',
            value: 'projects',
        },
        {
            name: 'Devices',
            description: 'Manage emulators and connected devices',
            value: 'devices',
        },
        {
            name: 'ADB Actions',
            description: 'Quick ADB commands for device management',
            value: 'adb',
        },
        {
            name: 'About',
            description: 'Version, credits, and links',
            value: 'about',
        },
    ];

    private anvilMenuOptions: MenuOption[] = [
        {
            name: 'Run App',
            description: 'Build, install, launch, and show logs',
            value: 'actionoutputview:installDebug',
        },
        {
            name: 'Build',
            description: 'Build the project without deploying',
            value: 'actionoutputview:assembleDebug',
        },
        {
            name: 'App Logs',
            description: 'App-focused Logcat (package/PID filtered)',
            value: 'app-logs',
        },
        {
            name: 'Device Logs',
            description: 'Full device Logcat with filters',
            value: 'device-logs',
        },
        {
            name: 'Screen Mirror',
            description: 'Mirror a device display via scrcpy',
            value: 'screen-mirror',
        },
    ];

    getMenuOptions(mode: RootMenuMode): MenuOption[] {
        return mode === 'anvil' ? [...this.anvilMenuOptions] : [...this.forgeMenuOptions];
    }

    onMenuItemSelected(_index: number, option: MenuOption): string {
        return option.value as string;
    }
}
