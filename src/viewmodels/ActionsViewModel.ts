import fs from 'fs';

import type { Subprocess } from 'bun';

import type { MenuOption } from '../data/schemas';
import { ProjectDetection } from '../utilities/projectDetection';

export type ActionState = 'idle' | 'running' | 'completed' | 'error';

export interface ActionOutput {
    lines: string[];
    scrollOffset: number;
    exitCode: number | null;
}

const NO_GRADLE_VALUE = '__no-gradle__';

const CURATED_ACTIONS: Array<{ label: string; description: string; command: string }> = [
    { label: 'Test', description: 'Runs unit tests', command: 'test' },
    { label: 'Clean', description: 'Cleans build outputs', command: 'clean' },
    { label: 'Build', description: 'Builds the project', command: 'build' },
];

export class ActionsViewModel {
    private _menuMessage: string | null = null;
    private _onMenuUpdate: (() => void) | null = null;

    private _state: ActionState = 'idle';
    private _output: ActionOutput = { lines: [], scrollOffset: 0, exitCode: null };
    private _outputWindowSize = 20;
    private _currentProcess: Subprocess | null = null;
    private _onOutputUpdate: (() => void) | null = null;

    get state(): ActionState {
        return this._state;
    }

    get output(): ActionOutput {
        return this._output;
    }

    get inlineMessage(): string | null {
        return this._menuMessage;
    }

    setMenuUpdateCallback(callback: () => void): void {
        this._onMenuUpdate = callback;
        this._onMenuUpdate?.();
    }

    setOutputUpdateCallback(callback: () => void): void {
        this._onOutputUpdate = callback;
    }

    setOutputWindowSize(size: number): void {
        const clamped = Math.max(1, Math.floor(size));
        if (this._outputWindowSize !== clamped) {
            this._outputWindowSize = clamped;
            this._onOutputUpdate?.();
        }
    }

    handleMenuSelection(value: string): { action: 'navigate'; command: string } | { action: 'none' } {
        if (value === NO_GRADLE_VALUE || value.startsWith('__')) {
            return { action: 'none' };
        }

        return { action: 'navigate', command: value };
    }

    getMenuOptions(): MenuOption[] {
        if (!this.isGradleProject()) {
            return [{
                name: 'No Gradle project detected',
                description: 'Launch Droid Forge inside an Android Gradle project',
                value: NO_GRADLE_VALUE,
            }];
        }

        return CURATED_ACTIONS.map((action) => ({
            name: action.label,
            description: action.description,
            value: action.command,
        }));
    }

    async runGradleCommand(command: string): Promise<void> {
        this._state = 'running';
        this._output = { lines: [], scrollOffset: 0, exitCode: null };
        this._onOutputUpdate?.();

        const cwd = process.cwd();
        const detection = new ProjectDetection().detectAndroidProject(cwd);

        if (!detection.isAndroidProject || !fs.existsSync('gradlew')) {
            this._output.lines.push(
                'No Android Gradle project detected.\n' +
                    'Launch Droid Forge from your project root, or pass a path: droidforge /path/to/android/project',
            );
            this._output.exitCode = 1;
            this._state = 'error';
            this._currentProcess = null;
            this._onOutputUpdate?.();
            return;
        }

        try {
            const proc = Bun.spawn(['./gradlew', command, '--console=plain'], {
                cwd,
                stdout: 'pipe',
                stderr: 'pipe',
                env: {
                    ...process.env,
                    // Encourage ANSI colors even when stdout is piped.
                    TERM: process.env.TERM ?? 'xterm-256color',
                },
            });

            this._currentProcess = proc;

            // Stream stdout/stderr
            void this.streamOutput(proc.stdout);
            void this.streamOutput(proc.stderr);

            const exitCode = await proc.exited;
            this._output.exitCode = exitCode;
            this._state = exitCode === 0 ? 'completed' : 'error';
            this._currentProcess = null;
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this._output.lines.push(`Error: ${message}`);
            this._state = 'error';
            this._currentProcess = null;
        }

        this._onOutputUpdate?.();
    }

    cancelTask(): boolean {
        if (this._currentProcess && this._state === 'running') {
            this._currentProcess.kill();
            this._output.lines.push('\n--- Task cancelled ---');
            this._state = 'error';
            this._currentProcess = null;
            this._onOutputUpdate?.();
            return true;
        }
        return false;
    }

    scrollUp(lines: number = 1): void {
        this._output.scrollOffset = Math.max(0, this._output.scrollOffset - lines);
        this._onOutputUpdate?.();
    }

    scrollDown(lines: number = 1): void {
        const maxOffset = Math.max(0, this._output.lines.length - this._outputWindowSize);
        this._output.scrollOffset = Math.min(maxOffset, this._output.scrollOffset + lines);
        this._onOutputUpdate?.();
    }

    getOutputText(): string {
        return this._output.lines.join('\n');
    }

    reset(): void {
        this._state = 'idle';
        this._output = { lines: [], scrollOffset: 0, exitCode: null };
        this._currentProcess = null;
    }

    private isGradleProject(): boolean {
        const cwd = process.cwd();
        const detection = new ProjectDetection().detectAndroidProject(cwd);
        const hasGradleWrapper = fs.existsSync('gradlew');

        if (!detection.isAndroidProject || !hasGradleWrapper) {
            this._menuMessage =
                'No Android Gradle project detected. Launch Droid Forge from your project root,\n' +
                'or pass a path: droidforge /path/to/android/project';
            return false;
        }

        this._menuMessage = null;
        return true;
    }

    private async streamOutput(stream: ReadableStream<Uint8Array>): Promise<void> {
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let pending = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            pending += decoder.decode(value, { stream: true });

            const parts = pending.split('\n');
            pending = parts.pop()!;

            for (const line of parts) {
                if (line.trim()) {
                    this._output.lines.push(this.colorizeLine(line));
                }
            }

            this._output.scrollOffset = Math.max(0, this._output.lines.length - this._outputWindowSize);
            this._onOutputUpdate?.();
        }

        if (pending.trim()) {
            this._output.lines.push(this.colorizeLine(pending));
            this._onOutputUpdate?.();
        }
    }

    private colorizeLine(line: string): string {
        const trimmed = line.trim();

        if (trimmed.startsWith('WARNING:')) {
            return `\x1b[33m${line}\x1b[0m`;
        }
        if (trimmed.startsWith('> Task ')) {
            if (trimmed.endsWith('UP-TO-DATE')) {
                return `\x1b[36m${line}\x1b[0m`;
            }
            if (trimmed.endsWith('FROM-CACHE')) {
                return `\x1b[36m${line}\x1b[0m`;
            }
            if (trimmed.endsWith('SKIPPED')) {
                return `\x1b[90m${line}\x1b[0m`;
            }
            if (trimmed.endsWith('NO-SOURCE')) {
                return `\x1b[90m${line}\x1b[0m`;
            }
            if (trimmed.endsWith('FAILED')) {
                return `\x1b[31m${line}\x1b[0m`;
            }
            return `\x1b[32m${line}\x1b[0m`;
        }
        }
        if (trimmed.startsWith('BUILD SUCCESSFUL')) {
            return `\x1b[1;32m${line}\x1b[0m`;
        }
        if (trimmed.startsWith('BUILD FAILED')) {
            return `\x1b[1;31m${line}\x1b[0m`;
        }

        return line;
    }
}
