#!/usr/bin/env bun
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const REPO = 'peytonmscott/droidforge';

function buildGitHubHeaders(): Record<string, string> {
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

    return {
        accept: 'application/vnd.github+json',
        'user-agent': 'droidforge',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
    };
}

async function fetchJsonWithRetry(url: string, timeoutMs = 8000, retries = 2): Promise<any> {
    let lastErr: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, {
                headers: buildGitHubHeaders(),
                signal: controller.signal,
            });

            if (!response.ok) {
                const message = `GitHub API request failed: ${response.status} ${response.statusText}`;
                throw Object.assign(new Error(message), { status: response.status });
            }

            return await response.json();
        } catch (err) {
            lastErr = err;

            if (attempt < retries) {
                await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
                continue;
            }
        } finally {
            clearTimeout(timer);
        }
    }

    throw lastErr;
}

async function getLatestRef(): Promise<{ ref: string; source: 'release' | 'tag' | 'default' }> {
    try {
        const payload: any = await fetchJsonWithRetry(`https://api.github.com/repos/${REPO}/releases/latest`);
        const tag = String(payload?.tag_name ?? '').trim();
        if (!tag) throw new Error('Latest release response missing tag_name');
        return { ref: tag, source: 'release' };
    } catch (error: any) {
        const status = Number(error?.status ?? 0);
        if (status !== 404) throw error;
    }

    // If no releases exist yet, fall back to the most recent tag.
    try {
        const tags = (await fetchJsonWithRetry(`https://api.github.com/repos/${REPO}/tags?per_page=1`)) as any[];
        const tag = String(tags?.[0]?.name ?? '').trim();
        if (tag) return { ref: tag, source: 'tag' };
    } catch {
        // ignore
    }

    // Final fallback: default branch.
    return { ref: 'main', source: 'default' };
}

async function confirmUpdate(command: string): Promise<boolean> {
    const rl = readline.createInterface({ input, output });
    try {
        const answer = (await rl.question(`${command}\nProceed? [y/N] `)).trim().toLowerCase();
        return answer === 'y' || answer === 'yes';
    } finally {
        rl.close();
    }
}

async function runUpdate(args: string[]): Promise<void> {
    const checkOnly = args.includes('--check');
    const autoYes = args.includes('--yes') || args.includes('-y');

    const latest = await getLatestRef();
    const spec = `github:${REPO}#${latest.ref}`;

    if (checkOnly) {
        console.log(latest.ref);
        return;
    }

    let cmd: string;
    let cmdArgs: string[];

    if (Bun.which('bun')) {
        cmd = 'bun';
        cmdArgs = ['add', '-g', spec];
    } else if (Bun.which('npm')) {
        cmd = 'npm';
        cmdArgs = ['i', '-g', spec];
    } else {
        throw new Error('Neither bun nor npm is available on PATH.');
    }

    const fullCommand = `${cmd} ${cmdArgs.join(' ')}`;

    if (!autoYes) {
        const confirmed = await confirmUpdate(fullCommand);
        if (!confirmed) {
            console.log('Cancelled.');
            return;
        }
    } else {
        console.log(fullCommand);
    }

    const proc = Bun.spawn([cmd, ...cmdArgs], {
        stdin: 'inherit',
        stdout: 'inherit',
        stderr: 'inherit',
    });

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
        throw new Error(`Update command failed with exit code ${exitCode}`);
    }

    console.log(`Updated to ${latest.ref}. Restart droidforge.`);
}

const [command, ...rest] = process.argv.slice(2);

if (command === 'update') {
    try {
        await runUpdate(rest);
    } catch (error) {
        console.error('Update failed:', error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
} else {
    await import('./index');
}
