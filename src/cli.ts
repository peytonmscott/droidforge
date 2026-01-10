#!/usr/bin/env bun
import { runUpdate } from './commands/update';

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
