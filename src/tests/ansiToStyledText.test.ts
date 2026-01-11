import { describe, expect, test } from 'bun:test';
import { RGBA, TextAttributes, parseColor } from '@opentui/core';

import { ansiToStyledText } from '../utilities/ansiToStyledText';

describe('ansiToStyledText', () => {
    test('keeps plain text as a single chunk', () => {
        const styled = ansiToStyledText('hello');
        expect(styled.chunks.length).toBe(1);
        expect(styled.chunks[0]?.text).toBe('hello');
    });

    test('parses basic foreground colors', () => {
        const styled = ansiToStyledText('\u001b[31mred\u001b[0m');
        expect(styled.chunks.length).toBe(1);
        expect(styled.chunks[0]?.text).toBe('red');

        const expected = parseColor('red');
        expect((styled.chunks[0]?.fg as RGBA).toString()).toBe(expected.toString());
    });

    test('parses attributes', () => {
        const styled = ansiToStyledText('\u001b[1mbold\u001b[22m');
        expect(styled.chunks.length).toBe(1);
        expect(styled.chunks[0]?.attributes).toBe(TextAttributes.BOLD);
    });
});
