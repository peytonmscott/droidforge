import fs from 'fs';

import type { Subprocess } from 'bun';

import type { MenuOption } from '../data/schemas';
import { ProjectDetection } from '../utilities/projectDetection';

export type ActionState = 'idle' | 'running' | 'completed' | 'error';
export type ActionsMenuState = 'loading' | 'ready' | 'not-gradle' | 'error';

export interface ActionOutput {
    lines: string[];
    scrollOffset: number;
    exitCode: number | null;
}

interface GradleTask {
    name: string;
    description: string;
}

const SHOW_ALL_TASKS_VALUE = '__show-all-tasks__';
const SHOW_CURATED_TASKS_VALUE = '__show-curated-tasks__';
const RETRY_TASK_DISCOVERY_VALUE = '__retry-task-discovery__';
const NO_GRADLE_VALUE = '__no-gradle__';

const CURATED_TASKS = [
    'assembleDebug',
    'installDebug',
    'test',
    'connectedAndroidTest',
    'lint',
    'check',
    'build',
    'clean',
    'assembleRelease',
] as const;

type CuratedTaskName = (typeof CURATED_TASKS)[number];

const CURATED_TASK_LABELS: Record<CuratedTaskName, { label: string; fallbackDescription: string }> = {
    assembleDebug: { label: 'Assemble Debug', fallbackDescription: 'Builds the debug APK/AAB' },
    installDebug: { label: 'Install Debug', fallbackDescription: 'Installs the debug build on a connected device' },
    test: { label: 'Unit Tests', fallbackDescription: 'Runs JVM unit tests' },
    connectedAndroidTest: { label: 'Instrumented Tests', fallbackDescription: 'Runs connected Android tests' },
    lint: { label: 'Lint', fallbackDescription: 'Runs Android lint checks' },
    check: { label: 'Check', fallbackDescription: 'Runs verification tasks (tests, lint, etc.)' },
    build: { label: 'Build', fallbackDescription: 'Builds the project' },
    clean: { label: 'Clean', fallbackDescription: 'Cleans build outputs' },
    assembleRelease: { label: 'Assemble Release', fallbackDescription: 'Builds the release APK/AAB' },
};

export class ActionsViewModel {
    private static taskCache = new Map<string, GradleTask[]>();

    private _menuState: ActionsMenuState = 'loading';
    private _menuMessage: string | null = null;
    private _tasks: GradleTask[] = [];
    private _showAllTasks = false;
    private _tasksLoadPromise: Promise<void> | null = null;
    private _onMenuUpdate: (() => void) | null = null;

    private _state: ActionState = 'idle';
    private _output: ActionOutput = { lines: [], scrollOffset: 0, exitCode: null };
    private _outputWindowSize = 20;
    private _currentProcess: Subprocess | null = null;
    private _onOutputUpdate: (() => void) | null = null;

    constructor() {
        void this.loadGradleTasks();
    }

    get state(): ActionState {
        return this._state;
    }

    get output(): ActionOutput {
        return this._output;
    }

    get menuState(): ActionsMenuState {
        return this._menuState;
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
        switch (value) {
            case SHOW_ALL_TASKS_VALUE:
                this._showAllTasks = true;
                this.notifyMenuUpdate();
                return { action: 'none' };
            case SHOW_CURATED_TASKS_VALUE:
                this._showAllTasks = false;
                this.notifyMenuUpdate();
                return { action: 'none' };
            case RETRY_TASK_DISCOVERY_VALUE:
                this._tasksLoadPromise = null;
                void this.loadGradleTasks();
                return { action: 'none' };
            case NO_GRADLE_VALUE:
                return { action: 'none' };
            default:
                if (value.startsWith('__')) {
                    return { action: 'none' };
                }
                return { action: 'navigate', command: value };
        }
    }

    getMenuOptions(): MenuOption[] {
        switch (this._menuState) {
            case 'loading':
                return [{
                    name: 'Loading Gradle tasks…',
                    description: 'Please wait',
                    value: '__loading__',
                }];
            case 'not-gradle':
                return [{
                    name: 'No Gradle project detected',
                    description: 'Launch Droid Forge inside an Android Gradle project',
                    value: NO_GRADLE_VALUE,
                }];
            case 'error':
                return [{
                    name: 'Failed to load Gradle tasks',
                    description: 'Select to retry task discovery',
                    value: RETRY_TASK_DISCOVERY_VALUE,
                }];
            case 'ready': {
                const taskOptions = this._showAllTasks
                    ? this.buildAllTaskOptions()
                    : this.buildCuratedTaskOptions();

                const toggleOption: MenuOption = this._showAllTasks
                    ? {
                        name: 'Show curated tasks',
                        description: 'Return to the recommended shortlist',
                        value: SHOW_CURATED_TASKS_VALUE,
                    }
                    : {
                        name: 'Show all tasks',
                        description: 'List every task from `./gradlew tasks --all`',
                        value: SHOW_ALL_TASKS_VALUE,
                    };

                return [...taskOptions, toggleOption];
            }
        }
    }

