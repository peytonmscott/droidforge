#!/usr/bin/env bun
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const REPO = 'peytonmscott/droidforge';

async function getLatestRef(): Promise<{ ref: string; source: 'release' | 'tag' | 'default' }> {
    const headers = {
        'accept': 'application/vnd.github+json',
        'user-agent': 'droidforge',
    };

    const releaseResponse = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers });
    if (releaseResponse.ok) {
        const payload: any = await releaseResponse.json();
        const tag = String(payload?.tag_name ?? '').trim();
        if (!tag) throw new Error('Latest release response missing tag_name');
        return { ref: tag, source: 'release' };
    }

    // If no releases exist yet, fall back to the most recent tag.
    if (releaseResponse.status === 404) {
        const tagsResponse = await fetch(`https://api.github.com/repos/${REPO}/tags?per_page=1`, { headers });
        if (tagsResponse.ok) {
            const tags = (await tagsResponse.json()) as any[];
            const tag = String(tags?.[0]?.name ?? '').trim();
            if (tag) return { ref: tag, source: 'tag' };
        }

        // Final fallback: default branch.
        return { ref: 'main', source: 'default' };
    }

    throw new Error(`Failed to fetch latest release: ${releaseResponse.status} ${releaseResponse.statusText}`);
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
    await runUpdate(rest);
} else {
    await import('./index');
}
