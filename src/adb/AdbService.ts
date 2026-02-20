import type { Subprocess } from 'bun';
import type { AdbDevice, DeviceMetadata, AdbCommandResult } from './types';
import { parseDevicesOutput, parseGetpropOutput } from './parsers';

export class AdbService {
    private _adbPath: string | null = null;
    private _emulatorPath: string | null = null;

    constructor() {
        this.detectPaths();
    }

    private detectPaths(): void {
        this._adbPath = Bun.which('adb');
        const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
        if (androidHome) {
            this._emulatorPath = `${androidHome}/emulator/emulator`;
        } else {
            this._emulatorPath = Bun.which('emulator');
        }
    }

    isAvailable(): boolean {
        return this._adbPath !== null;
    }

    getEmulatorPath(): string | null {
        return this._emulatorPath;
    }

    async listDevices(): Promise<AdbDevice[]> {
        if (!this._adbPath) return [];
        const output = await this.runCommand(['devices', '-l']);
        return parseDevicesOutput(output);
    }

    async getDeviceProperties(serial: string): Promise<Record<string, string>> {
        const output = await this.runCommand(['-s', serial, 'shell', 'getprop']);
        return parseGetpropOutput(output);
    }

    async getDeviceMetadata(serial: string): Promise<DeviceMetadata> {
        const props = await this.getDeviceProperties(serial);
        return {
            manufacturer: props['ro.product.manufacturer'] ?? 'Unknown',
            model: props['ro.product.model'] ?? 'Unknown',
            brand: props['ro.product.brand'] ?? 'Unknown',
            device: props['ro.product.device'] ?? 'Unknown',
            androidVersion: props['ro.build.version.release'] ?? 'Unknown',
            apiLevel: parseInt(props['ro.build.version.sdk'] ?? '0', 10),
            density: parseInt(props['ro.sf.lcd_density'] ?? '0', 10),
            isEmulator: serial.startsWith('emulator-') || 
                       props['ro.build.characteristics']?.includes('emulator') === true,
        };
    }

    async installApk(serial: string, apkPath: string): Promise<AdbCommandResult> {
        return this.runCommandWithResult(['-s', serial, 'install', '-r', apkPath]);
    }

    async uninstallPackage(serial: string, packageName: string): Promise<AdbCommandResult> {
        return this.runCommandWithResult(['-s', serial, 'uninstall', packageName]);
    }

    async clearAppData(serial: string, packageName: string): Promise<AdbCommandResult> {
        return this.runCommandWithResult(['-s', serial, 'shell', 'pm', 'clear', packageName]);
    }

    async forceStop(serial: string, packageName: string): Promise<AdbCommandResult> {
        return this.runCommandWithResult(['-s', serial, 'shell', 'am', 'force-stop', packageName]);
    }

    async listPackages(serial: string, thirdPartyOnly = true): Promise<string[]> {
        const args = ['-s', serial, 'shell', 'pm', 'list', 'packages'];
        if (thirdPartyOnly) args.push('-3');
        const output = await this.runCommand(args);
        return output
            .trim()
            .split('\n')
            .filter(line => line.startsWith('package:'))
            .map(line => line.slice(8));
    }

    async getPackagePid(serial: string, packageName: string): Promise<number | null> {
        const output = await this.runCommand(['-s', serial, 'shell', 'pidof', '-s', packageName]);
        const pid = parseInt(output.trim(), 10);
        return isNaN(pid) ? null : pid;
    }

    async killEmulator(serial: string): Promise<void> {
        await this.runCommand(['-s', serial, 'emu', 'kill']);
    }

    spawnLogcat(serial: string, args: string[] = []): Subprocess {
        const cmd = [this._adbPath!, '-s', serial, 'logcat', ...args];
        return Bun.spawn(cmd, {
            stdout: 'pipe',
            stderr: 'pipe',
        });
    }

    private async runCommand(args: string[]): Promise<string> {
        if (!this._adbPath) throw new Error('ADB not found');
        const proc = Bun.spawn([this._adbPath, ...args], {
            stdout: 'pipe',
            stderr: 'pipe',
        });
        const stdout = await new Response(proc.stdout).text();
        await proc.exited;
        return stdout;
    }

    private async runCommandWithResult(args: string[]): Promise<AdbCommandResult> {
        if (!this._adbPath) {
            return { success: false, exitCode: -1, stdout: '', stderr: 'ADB not found' };
        }
        const proc = Bun.spawn([this._adbPath, ...args], {
            stdout: 'pipe',
            stderr: 'pipe',
        });
        const stdout = await new Response(proc.stdout).text();
        const stderr = await new Response(proc.stderr).text();
        const exitCode = await proc.exited;
        return { success: exitCode === 0, exitCode, stdout, stderr };
    }
}
