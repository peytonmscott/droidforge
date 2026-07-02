import fs from 'fs';
import path from 'path';

import type { MenuOption } from '../data/schemas';
import type { AdbService } from '../adb';
import type { WorkspaceService } from '../workspace';

type PackageAction = 'uninstall' | 'clear-data' | 'force-stop';

const PACKAGE_ACTION_LABELS: Record<PackageAction, string> = {
    'uninstall': 'Uninstall',
    'clear-data': 'Clear data for',
    'force-stop': 'Force stop',
};

export class AdbActionsViewModel {
    private _devices: { serial: string; model: string }[] = [];
    private _selectedDevice: string | null = null;
    private _packages: string[] = [];
    private _loading = false;
    private _busy = false;
    private _error: string | null = null;
    private _message: string | null = null;
    private _pendingPackageAction: PackageAction | null = null;
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
            return [{ name: 'Loading...', description: '', value: '__loading__', disabled: true }];
        }

        if (this._error) {
            return [{ name: `Error: ${this._error}`, description: '', value: '__error__', disabled: true }];
        }

        if (this._devices.length === 0) {
            return [{ name: 'No devices connected', description: '', value: '__empty__', disabled: true }];
        }

        if (this._pendingPackageAction) {
            const label = PACKAGE_ACTION_LABELS[this._pendingPackageAction];
            const options: MenuOption[] = [
                { name: `── ${label} which package? ──`, description: '', value: '__header__', disabled: true },
            ];
            for (const pkg of this._packages) {
                options.push({ name: pkg, description: '', value: `pkg:${pkg}` });
            }
            if (this._packages.length === 0) {
                options.push({ name: 'No third-party packages found', description: '', value: '__empty__', disabled: true });
            }
            options.push({ name: '← Cancel', description: 'Back to actions', value: 'cancel-pick' });
            return options;
        }

        const options: MenuOption[] = [];

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
            options.push({ name: '── App Actions ──', description: '', value: '__header__', disabled: true });
            options.push({
                name: 'Install APK',
                description: 'Install the newest APK from the project build outputs',
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

            options.push({ name: '── Device Actions ──', description: '', value: '__header__', disabled: true });
            options.push({
                name: 'Take Screenshot',
                description: 'Save screenshot to device storage',
                value: 'screenshot',
            });
            options.push({
                name: 'Reboot Device',
                description: 'Restart the device',
                value: 'reboot',
            });
        }

        if (this._busy) {
            options.push({ name: '', description: '', value: '__spacer__', disabled: true });
            options.push({ name: '⏳ Running…', description: '', value: '__busy__', disabled: true });
        } else if (this._message) {
            options.push({ name: '', description: '', value: '__spacer__', disabled: true });
            options.push({ name: this._message, description: '', value: '__message__', disabled: true });
        }

        return options;
    }

    async handleMenuSelection(value: string): Promise<{ action: string }> {
        if (this._busy) {
            return { action: 'none' };
        }

        if (value.startsWith('select-device:')) {
            const serial = value.slice('select-device:'.length);
            await this.selectDevice(serial);
            return { action: 'device-selected' };
        }

        if (value === 'cancel-pick') {
            this._pendingPackageAction = null;
            this.notifyUpdate();
            return { action: 'none' };
        }

        if (value.startsWith('pkg:')) {
            const pkg = value.slice('pkg:'.length);
            await this.runPackageAction(pkg);
            return { action: 'executed' };
        }

        if (!this._selectedDevice) {
            return { action: 'no-device' };
        }

        switch (value) {
            case 'install-apk':
                await this.installProjectApk();
                return { action: 'executed' };
            case 'uninstall-package':
            case 'clear-data':
            case 'force-stop': {
                this._pendingPackageAction = value === 'uninstall-package' ? 'uninstall' : value;
                this._message = null;
                if (this._packages.length === 0) {
                    await this.loadPackages();
                }
                this.notifyUpdate();
                return { action: 'pick-package' };
            }
            case 'screenshot': {
                await this.run(async (serial) => {
                    const result = await this._adb.takeScreenshot(serial);
                    return result.success
                        ? `✓ Screenshot saved to ${result.devicePath}`
                        : `✗ Screenshot failed: ${result.stderr.trim() || result.stdout.trim()}`;
                });
                return { action: 'executed' };
            }
            case 'reboot': {
                await this.run(async (serial) => {
                    const result = await this._adb.rebootDevice(serial);
                    return result.success
                        ? '✓ Device is rebooting'
                        : `✗ Reboot failed: ${result.stderr.trim() || result.stdout.trim()}`;
                });
                return { action: 'executed' };
            }
            default:
                return { action: 'none' };
        }
    }

    private async run(task: (serial: string) => Promise<string>): Promise<void> {
        const serial = this._selectedDevice;
        if (!serial) return;

        this._busy = true;
        this._message = null;
        this.notifyUpdate();

        try {
            this._message = await task(serial);
        } catch (err) {
            this._message = `✗ ${err instanceof Error ? err.message : String(err)}`;
        }

        this._busy = false;
        this.notifyUpdate();
    }

    private async runPackageAction(pkg: string): Promise<void> {
        const action = this._pendingPackageAction;
        this._pendingPackageAction = null;
        if (!action) return;

        await this.run(async (serial) => {
            const result =
                action === 'uninstall' ? await this._adb.uninstallPackage(serial, pkg)
                : action === 'clear-data' ? await this._adb.clearAppData(serial, pkg)
                : await this._adb.forceStop(serial, pkg);

            const verb = PACKAGE_ACTION_LABELS[action].toLowerCase();
            if (!result.success) {
                return `✗ Failed to ${verb} ${pkg}: ${result.stderr.trim() || result.stdout.trim()}`;
            }
            if (action === 'uninstall') {
                this._packages = this._packages.filter(p => p !== pkg);
            }
            return `✓ ${PACKAGE_ACTION_LABELS[action]} ${pkg}: done`;
        });
    }

    private async installProjectApk(): Promise<void> {
        await this.run(async (serial) => {
            const apk = this.findNewestApk(this._workspace.getCwd());
            if (!apk) {
                return '✗ No APK found under build/outputs — run a Gradle build first';
            }
            const result = await this._adb.installApk(serial, apk);
            return result.success
                ? `✓ Installed ${path.basename(apk)}`
                : `✗ Install failed: ${result.stderr.trim() || result.stdout.trim()}`;
        });
    }

    private findNewestApk(root: string): string | null {
        const results: { file: string; mtime: number }[] = [];

        const visit = (dir: string, depth: number): void => {
            if (depth > 6) return;
            let entries: fs.Dirent[];
            try {
                entries = fs.readdirSync(dir, { withFileTypes: true });
            } catch {
                return;
            }
            for (const entry of entries) {
                if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    visit(fullPath, depth + 1);
                } else if (entry.name.endsWith('.apk') && fullPath.includes(`${path.sep}build${path.sep}outputs${path.sep}`)) {
                    try {
                        results.push({ file: fullPath, mtime: fs.statSync(fullPath).mtimeMs });
                    } catch {
                        // ignore
                    }
                }
            }
        };

        visit(root, 0);
        results.sort((a, b) => b.mtime - a.mtime);
        return results[0]?.file ?? null;
    }
}
