import { RGBA, parseColor, rgbToHex } from '@opentui/core';

export type ThemeMode = 'dark' | 'light';

export type ThemeColorValue =
    | string
    | number
    | {
          dark?: ThemeColorValue;
          light?: ThemeColorValue;
      };

export interface ThemeFile {
    $schema?: string;
    defs?: Record<string, ThemeColorValue>;
    theme: Record<string, ThemeColorValue>;
}

export interface ResolvedThemeTokens {
    id: string;
    tokens: Record<string, string | undefined>;
}

function isVariantObject(value: ThemeColorValue): value is { dark?: ThemeColorValue; light?: ThemeColorValue } {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isHexColor(value: string): boolean {
    return /^#[0-9a-fA-F]{6}$/.test(value) || /^#[0-9a-fA-F]{8}$/.test(value);
}

function ansiIndexToHex(index: number): string {
    const clamped = Math.max(0, Math.min(255, Math.floor(index)));

    // 0-15 are system colors. We map them to a common xterm palette.
    const ansi16: Array<[number, number, number]> = [
        [0, 0, 0],
        [205, 0, 0],
        [0, 205, 0],
        [205, 205, 0],
        [0, 0, 238],
        [205, 0, 205],
        [0, 205, 205],
        [229, 229, 229],
        [127, 127, 127],
        [255, 0, 0],
        [0, 255, 0],
        [255, 255, 0],
        [92, 92, 255],
        [255, 0, 255],
        [0, 255, 255],
        [255, 255, 255],
    ];

    if (clamped < 16) {
        const [r, g, b] = ansi16[clamped] ?? [255, 255, 255];
        return rgbToHex(RGBA.fromInts(r, g, b));
    }

    // 16-231: 6x6x6 color cube
    if (clamped >= 16 && clamped <= 231) {
        const idx = clamped - 16;
        const r = Math.floor(idx / 36);
        const g = Math.floor((idx % 36) / 6);
        const b = idx % 6;
        const steps = [0, 95, 135, 175, 215, 255];
        return rgbToHex(RGBA.fromInts(steps[r]!, steps[g]!, steps[b]!));
    }

    // 232-255 grayscale ramp
    const gray = 8 + (clamped - 232) * 10;
    return rgbToHex(RGBA.fromInts(gray, gray, gray));
}

export function resolveThemeColor(
    raw: ThemeColorValue | undefined,
    options: {
        mode: ThemeMode;
        defs: Record<string, ThemeColorValue>;
        stack?: string[];
    },
): string | undefined {
    if (raw === undefined) return undefined;

    if (typeof raw === 'number') {
        return ansiIndexToHex(raw);
    }

    if (typeof raw === 'string') {
        if (raw === 'none') return undefined;
        if (raw === 'transparent') return 'transparent';
        if (isHexColor(raw)) return raw;

        const defValue = options.defs[raw];
        if (defValue !== undefined) {
            const stack = options.stack ?? [];
            if (stack.includes(raw)) {
                return undefined;
            }
            return resolveThemeColor(defValue, { ...options, stack: [...stack, raw] });
        }

        // Accept named colors supported by OpenTUI (e.g., "red") by converting
        // them through hexToRgb/rgbToHex.
        try {
            return rgbToHex(parseColor(raw));
        } catch {
            return raw;
        }
    }

    if (isVariantObject(raw)) {
        const variant = options.mode === 'light' ? raw.light : raw.dark;
        return resolveThemeColor(variant ?? raw.dark ?? raw.light, options);
    }

    return undefined;
}

export function resolveThemeFile(
    id: string,
    themeFile: ThemeFile,
    mode: ThemeMode,
): ResolvedThemeTokens {
    const defs = themeFile.defs ?? {};

    const tokens: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(themeFile.theme ?? {})) {
        tokens[key] = resolveThemeColor(value, { mode, defs });
    }

    return { id, tokens };
}
