import { describe, expect, test } from 'bun:test';

import { fetchJsonWithRetry } from '../commands/update';

describe('fetchJsonWithRetry', () => {
    test('fails fast on AbortError (no retries)', async () => {
        const originalFetch = globalThis.fetch;
        let calls = 0;

        globalThis.fetch = (async () => {
            calls += 1;
            const err: any = new Error('aborted');
            err.name = 'AbortError';
            throw err;
        }) as any;

        try {
            await expect(fetchJsonWithRetry('https://example.invalid', 1, 3)).rejects.toThrow(
                /timed out/i,
            );
            expect(calls).toBe(1);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });
});
