/**
 * Placeholder for future language tooling (e.g. Kotlin LSP) integration.
 * When the official Kotlin LSP is available, a real implementation can
 * spawn the LSP process and use WorkspaceService.getRootUri() for initialize.
 */

export interface DiagnosticSummary {
    errors: number;
    warnings: number;
    infos: number;
}

export interface ToolingService {
    getDiagnostics(): Promise<DiagnosticSummary>;
}

export class NoOpToolingService implements ToolingService {
    async getDiagnostics(): Promise<DiagnosticSummary> {
        return { errors: 0, warnings: 0, infos: 0 };
    }
}