    async loadGradleTasks(): Promise<void> {
        if (this._tasksLoadPromise) return this._tasksLoadPromise;

        this._tasksLoadPromise = (async () => {
            this._menuState = 'loading';
            this._menuMessage = null;
            this.notifyMenuUpdate();

            const cwd = process.cwd();
            const cachedTasks = ActionsViewModel.taskCache.get(cwd);
            if (cachedTasks) {
                this._tasks = cachedTasks;
                this._menuState = 'ready';
                this._menuMessage = null;
                this.notifyMenuUpdate();
                return;
            }

            const detection = new ProjectDetection().detectAndroidProject(cwd);
            const hasGradleWrapper = fs.existsSync('gradlew');

            if (!detection.isAndroidProject || !hasGradleWrapper) {
                this._menuState = 'not-gradle';
                this._menuMessage =
                    'No Android Gradle project detected. Launch Droid Forge from your project root,\n' +
                    'or pass a path: bun dev /path/to/android/project';
                this._tasks = [];
                this.notifyMenuUpdate();
                return;
            }

            const proc = Bun.spawn(['./gradlew', 'tasks', '--all', '--console=plain'], {
                cwd,
                stdout: 'pipe',
                stderr: 'pipe',
            });

            const stdoutPromise = new Response(proc.stdout).text();
            const stderrPromise = new Response(proc.stderr).text();
            const exitCode = await proc.exited;
            const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);

            if (exitCode !== 0) {
                this._menuState = 'error';
                this._menuMessage = (stderr || stdout).trim() || 'Gradle task discovery failed.';
                this._tasks = [];
                this.notifyMenuUpdate();
                return;
            }

            const tasks = this.parseGradleTasks(stdout);
            this._tasks = tasks;
            ActionsViewModel.taskCache.set(cwd, tasks);

            this._menuState = 'ready';
            this._menuMessage = null;
            this.notifyMenuUpdate();
        })();

        return this._tasksLoadPromise;
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
                'Launch Droid Forge from your project root, or pass a path: bun dev /path/to/android/project',
            );
            this._output.exitCode = 1;
            this._state = 'error';
            this._currentProcess = null;
            this._onOutputUpdate?.();
            return;
        }

        try {
            const proc = Bun.spawn(['./gradlew', command], {
                cwd,
                stdout: 'pipe',
                stderr: 'pipe',
            });

            this._currentProcess = proc;

            // Stream stdout/stderr
            this.streamOutput(proc.stdout);
            this.streamOutput(proc.stderr);

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

    private notifyMenuUpdate(): void {
        this._onMenuUpdate?.();
    }

    private buildTaskIndex(): Map<string, GradleTask> {
        return new Map(this._tasks.map((t) => [t.name, t]));
    }

    private buildCuratedTaskOptions(): MenuOption[] {
        const index = this.buildTaskIndex();
        const available = new Set(index.keys());

        const options: MenuOption[] = [];

        for (const baseTask of CURATED_TASKS) {
            const resolved = this.resolvePreferredTaskName(baseTask, available);
            if (!resolved) continue;

            const task = index.get(resolved);
            const meta = CURATED_TASK_LABELS[baseTask];

            const resolvedDescription = task?.description?.trim();
            const suffix = resolvedDescription ? ` — ${resolvedDescription}` : ` — ${meta.fallbackDescription}`;

            options.push({
                name: meta.label,
                description: `${resolved}${suffix}`,
                value: resolved,
            });
        }

        if (options.length === 0) {
            options.push({
                name: 'No common tasks found',
                description: 'Select “Show all tasks” to browse everything',
                value: '__no-curated__',
            });
        }

        return options;
    }

    private buildAllTaskOptions(): MenuOption[] {
        const index = this.buildTaskIndex();
        return [...index.values()]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((task) => ({
                name: task.name,
                description: task.description,
                value: task.name,
            }));
    }

    private resolvePreferredTaskName(baseTask: string, available: Set<string>): string | null {
        const appTask = `:app:${baseTask}`;
        if (available.has(appTask)) return appTask;

        // Some Gradle output formats omit the leading ':' (e.g. 'app:assembleDebug').
        const legacyAppTask = `app:${baseTask}`;
        if (available.has(legacyAppTask)) return legacyAppTask;

        if (available.has(baseTask)) return baseTask;
        return null;
    }

    private normalizeGradleTaskName(name: string): string {
        const trimmed = name.trim();
        if (!trimmed) return '';

        // Gradle task paths are commonly written like ':app:assembleDebug'.
        // Some environments/output formats can emit 'app:assembleDebug' instead.
        if (trimmed.includes(':') && !trimmed.startsWith(':')) {
            return `:${trimmed}`;
        }

        return trimmed;
    }

    private parseGradleTasks(output: string): GradleTask[] {
        const tasksByName = new Map<string, GradleTask>();

        for (const rawLine of output.split('\n')) {
            const line = rawLine.trim();
            if (!line || line.startsWith('>')) continue;

            const match = line.match(/^([A-Za-z0-9:_-]+)\s+-\s+(.+)$/);
            if (!match) continue;

            const rawName = match[1] ?? '';
            const description = match[2] ?? '';

            const name = this.normalizeGradleTaskName(rawName);
            if (!name || tasksByName.has(name)) continue;

            tasksByName.set(name, {
                name,
                description: description.trim(),
            });
        }

        return [...tasksByName.values()];
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
                    this._output.lines.push(line);
                }
            }

            // Auto-scroll to bottom while running
            this._output.scrollOffset = Math.max(0, this._output.lines.length - this._outputWindowSize);
            this._onOutputUpdate?.();
        }

        // Flush any remaining partial line
        if (pending.trim()) {
            this._output.lines.push(pending);
            this._onOutputUpdate?.();
        }
    }
}
