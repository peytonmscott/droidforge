import { describe, expect, test } from 'bun:test';

import { resolveConfigDir } from '../utilities/paths';

describe('resolveConfigDir', () => {
    test('uses DROIDFORGE_CONFIG_DIR override', () => {
        const dir = resolveConfigDir({
            platform: 'darwin',
            env: { DROIDFORGE_CONFIG_DIR: '/tmp/custom' },
            homedir: '/home/alice',
        });

        expect(dir).toBe('/tmp/custom');
    });

    test('uses XDG_CONFIG_HOME on unix', () => {
        const dir = resolveConfigDir({
            platform: 'linux',
            env: { XDG_CONFIG_HOME: '/xdg' },
            homedir: '/home/alice',
        });

        expect(dir).toBe('/xdg/droidforge');
    });

    test('defaults to ~/.config on unix', () => {
        const dir = resolveConfigDir({
            platform: 'linux',
            env: {},
            homedir: '/home/alice',
        });

        expect(dir).toBe('/home/alice/.config/droidforge');
    });

    test('uses APPDATA on windows', () => {
        const dir = resolveConfigDir({
            platform: 'win32',
            env: { APPDATA: 'C:\\Users\\alice\\AppData\\Roaming' },
            homedir: 'C:\\Users\\alice',
        });

        expect(dir).toBe('C:\\Users\\alice\\AppData\\Roaming\\droidforge');
    });
});
