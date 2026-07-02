import type { AvdInfo } from './types';
import { AdbService } from './AdbService';
import { parseAvdList } from './parsers';

export class EmulatorService {
    constructor(private readonly _adb: AdbService) {}

    async listAvds(): Promise<AvdInfo[]> {
        const emulatorPath = this._adb.getEmulatorPath();
        if (!emulatorPath) return [];

        const proc = Bun.spawn([emulatorPath, '-list-avds'], {
            stdout: 'pipe',
            stderr: 'pipe',
        });
        const output = await new Response(proc.stdout).text();
        const names = parseAvdList(output);
        
        const devices = await this._adb.listDevices();
        const runningEmulators = devices.filter(d => d.type === 'emulator');

        // The AVD name isn't part of `adb devices -l` output; ask each running
        // emulator which AVD it is booting.
        const serialsByAvd = new Map<string, string>();
        await Promise.all(
            runningEmulators.map(async (emulator) => {
                const avdName = await this._adb.getEmulatorAvdName(emulator.serial);
                if (avdName) serialsByAvd.set(avdName, emulator.serial);
            }),
        );

        return names.map(name => {
            const serial = serialsByAvd.get(name);
            return {
                name,
                isRunning: serial !== undefined,
                serial,
            };
        });
    }

    async startEmulator(avdName: string): Promise<void> {
        const emulatorPath = this._adb.getEmulatorPath();
        if (!emulatorPath) throw new Error('Emulator not found');

        Bun.spawn([emulatorPath, '-avd', avdName, '-no-snapshot-load'], {
            stdout: 'ignore',
            stderr: 'ignore',
            stdin: 'ignore',
        });
    }

    async stopEmulator(serial: string): Promise<void> {
        await this._adb.killEmulator(serial);
    }
}
