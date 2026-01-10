import { afterEach, describe, expect, test } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { ensureConfigFileExists, loadConfig, updateConfig } from '../config/config';
import { getConfigPath } from '../utilities/paths';

let tempDir: string | null = null;

afterEach(async () => {
    if (tempDir) {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
        tempDir = null;
    }
    delete process.env.DROIDFORGE_CONFIG_DIR;
});

describe('droidforge.json config', () => {
    test('creates default config when missing', async () => {
        tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'droidforge-test-'));
        process.env.DROIDFORGE_CONFIG_DIR = tempDir;

        const config = await ensureConfigFileExists();
        expect(config.version).toBe(1);

        const configPath = getConfigPath();
        expect(fs.existsSync(configPath)).toBe(true);

        const loaded = await loadConfig();
        expect(loaded.theme.primaryColor).toBe(config.theme.primaryColor);
        expect(loaded.preferences.themeMode).toBe('dark');
    });

    test('updates and persists config', async () => {
        tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'droidforge-test-'));
        process.env.DROIDFORGE_CONFIG_DIR = tempDir;

        await ensureConfigFileExists();
        await updateConfig({ theme: { primaryColor: '#ff0000' } });

        const loaded = await loadConfig();
        expect(loaded.theme.primaryColor).toBe('#ff0000');

        const raw = await fs.promises.readFile(getConfigPath(), 'utf8');
        expect(raw).toContain('#ff0000');
    });
});
