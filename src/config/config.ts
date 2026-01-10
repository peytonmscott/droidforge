import fs from 'fs';
import path from 'path';

import type { Settings, Theme } from '../data/schemas';
import { getConfigDir, getConfigPath } from '../utilities/paths';

export interface DroidforgeConfig {
    version: 1;
    theme: Theme;
    preferences: Settings['preferences'];
}

export function getDefaultConfig(): DroidforgeConfig {
    return {
        version: 1,
        theme: {
            primaryColor: "#3b82f6",
            secondaryColor: "#1e40af",
            backgroundColor: "transparent",
            textColor: "#E2E8F0",
            borderColor: "#475569",
        },
        preferences: {
            themeMode: 'dark',
            language: 'English',
            autoSave: true,
            notifications: true,
        },
    };
}

function safeJsonParse(json: string): unknown {
    try {
        return JSON.parse(json);
    } catch {
        return null;
    }
}

export async function ensureConfigDirExists(): Promise<void> {
    await fs.promises.mkdir(getConfigDir(), { recursive: true });
}

export async function loadConfig(): Promise<DroidforgeConfig> {
    const configPath = getConfigPath();

    try {
        const raw = await fs.promises.readFile(configPath, 'utf8');
        const parsed = safeJsonParse(raw);

        if (!parsed || typeof parsed !== 'object') {
            return getDefaultConfig();
        }

        const asAny = parsed as any;
        const defaults = getDefaultConfig();

        // Minimal schema handling: merge with defaults and keep version pinned.
        return {
            version: 1,
            theme: { ...defaults.theme, ...(asAny.theme ?? {}) },
            preferences: { ...defaults.preferences, ...(asAny.preferences ?? {}) },
        };
    } catch (error: any) {
        if (error?.code === 'ENOENT') {
            return getDefaultConfig();
        }
        throw error;
    }
}

async function atomicWriteJson(filePath: string, data: unknown): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });

    const tmpPath = path.join(dir, `.${path.basename(filePath)}.${process.pid}.tmp`);
    const content = JSON.stringify(data, null, 2) + "\n";

    await fs.promises.writeFile(tmpPath, content, 'utf8');

    try {
        await fs.promises.rename(tmpPath, filePath);
    } catch (error: any) {
        if (error?.code === 'EEXIST' || error?.code === 'EPERM') {
            await fs.promises.unlink(filePath).catch(() => undefined);
            await fs.promises.rename(tmpPath, filePath);
            return;
        }
        throw error;
    }
}

export async function saveConfig(config: DroidforgeConfig): Promise<void> {
    const configPath = getConfigPath();
    await atomicWriteJson(configPath, config);
}

export async function ensureConfigFileExists(): Promise<DroidforgeConfig> {
    await ensureConfigDirExists();

    const configPath = getConfigPath();
    try {
        await fs.promises.access(configPath, fs.constants.F_OK);
    } catch {
        const defaults = getDefaultConfig();
        await saveConfig(defaults);
        return defaults;
    }

    const config = await loadConfig();
    // Ensure any missing keys are written back.
    await saveConfig(config);
    return config;
}

export interface DroidforgeConfigPatch {
    theme?: Partial<Theme>;
    preferences?: Partial<Settings['preferences']>;
}

export async function updateConfig(patch: DroidforgeConfigPatch): Promise<DroidforgeConfig> {
    const current = await ensureConfigFileExists();
    const next: DroidforgeConfig = {
        version: 1,
        theme: { ...current.theme, ...(patch.theme ?? {}) },
        preferences: { ...current.preferences, ...(patch.preferences ?? {}) },
    };
    await saveConfig(next);
    return next;
}
