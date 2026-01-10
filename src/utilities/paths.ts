import os from 'os';
import path from 'path';

export type Platform = NodeJS.Platform;

export interface ResolveConfigDirOptions {
    platform: Platform;
    env: NodeJS.ProcessEnv;
    homedir: string;
}

export function resolveConfigDir(options: ResolveConfigDirOptions): string {
    const { platform, env, homedir } = options;

    const pathImpl = platform === 'win32' ? path.win32 : path.posix;

    const overrideDir = env.DROIDFORGE_CONFIG_DIR;
    if (overrideDir && overrideDir.trim().length > 0) {
        return pathImpl.resolve(overrideDir);
    }

    if (platform === 'win32') {
        const appData = env.APPDATA;
        if (appData && appData.trim().length > 0) {
            return pathImpl.join(appData, 'droidforge');
        }

        // Fallback for Windows if APPDATA is not set
        return pathImpl.join(homedir, 'AppData', 'Roaming', 'droidforge');
    }

    const xdgConfigHome = env.XDG_CONFIG_HOME;
    const baseDir = xdgConfigHome && xdgConfigHome.trim().length > 0
        ? xdgConfigHome
        : pathImpl.join(homedir, '.config');

    return pathImpl.join(baseDir, 'droidforge');
}

export function getConfigDir(): string {
    return resolveConfigDir({
        platform: process.platform,
        env: process.env,
        homedir: os.homedir(),
    });
}

export function getConfigPath(): string {
    return path.join(getConfigDir(), 'droidforge.json');
}

export function getDbPath(): string {
    return path.join(getConfigDir(), 'droidforge.db');
}

export function getLegacyDbPath(): string {
    return path.join(os.homedir(), '.droidforge', 'data.db');
}
