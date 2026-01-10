import crypto from 'crypto';
import path from 'path';

export function normalizeProjectPath(projectPath: string): string {
    return path.resolve(projectPath);
}

export function projectIdFromPath(projectPath: string): string {
    const normalized = normalizeProjectPath(projectPath);
    return crypto.createHash('sha1').update(normalized).digest('hex');
}
