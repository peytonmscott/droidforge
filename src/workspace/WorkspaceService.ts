import path from 'path';
import { ProjectDetection, type DetectionResult } from '../utilities/projectDetection';

/**
 * Single source of truth for the current workspace (cwd, project root, Android detection).
 * Created once at startup after process.chdir to the detected project root.
 * Used by ViewModels, theme logic, and future LSP/tooling integration.
 */
export class WorkspaceService {
    private _cwd: string;
    private _detection: DetectionResult;
    private readonly _detector = new ProjectDetection();

    constructor(cwd: string) {
        this._cwd = path.resolve(cwd);
        this._detection = this._detector.detectAndroidProject(this._cwd);
    }

    /** Update current workspace to a new cwd (e.g. after opening another project from the ledger). */
    updateCwd(cwd: string): void {
        this._cwd = path.resolve(cwd);
        this._detection = this._detector.detectAndroidProject(this._cwd);
    }

    /** Current working directory (resolved). */
    getCwd(): string {
        return this._cwd;
    }

    /** Android/Gradle project root if detected, otherwise null. */
    getRoot(): string | null {
        return this._detection.projectRoot;
    }

    /** Full detection result (isAndroidProject, projectType, confidence). */
    getDetection(): DetectionResult {
        return this._detection;
    }

    /** File URI for the project root (e.g. for LSP initialize rootUri). */
    getRootUri(): string | null {
        const root = this._detection.projectRoot;
        if (!root) return null;
        return pathToFileUri(root);
    }

    get isAndroidProject(): boolean {
        return this._detection.isAndroidProject;
    }
}

function pathToFileUri(filePath: string): string {
    const normalized = path.resolve(filePath).replace(/\\/g, '/');
    const withLeading = normalized.startsWith('/') ? normalized : `/${normalized}`;
    return `file://${withLeading}`;
}
