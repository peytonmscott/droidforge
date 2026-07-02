import type { AdbService } from '../adb';

export class MirrorViewModel {
    private _devices: { serial: string; model: string }[] = [];
    private _selectedDevice: string | null = null;
    private _scrcpyPath: string | null = null;
    private _loading = false;
    private _error: string | null = null;
    private _message: string | null = null;
    private _onMenuUpdate: (() => void) | null = null;

    constructor(private readonly _adb: AdbService) {
        this._scrcpyPath = Bun.which('scrcpy');
        void this.loadDevices();
    }

    setMenuUpdateCallback(callback: () => void): void {
        this._onMenuUpdate = callback;
    }

    private notifyUpdate(): void {
        this._onMenuUpdate?.();
    }

    hasScrcpy(): boolean {
        return this._scrcpyPath !== null;
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
                .map(d => ({ serial: d.serial, model: d.model || d.serial }));
            
            if (this._devices.length === 1 && this._devices[0]) {
                this._selectedDevice = this._devices[0].serial;
            }
        } catch (err) {
            this._error = err instanceof Error ? err.message : 'Failed to load devices';
        }

        this._loading = false;
        this.notifyUpdate();
    }

    getDevices(): { serial: string; model: string }[] {
        return this._devices;
    }

    getSelectedDevice(): string | null {
        return this._selectedDevice;
    }

    getMessage(): string | null {
        return this._message;
    }

    selectDevice(serial: string): void {
        this._selectedDevice = serial;
        this.notifyUpdate();
    }

    getMenuOptions(): any[] {
        if (this._loading) {
            return [{ name: 'Loading...', description: '', value: '__loading__', disabled: true }];
        }

        if (!this.hasScrcpy()) {
            return [
                { name: 'scrcpy not found', description: 'Install: brew install scrcpy', value: '__error__', disabled: true },
            ];
        }

        if (this._error) {
            return [{ name: `Error: ${this._error}`, description: '', value: '__error__', disabled: true }];
        }

        const options: any[] = [];

        if (this._devices.length === 0) {
            return [{ name: 'No devices connected', description: '', value: '__empty__', disabled: true }];
        }

        if (this._devices.length > 1) {
            options.push({ name: '── Select Device ──', description: '', value: '__header__', disabled: true });
            for (const device of this._devices) {
                const selected = device.serial === this._selectedDevice ? '● ' : '○ ';
                options.push({
                    name: `${selected}${device.model}`,
                    description: device.serial,
                    value: `select-device:${device.serial}`,
                });
            }
            options.push({ name: '', description: '', value: '__spacer__', disabled: true });
        }

        if (this._selectedDevice) {
            options.push({
                name: 'Start Mirroring',
                description: 'Launch scrcpy to mirror device screen',
                value: 'start-mirror',
            });
        }

        if (this._message) {
            options.push({ name: '', description: '', value: '__spacer__', disabled: true });
            options.push({ name: this._message, description: '', value: '__message__', disabled: true });
        }

        return options;
    }

    handleMenuSelection(value: string): { action: string } {
        if (value.startsWith('select-device:')) {
            const serial = value.slice('select-device:'.length);
            this.selectDevice(serial);
            return { action: 'device-selected' };
        }

        if (value === 'start-mirror' && this._selectedDevice && this._scrcpyPath) {
            Bun.spawn([this._scrcpyPath, '--serial', this._selectedDevice, '--no-audio'], {
                stdio: ['ignore', 'ignore', 'ignore'],
            });
            this._message = 'Mirroring started in separate window';
            this.notifyUpdate();
            return { action: 'mirroring-started' };
        }

        return { action: 'none' };
    }
}
