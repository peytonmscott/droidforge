import fs from 'fs';
import path from 'path';

import { RGBA, SyntaxStyle, parseColor } from '@opentui/core';

import { ensureConfigFileExists, updateConfig } from '../../config/config';

export type ThemeModePreference = 'dark' | 'light' | 'system';
import { getConfigDir } from '../../utilities/paths';
import { ProjectDetection } from '../../utilities/projectDetection';

import { BUILTIN_THEMES, type ThemeRegistration } from './builtinThemes';
import { resolveThemeFile, type ThemeFile, type ThemeMode } from './themeSchema';

export interface ThemeInfo {
    id: string;
    displayName: string;
    source: 'builtin' | 'user' | 'project' | 'cwd';
}

export interface UiTheme {
    id: string;
    displayName: string;

    // Common UI colors
    backgroundColor?: string;
    panelBackgroundColor?: string;
    elementBackgroundColor?: string;

    textColor?: string;
    mutedTextColor?: string;

    borderColor?: string;
    borderActiveColor?: string;

    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;

    // Select menu
    selectedBackgroundColor?: string;
    selectedTextColor?: string;
    descriptionColor?: string;
    selectedDescriptionColor?: string;

    // Footer
    footerBackgroundColor?: string;
    footerBorderColor?: string;
    footerTextColor?: string;
}

type ThemeSource = ThemeInfo['source'];

function detectSystemThemeMode(): ThemeMode {
    try {
        if (process.platform === 'darwin') {
            const proc = Bun.spawnSync({
                cmd: ['defaults', 'read', '-g', 'AppleInterfaceStyle'],
                stdout: 'pipe',
                stderr: 'pipe',
            });

            const out = proc.stdout ? new TextDecoder().decode(proc.stdout).trim() : '';
            return out.toLowerCase().includes('dark') ? 'dark' : 'light';
        }

        if (process.platform === 'win32') {
            // 0 = dark, 1 = light
            const proc = Bun.spawnSync({
                cmd: [
                    'reg',
                    'query',
                    'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize',
                    '/v',
                    'AppsUseLightTheme',
                ],
                stdout: 'pipe',
                stderr: 'pipe',
            });

            const out = proc.stdout ? new TextDecoder().decode(proc.stdout) : '';
            return out.includes('0x0') ? 'dark' : 'light';
        }

        // Best-effort for GNOME.
        const proc = Bun.spawnSync({
            cmd: ['gsettings', 'get', 'org.gnome.desktop.interface', 'color-scheme'],
            stdout: 'pipe',
            stderr: 'pipe',
        });

        const out = proc.stdout ? new TextDecoder().decode(proc.stdout).toLowerCase() : '';
        return out.includes('dark') ? 'dark' : 'light';
    } catch {
        return 'dark';
    }
}

type ThemeEntry = {
    info: ThemeInfo;
    file: ThemeFile;
    modeOverride?: ThemeMode;
};

function slugToTitle(slug: string): string {
    return slug
        .split(/[-_]/g)
        .filter(Boolean)
        .map((word) => word[0]?.toUpperCase() + word.slice(1))
        .join(' ');
}

