import { RGBA, StyledText, TextAttributes, parseColor } from '@opentui/core';

type TextChunk = {
    __isChunk: true;
    text: string;
    fg?: RGBA;
    bg?: RGBA;
    attributes?: number;
    link?: { url: string };
};

type SgrState = {
    fg?: RGBA;
    bg?: RGBA;
    attributes: number;
};

const BASIC_COLORS: Record<number, string> = {
    30: 'black',
    31: 'red',
    32: 'green',
    33: 'yellow',
    34: 'blue',
    35: 'magenta',
    36: 'cyan',
    37: 'white',
};

const BRIGHT_COLORS: Record<number, string> = {
    90: 'brightBlack',
    91: 'brightRed',
    92: 'brightGreen',
    93: 'brightYellow',
    94: 'brightBlue',
    95: 'brightMagenta',
    96: 'brightCyan',
    97: 'brightWhite',
};

function chunk(text: string, state: SgrState): TextChunk {
    const result: TextChunk = {
        __isChunk: true,
        text,
    };

    if (state.fg) result.fg = state.fg;
    if (state.bg) result.bg = state.bg;
    if (state.attributes) result.attributes = state.attributes;

    return result;
}

function xterm256ToRgb(index: number): RGBA {
    const clamped = Math.max(0, Math.min(255, Math.floor(index)));

    // 0-15 are system colors; approximate with a common palette.
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
        return RGBA.fromInts(r, g, b);
    }

    if (clamped >= 16 && clamped <= 231) {
        const idx = clamped - 16;
        const r = Math.floor(idx / 36);
        const g = Math.floor((idx % 36) / 6);
        const b = idx % 6;
        const steps = [0, 95, 135, 175, 215, 255];
        return RGBA.fromInts(steps[r]!, steps[g]!, steps[b]!);
    }

    // 232-255 grayscale
    const gray = 8 + (clamped - 232) * 10;
    return RGBA.fromInts(gray, gray, gray);
}

function setColorFromCode(code: number, state: SgrState, target: 'fg' | 'bg'): void {
    const mapping = BASIC_COLORS[code] ?? BRIGHT_COLORS[code];
    if (mapping) {
        state[target] = parseColor(mapping);
    }
}

function applySgr(paramsRaw: string, state: SgrState): void {
    const params = paramsRaw.length ? paramsRaw.split(';').map((p) => Number.parseInt(p, 10)) : [0];

    for (let i = 0; i < params.length; i++) {
        const code = params[i] ?? 0;

        switch (code) {
            case 0:
                state.fg = undefined;
                state.bg = undefined;
                state.attributes = 0;
                break;
            case 1:
                state.attributes |= TextAttributes.BOLD;
                break;
            case 2:
                state.attributes |= TextAttributes.DIM;
                break;
            case 3:
                state.attributes |= TextAttributes.ITALIC;
                break;
            case 4:
                state.attributes |= TextAttributes.UNDERLINE;
                break;
            case 5:
                state.attributes |= TextAttributes.BLINK;
                break;
            case 7:
                state.attributes |= TextAttributes.INVERSE;
                break;
            case 9:
                state.attributes |= TextAttributes.STRIKETHROUGH;
                break;
            case 22:
                state.attributes &= ~(TextAttributes.BOLD | TextAttributes.DIM);
                break;
            case 23:
                state.attributes &= ~TextAttributes.ITALIC;
                break;
            case 24:
                state.attributes &= ~TextAttributes.UNDERLINE;
                break;
            case 25:
                state.attributes &= ~TextAttributes.BLINK;
                break;
            case 27:
                state.attributes &= ~TextAttributes.INVERSE;
                break;
            case 29:
                state.attributes &= ~TextAttributes.STRIKETHROUGH;
                break;
            case 39:
                state.fg = undefined;
                break;
            case 49:
                state.bg = undefined;
                break;
            default:
                break;
        }

        if (code >= 30 && code <= 37) {
            setColorFromCode(code, state, 'fg');
            continue;
        }

        if (code >= 90 && code <= 97) {
            setColorFromCode(code, state, 'fg');
            continue;
        }

        if (code >= 40 && code <= 47) {
            setColorFromCode(code - 10, state, 'bg');
            continue;
        }

        if (code >= 100 && code <= 107) {
            setColorFromCode(code - 10, state, 'bg');
            continue;
        }

        // Extended colors
        if (code === 38 || code === 48) {
            const target: 'fg' | 'bg' = code === 38 ? 'fg' : 'bg';
            const mode = params[i + 1];

            if (mode === 2) {
                const r = params[i + 2];
                const g = params[i + 3];
                const b = params[i + 4];
                if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
                    state[target] = RGBA.fromInts(r!, g!, b!);
                    i += 4;
                }
                continue;
            }

            if (mode === 5) {
                const idx = params[i + 2];
                if (Number.isFinite(idx)) {
                    state[target] = xterm256ToRgb(idx!);
                    i += 2;
                }
                continue;
            }
        }
    }
}

function stripUnsupportedEscapes(input: string, startIndex: number): { endIndex: number; sequence: string } {
    // Supports CSI (ESC [ ...), OSC (ESC ] ... BEL/ST), otherwise skips ESC + next char.
    const esc = input[startIndex];
    if (esc !== '\u001b') {
        return { endIndex: startIndex + 1, sequence: '' };
    }

    const next = input[startIndex + 1];
    if (!next) {
        return { endIndex: startIndex + 1, sequence: '' };
    }

    if (next === '[') {
        // CSI: read until a final byte (0x40-0x7E)
        for (let i = startIndex + 2; i < input.length; i++) {
            const code = input.charCodeAt(i);
            if (code >= 0x40 && code <= 0x7e) {
                return { endIndex: i + 1, sequence: input.slice(startIndex, i + 1) };
            }
        }
        return { endIndex: input.length, sequence: input.slice(startIndex) };
    }

    if (next === ']') {
        // OSC: terminated by BEL (\x07) or ST (ESC \\)
        for (let i = startIndex + 2; i < input.length; i++) {
            const ch = input[i];
            if (ch === '\u0007') {
                return { endIndex: i + 1, sequence: input.slice(startIndex, i + 1) };
            }
            if (ch === '\u001b' && input[i + 1] === '\\') {
                return { endIndex: i + 2, sequence: input.slice(startIndex, i + 2) };
            }
        }
        return { endIndex: input.length, sequence: input.slice(startIndex) };
    }

    return { endIndex: startIndex + 2, sequence: input.slice(startIndex, startIndex + 2) };
}

export function ansiToStyledText(input: string): StyledText {
    const chunks: TextChunk[] = [];
    const state: SgrState = { attributes: 0 };

    let buffer = '';

    function flush(): void {
        if (!buffer) return;
        chunks.push(chunk(buffer, state));
        buffer = '';
    }

    for (let i = 0; i < input.length;) {
        const ch = input[i]!;

        if (ch !== '\u001b') {
            buffer += ch;
            i += 1;
            continue;
        }

        flush();

        const { endIndex, sequence } = stripUnsupportedEscapes(input, i);

        if (sequence.startsWith('\u001b[') && sequence.endsWith('m')) {
            const params = sequence.slice(2, -1);
            applySgr(params, state);
        }

        i = endIndex;
    }

    flush();

    return new StyledText(chunks);
}
