import type { MenuOption } from '../data/schemas';
import type { AdbService, EmulatorService, AdbDevice, AvdInfo } from '../adb';

export class DevicesViewModel {
    private _devices: AdbDevice[] = [];
    private _avds: AvdInfo[] = [];
    private _loading = true;
    private _error: string | null = null;
    private _onMenuUpdate: (() => void) | null = null;

    constructor(
        private readonly _adb: AdbService,
        private readonly _emulator: EmulatorService
    ) {
        void this.refresh();
    }

    setMenuUpdateCallback(callback: () => void): void {
        this._onMenuUpdate = callback;
        this._onMenuUpdate?.();
    }

    get isLoading(): boolean {
        return this._loading;
    }

    getError(): string | null {
        return this._error;
    }

    async refresh(): Promise<void> {
        this._loading = true;
        this._error = null;
        this._onMenuUpdate?.();

        try {
            if (!this._adb.isAvailable()) {
                this._error = 'ADB not found. Install Android SDK platform-tools.';
                this._devices = [];
                this._avds = [];
            } else {
                this._devices = await this._adb.listDevices();
                this._avds = await this._emulator.listAvds();
            }
        } catch (err) {
            this._error = err instanceof Error ? err.message : 'Failed to load devices';
        }

        this._loading = false;
        this._onMenuUpdate?.();
    }

    async startEmulator(avdName: string): Promise<string> {
        await this._emulator.startEmulator(avdName);
        await new Promise(r => setTimeout(r, 2000));
        await this.refresh();
        const running = this._avds.find(a => a.name === avdName && a.isRunning);
        return running?.serial ?? '';
    }

    async stopEmulator(serial: string): Promise<void> {
        await this._emulator.stopEmulator(serial);
        await this.refresh();
    }

    getDevices(): AdbDevice[] {
        return this._devices;
    }

    getAvds(): AvdInfo[] {
        return this._avds;
    }

    getMenuOptions(): MenuOption[] {
        if (this._loading) {
            return [{ name: 'Loading...', value: '__loading__', disabled: true }];
        }

        if (this._error) {
            return [{ name: `Error: ${this._error}`, value: '__error__', disabled: true }];
        }

        const options: MenuOption[] = [];

        if (this._devices.length > 0) {
            options.push({ name: '── Connected Devices ──', value: '__header__', disabled: true });
            for (const device of this._devices) {
                const statusIcon = device.status === 'device' ? '●' : '○';
                const typeLabel = device.type === 'emulator' ? 'emulator' : 'device';
                options.push({
                    name: `${statusIcon} ${device.model || device.serial}`,
                    description: `${device.status} | ${typeLabel}`,
                    value: `device:${device.serial}`,
                });
            }
        }

        if (this._avds.length > 0) {
            options.push({ name: '── Available Emulators ──', value: '__header__', disabled: true });
            for (const avd of this._avds) {
                const statusIcon = avd.isRunning ? '●' : '○';
                const statusText = avd.isRunning ? `Running (${avd.serial})` : 'Stopped';
                options.push({
                    name: `${statusIcon} ${avd.name}`,
                    description: statusText,
                    value: avd.isRunning ? `stop-emulator:${avd.serial}` : `start-emulator:${avd.name}`,
                });
            }
        }

        if (options.length === 0) {
            options.push({ name: 'No devices or emulators found', value: '__empty__', disabled: true });
        }

        options.push({ name: '── Actions ──', value: '__header__', disabled: true });
        options.push({ name: 'Refresh', description: 'Reload device list', value: 'refresh' });

        return options;
    }

    async handleMenuSelection(value: string): Promise<{ action: string; data?: string }> {
        if (value === 'refresh') {
            await this.refresh();
            return { action: 'refreshed' };
        }
        if (value.startsWith('start-emulator:')) {
            const avdName = value.slice('start-emulator:'.length);
            const serial = await this.startEmulator(avdName);
            return { action: 'emulator-started', data: serial };
        }
        if (value.startsWith('stop-emulator:')) {
            const serial = value.slice('stop-emulator:'.length);
            await this.stopEmulator(serial);
            return { action: 'emulator-stopped' };
        }
        if (value.startsWith('device:')) {
            const serial = value.slice('device:'.length);
            return { action: 'device-selected', data: serial };
        }
        return { action: 'none' };
    }
}