function tryReadJson(filePath: string): unknown {
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function isThemeFile(value: unknown): value is ThemeFile {
    return (
        typeof value === 'object' &&
        value !== null &&
        'theme' in value &&
        typeof (value as any).theme === 'object' &&
        (value as any).theme !== null
    );
}

function listThemeFiles(dir: string): ThemeEntry[] {
    if (!fs.existsSync(dir)) return [];

    const entries: ThemeEntry[] = [];

    for (const fileName of fs.readdirSync(dir)) {
        if (!fileName.endsWith('.json')) continue;

        const filePath = path.join(dir, fileName);
        const parsed = tryReadJson(filePath);
        if (!isThemeFile(parsed)) continue;

        const id = path.basename(fileName, '.json');
        entries.push({
            info: { id, displayName: slugToTitle(id), source: 'user' },
            file: parsed,
        });
    }

    return entries;
}

function themeDirsForCwd(cwd: string): { source: ThemeSource; dir: string }[] {
    const detection = new ProjectDetection().detectAndroidProject(cwd);

    const dirs: { source: ThemeSource; dir: string }[] = [];

    // User-level themes
    dirs.push({ source: 'user', dir: path.join(getConfigDir(), 'themes') });

    // Project-level themes
    if (detection.projectRoot) {
        dirs.push({ source: 'project', dir: path.join(detection.projectRoot, '.droidforge', 'themes') });
    }

    // Current directory overrides
    dirs.push({ source: 'cwd', dir: path.join(cwd, '.droidforge', 'themes') });

    return dirs;
}

export class ThemeManager {
    private currentThemeId: string;
    private currentTheme: UiTheme;
    private currentMode: ThemeMode;
    private modePreference: ThemeModePreference;
    private listeners = new Set<() => void>();

    private themeRegistry = new Map<string, ThemeEntry>();

    constructor() {
        this.currentThemeId = 'opencode';
        this.currentTheme = this.buildFallbackTheme();
        this.currentMode = 'dark';
        this.modePreference = 'dark';

        // Seed built-ins so the app always has themes available.
        for (const theme of BUILTIN_THEMES) {
            this.themeRegistry.set(theme.id, {
                info: { id: theme.id, displayName: theme.displayName, source: theme.source },
                file: theme.file,
                modeOverride: theme.mode,
            });
        }
    }

    private buildFallbackTheme(): UiTheme {
        // Reasonable defaults matching current UI hardcodes.
        return {
            id: 'fallback',
            displayName: 'Fallback',
            backgroundColor: 'transparent',
            panelBackgroundColor: 'transparent',
            elementBackgroundColor: 'transparent',
            textColor: '#E2E8F0',
            mutedTextColor: '#64748B',
            borderColor: '#475569',
            borderActiveColor: '#94A3B8',
            primaryColor: '#3b82f6',
            secondaryColor: '#1e40af',
            accentColor: '#38BDF8',
            selectedBackgroundColor: '#1E3A5F',
            selectedTextColor: '#38BDF8',
            descriptionColor: '#64748B',
            selectedDescriptionColor: '#94A3B8',
            footerBackgroundColor: '#1e40af',
            footerBorderColor: '#1d4ed8',
            footerTextColor: '#dbeafe',
        };
    }

    onThemeChange(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private emitThemeChange(): void {
        for (const listener of this.listeners) {
            listener();
        }
    }

    async reloadThemes(): Promise<void> {
        this.themeRegistry.clear();

        for (const theme of BUILTIN_THEMES) {
            this.themeRegistry.set(theme.id, {
                info: { id: theme.id, displayName: theme.displayName, source: theme.source },
                file: theme.file,
                modeOverride: theme.mode,
            });
        }

        const cwd = process.cwd();
        const dirs = themeDirsForCwd(cwd);

        for (const { source, dir } of dirs) {
            const themes = listThemeFiles(dir);
            for (const entry of themes) {
                entry.info.source = source;
                // Higher-priority dirs override lower.
                this.themeRegistry.set(entry.info.id, entry);
            }
        }

        await this.loadSelectedTheme();
    }

    listThemes(): ThemeInfo[] {
        return [...this.themeRegistry.values()]
            .map((entry) => entry.info)
            .sort((a, b) => a.displayName.localeCompare(b.displayName));
    }

    getTheme(): UiTheme {
        return { ...this.currentTheme };
    }

    getThemeId(): string {
        return this.currentThemeId;
    }

    getThemeModePreference(): ThemeModePreference {
        return this.modePreference;
    }

    getEffectiveThemeMode(): ThemeMode {
        return this.currentMode;
    }

    async setTheme(themeId: string): Promise<void> {
        if (!this.themeRegistry.has(themeId)) return;

        const config = await ensureConfigFileExists();
        const prefMode = (config.preferences.themeMode ?? 'dark') as ThemeModePreference;

        if (prefMode === 'system') {
            const key = this.currentMode === 'dark' ? 'themeIdDark' : 'themeIdLight';
            await updateConfig({ preferences: { [key]: themeId } as any });
        } else {
            await updateConfig({ preferences: { themeId } });
        }

        await this.loadSelectedTheme();
    }

    async setThemeForMode(themeId: string, mode: ThemeMode): Promise<void> {
        if (!this.themeRegistry.has(themeId)) return;

        const key = mode === 'dark' ? 'themeIdDark' : 'themeIdLight';
        await updateConfig({ preferences: { [key]: themeId } as any });

        if (this.modePreference === 'system' && this.currentMode === mode) {
            await this.loadSelectedTheme();
        }
    }

    async setThemeModePreference(mode: ThemeModePreference): Promise<void> {
        await updateConfig({ preferences: { themeMode: mode } as any });
        await this.loadSelectedTheme();
    }

    private async loadSelectedTheme(): Promise<void> {
        try {
            const config = await ensureConfigFileExists();
            const prefMode = (config.preferences.themeMode ?? 'dark') as ThemeModePreference;

            this.modePreference = prefMode;
            this.currentMode = prefMode === 'system' ? detectSystemThemeMode() : prefMode;

            const fallbackId = config.preferences.themeId ?? 'opencode';

            let desiredId = fallbackId;
            if (prefMode === 'system') {
                desiredId =
                    this.currentMode === 'dark'
                        ? (config.preferences.themeIdDark ?? fallbackId)
                        : (config.preferences.themeIdLight ?? fallbackId);
            }

            if (this.themeRegistry.has(desiredId)) {
                this.currentThemeId = desiredId;
            } else if (this.themeRegistry.has(fallbackId)) {
                this.currentThemeId = fallbackId;
            } else {
                this.currentThemeId = 'opencode';
            }
        } catch {
            // ignore
        }

        const next = this.resolveUiTheme(this.currentThemeId);
        this.currentTheme = next;
        this.emitThemeChange();
    }

    private resolveUiTheme(themeId: string): UiTheme {
        const entry = this.themeRegistry.get(themeId);
        if (!entry) return this.buildFallbackTheme();

        const mode: ThemeMode = entry.modeOverride ?? this.currentMode;

        const resolved = resolveThemeFile(themeId, entry.file, mode);
        const t = resolved.tokens;

        const background = t.background ?? 'transparent';
        const panelBackground = t.backgroundPanel ?? background;
        const elementBackground = t.backgroundElement ?? panelBackground;

        const border = t.border;
        const borderActive = t.borderActive ?? border;

        const primary = t.primary;
        const secondary = t.secondary;
        const accent = t.accent ?? primary;

        const text = t.text;
        const textMuted = t.textMuted;

        // Menu styling: heuristic mapping.
        const selectedBg = elementBackground;
        const selectedText = primary ?? accent;

        const description = textMuted;
        const selectedDescription = textMuted;

        // Footer: use secondary/backgroundElement for contrast.
        const footerBg = secondary ?? panelBackground;
        const footerBorder = primary ?? border;

        return {
            id: entry.info.id,
            displayName: entry.info.displayName,
            backgroundColor: background,
            panelBackgroundColor: panelBackground,
            elementBackgroundColor: elementBackground,
            textColor: text,
            mutedTextColor: textMuted,
            borderColor: border,
            borderActiveColor: borderActive,
            primaryColor: primary,
            secondaryColor: secondary,
            accentColor: accent,
            selectedBackgroundColor: selectedBg,
            selectedTextColor: selectedText,
            descriptionColor: description,
            selectedDescriptionColor: selectedDescription,
            footerBackgroundColor: footerBg,
            footerBorderColor: footerBorder,
            footerTextColor: text,
        };
    }

    getAnsiPalette(): Array<{ name: string; color?: string }> {
        const theme = this.currentTheme;

        // Map ANSI 16 slots to theme semantics.
        const bg = theme.backgroundColor;
        const fg = theme.textColor;

        return [
            { name: 'black', color: bg },
            { name: 'red', color: theme.accentColor ?? theme.primaryColor },
            { name: 'green', color: theme.primaryColor },
            { name: 'yellow', color: theme.secondaryColor },
            { name: 'blue', color: theme.primaryColor },
            { name: 'magenta', color: theme.secondaryColor },
            { name: 'cyan', color: theme.accentColor },
            { name: 'white', color: fg },
            { name: 'brightBlack', color: theme.borderColor },
            { name: 'brightRed', color: theme.accentColor },
            { name: 'brightGreen', color: theme.primaryColor },
            { name: 'brightYellow', color: theme.secondaryColor },
            { name: 'brightBlue', color: theme.primaryColor },
            { name: 'brightMagenta', color: theme.secondaryColor },
            { name: 'brightCyan', color: theme.accentColor },
            { name: 'brightWhite', color: fg },
        ];
    }

    getAnsiPaletteMap(): Record<string, RGBA> {
        const mapping: Record<string, RGBA> = {};
        for (const { name, color } of this.getAnsiPalette()) {
            if (!color) continue;
            try {
                mapping[name] = parseColor(color);
            } catch {
                // ignore
            }
        }
        return mapping;
    }

    getSyntaxStyle(): SyntaxStyle {
        const entry = this.themeRegistry.get(this.currentThemeId);
        if (!entry) {
            return SyntaxStyle.create();
        }

        const mode: ThemeMode = entry.modeOverride ?? this.currentMode;
        const resolved = resolveThemeFile(this.currentThemeId, entry.file, mode);
        const t = resolved.tokens;

        const styles: Record<string, any> = {
            default: {
                fg: t.text,
                bg: t.background,
            },
            comment: {
                fg: t.syntaxComment ?? t.textMuted,
                italic: true,
            },
            keyword: {
                fg: t.syntaxKeyword ?? t.secondary ?? t.primary,
                bold: true,
            },
            function: {
                fg: t.syntaxFunction ?? t.primary,
            },
            variable: {
                fg: t.syntaxVariable ?? t.text,
            },
            string: {
                fg: t.syntaxString ?? t.accent ?? t.primary,
            },
            number: {
                fg: t.syntaxNumber ?? t.accent ?? t.secondary,
            },
            type: {
                fg: t.syntaxType ?? t.secondary,
            },
            operator: {
                fg: t.syntaxOperator ?? t.textMuted,
            },
            punctuation: {
                fg: t.syntaxPunctuation ?? t.text,
            },
        };

        return SyntaxStyle.fromStyles(styles);
    }

    async ensureUserThemesDir(): Promise<string> {
        const dir = path.join(getConfigDir(), 'themes');
        await fs.promises.mkdir(dir, { recursive: true });
        return dir;
    }
}
