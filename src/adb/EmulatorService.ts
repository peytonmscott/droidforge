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

        return names.map(name => {
            const running = runningEmulators.find(e => 
                e.model?.includes(name) || e.serial.includes(name.toLowerCase().replace(/_/g, ''))
            );
            return {
                name,
                isRunning: !!running,
                serial: running?.serial,
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
