import type { Subprocess } from 'bun';
import type { AdbService } from '../adb';
import { parseLogcatLine, type LogcatLine, type LogLevel } from '../utilities/logcatParser';

export type LogcatState = 'idle' | 'running' | 'paused' | 'error';

export interface LogcatOutput {
    lines: LogcatLine[];
    scrollOffset: number;
    exitCode: number | null;
}

export interface LogcatConfig {
    deviceId?: string;
    packageName?: string;
    logLevel?: LogLevel;
}

export class LogcatViewModel {
    private _state: LogcatState = 'idle';
    private _output: LogcatOutput = { lines: [], scrollOffset: 0, exitCode: null };
    private _currentProcess: Subprocess | null = null;
    private _onOutputUpdate: (() => void) | null = null;
    private _outputWindowSize = 20;
    private _filterText = '';
    private _maxLines = 5000;
    private _config: LogcatConfig = {};

    constructor(private readonly _adb: AdbService) {}

    setOutputUpdateCallback(callback: () => void): void {
        this._onOutputUpdate = callback;
    }

    setOutputWindowSize(size: number): void {
        this._outputWindowSize = size;
    }

    get state(): LogcatState {
        return this._state;
    }

    get output(): LogcatOutput {
        return this._output;
    }

    setConfig(config: LogcatConfig): void {
        this._config = config;
    }

    async startStream(): Promise<void> {
        if (this._state === 'running') return;

        const { deviceId, packageName, logLevel = 'V' } = this._config;
        if (!deviceId) {
            this._state = 'error';
            this._onOutputUpdate?.();
            return;
        }

        const args: string[] = ['-v', 'threadtime'];
        
        if (packageName) {
            const pid = await this._adb.getPackagePid(deviceId, packageName);
            if (pid) {
                args.push('--pid', String(pid));
            }
        }

        args.push(`*:${logLevel}`);

        this._state = 'running';
        this._output = { lines: [], scrollOffset: 0, exitCode: null };
        this._onOutputUpdate?.();

        this._currentProcess = this._adb.spawnLogcat(deviceId, args);
        void this.streamOutput(this._currentProcess.stdout as ReadableStream<Uint8Array>);
        void this.streamOutput(this._currentProcess.stderr as ReadableStream<Uint8Array>);
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
            pending = parts.pop() ?? '';

            for (const line of parts) {
                if (line.trim() && this._state !== 'paused') {
                    this.addLine(line);
                }
            }

            this._onOutputUpdate?.();
        }
    }

    private addLine(rawLine: string): void {
        const parsed = parseLogcatLine(rawLine);
        this._output.lines.push(parsed);

        if (this._output.lines.length > this._maxLines) {
            const excess = this._output.lines.length - this._maxLines;
            this._output.lines.splice(0, excess);
            this._output.scrollOffset = Math.max(0, this._output.scrollOffset - excess);
        }

        this._output.scrollOffset = Math.max(0, this._output.lines.length - this._outputWindowSize);
    }

    pauseStream(): void {
        this._state = 'paused';
        this._onOutputUpdate?.();
    }

    resumeStream(): void {
        this._state = 'running';
        this._onOutputUpdate?.();
    }

    stopStream(): void {
        if (this._currentProcess) {
            this._currentProcess.kill();
            this._currentProcess = null;
        }
        this._state = 'idle';
        this._onOutputUpdate?.();
    }

    clearBuffer(): void {
        this._output.lines = [];
        this._output.scrollOffset = 0;
        this._onOutputUpdate?.();
    }

    scrollUp(lines = 1): void {
        this._output.scrollOffset = Math.max(0, this._output.scrollOffset - lines);
        this._onOutputUpdate?.();
    }

    scrollDown(lines = 1): void {
        const maxOffset = Math.max(0, this._output.lines.length - this._outputWindowSize);
        this._output.scrollOffset = Math.min(maxOffset, this._output.scrollOffset + lines);
        this._onOutputUpdate?.();
    }

    pageUp(): void {
        this.scrollUp(this._outputWindowSize);
    }

    pageDown(): void {
        this.scrollDown(this._outputWindowSize);
    }

    scrollToTop(): void {
        this._output.scrollOffset = 0;
        this._onOutputUpdate?.();
    }

    scrollToBottom(): void {
        this._output.scrollOffset = Math.max(0, this._output.lines.length - this._outputWindowSize);
        this._onOutputUpdate?.();
    }

    getVisibleLines(): LogcatLine[] {
        return this._output.lines.slice(
            this._output.scrollOffset,
            this._output.scrollOffset + this._outputWindowSize
        );
    }

    getOutputText(): string {
        return this._output.lines.map(l => l.raw).join('\n');
    }
}
