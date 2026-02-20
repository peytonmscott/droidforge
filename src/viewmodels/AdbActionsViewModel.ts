import type { MenuOption } from '../data/schemas';
import type { AdbService } from '../adb';
import type { WorkspaceService } from '../workspace';

export class AdbActionsViewModel {
    private _devices: { serial: string; model: string }[] = [];
    private _selectedDevice: string | null = null;
    private _packages: string[] = [];
    private _loading = false;
    private _error: string | null = null;
    private _onMenuUpdate: (() => void) | null = null;

    constructor(
        private readonly _adb: AdbService,
        private readonly _workspace: WorkspaceService
    ) {
        void this.loadDevices();
    }

    setMenuUpdateCallback(callback: () => void): void {
        this._onMenuUpdate = callback;
    }

    private notifyUpdate(): void {
        this._onMenuUpdate?.();
    }

    getSelectedDevice(): string | null {
        return this._selectedDevice;
    }

    async loadDevices(): Promise<void> {
        if (!this._adb.isAvailable()) {
            this._error = 'ADB not found';
            this.notifyUpdate();
            return;
        }

        this._loading = true;
        this.notifyUpdate();

        try {
            const devices = await this._adb.listDevices();
            this._devices = devices
                .filter(d => d.status === 'device')
                .map(d => ({ serial: d.serial, model: d.model ?? d.serial }));
            
            if (this._devices.length === 1 && this._devices[0]) {
                this._selectedDevice = this._devices[0].serial;
                await this.loadPackages();
            }
        } catch (err) {
            this._error = err instanceof Error ? err.message : 'Failed to load devices';
        }

        this._loading = false;
        this.notifyUpdate();
    }

    async selectDevice(serial: string): Promise<void> {
        this._selectedDevice = serial;
        await this.loadPackages();
    }

    private async loadPackages(): Promise<void> {
        if (!this._selectedDevice) return;
        try {
            this._packages = await this._adb.listPackages(this._selectedDevice, true);
        } catch {
            this._packages = [];
        }
        this.notifyUpdate();
    }

    getPackages(): string[] {
        return this._packages;
    }

    getMenuOptions(): MenuOption[] {
        if (this._loading) {
            return [{ name: 'Loading...', value: '__loading__', disabled: true }];
        }

        if (this._error) {
            return [{ name: `Error: ${this._error}`, value: '__error__', disabled: true }];
        }

        const options: MenuOption[] = [];

        if (this._devices.length === 0) {
            return [{ name: 'No devices connected', value: '__empty__', disabled: true }];
        }

        if (this._devices.length > 1) {
            options.push({ name: '── Select Device ──', value: '__header__', disabled: true });
            for (const device of this._devices) {
                const selected = device.serial === this._selectedDevice ? '● ' : '○ ';
                options.push({
                    name: `${selected}${device.model}`,
                    description: device.serial,
                    value: `select-device:${device.serial}`,
                });
            }
            options.push({ name: '', value: '__spacer__', disabled: true });
        }

        if (this._selectedDevice) {
            options.push({ name: '── App Actions ──', value: '__header__', disabled: true });
            
            const projectPath = this._workspace.getCwd();
            const hasApk = projectPath;
            
            options.push({
                name: 'Install APK',
                description: hasApk ? 'Install from project build' : 'Install APK file',
                value: 'install-apk',
            });
            options.push({
                name: 'Uninstall Package',
                description: 'Remove an installed app',
                value: 'uninstall-package',
            });
            options.push({
                name: 'Clear App Data',
                description: 'Clear data and cache',
                value: 'clear-data',
            });
            options.push({
                name: 'Force Stop App',
                description: 'Kill a running app',
                value: 'force-stop',
            });

            options.push({ name: '── Device Actions ──', value: '__header__', disabled: true });
            options.push({
                name: 'Take Screenshot',
                description: 'Save screenshot to device',
                value: 'screenshot',
            });
            options.push({
                name: 'Reboot Device',
                description: 'Restart the device',
                value: 'reboot',
            });
        }

        return options;
    }

    async handleMenuSelection(value: string): Promise<{ action: string; command?: string }> {
        if (value.startsWith('select-device:')) {
            const serial = value.slice('select-device:'.length);
            await this.selectDevice(serial);
            return { action: 'device-selected' };
        }

        if (!this._selectedDevice) {
            return { action: 'no-device' };
        }

        switch (value) {
            case 'install-apk':
                return { action: 'navigate', command: `adb-install:${this._selectedDevice}` };
            case 'uninstall-package':
                return { action: 'navigate', command: `adb-uninstall:${this._selectedDevice}` };
            case 'clear-data':
                return { action: 'navigate', command: `adb-clear:${this._selectedDevice}` };
            case 'force-stop':
                return { action: 'navigate', command: `adb-forcestop:${this._selectedDevice}` };
            case 'screenshot':
                return { action: 'navigate', command: `adb-screenshot:${this._selectedDevice}` };
            case 'reboot':
                return { action: 'navigate', command: `adb-reboot:${this._selectedDevice}` };
            default:
                return { action: 'none' };
        }
    }
}
