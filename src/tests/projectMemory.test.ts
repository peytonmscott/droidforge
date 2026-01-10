import { afterEach, describe, expect, test } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { ProjectDetection } from '../utilities/projectDetection';
import { getAndroidProjectName } from '../utilities/androidProjectName';
import { normalizeProjectPath, projectIdFromPath } from '../utilities/projectMemory';
import { Database } from '../data/repositories/Database';
import { ProjectRepository } from '../data/repositories/ProjectRepository';

let tempDir: string | null = null;

afterEach(async () => {
    if (tempDir) {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
        tempDir = null;
    }
    delete process.env.DROIDFORGE_CONFIG_DIR;
});

describe('project detection', () => {
    test('findAndroidProjectRoot walks up to settings.gradle', async () => {
        tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'droidforge-proj-'));
        const root = path.join(tempDir, 'androidapp');
        const nested = path.join(root, 'app', 'src');

        await fs.promises.mkdir(nested, { recursive: true });
        await fs.promises.writeFile(path.join(root, 'settings.gradle'), "rootProject.name = 'MyApp'\n");

        const detection = new ProjectDetection();
        expect(detection.findAndroidProjectRoot(nested)).toBe(root);
    });

    test('findAndroidProjectRoot returns null when not Android', async () => {
        tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'droidforge-proj-'));
        const detection = new ProjectDetection();
        expect(detection.findAndroidProjectRoot(tempDir)).toBeNull();
    });
});

describe('project naming', () => {
    test('reads rootProject.name from settings.gradle', async () => {
        tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'droidforge-proj-'));
        const root = path.join(tempDir, 'androidapp');
        await fs.promises.mkdir(root, { recursive: true });
        await fs.promises.writeFile(path.join(root, 'settings.gradle.kts'), 'rootProject.name = "CoolApp"\n');

        expect(getAndroidProjectName(root)).toBe('CoolApp');
    });
});

describe('project memory', () => {
    test('projectIdFromPath is stable for resolved paths', () => {
        const a = projectIdFromPath('/tmp/foo');
        const b = projectIdFromPath('/tmp/foo/..//foo');
        expect(a).toBe(b);
    });

    test('projects are ordered by updated_at desc', async () => {
        tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'droidforge-proj-'));
        process.env.DROIDFORGE_CONFIG_DIR = tempDir;

        const db = new Database(path.join(tempDir, 'droidforge.db'));
        const repo = new ProjectRepository(db);

        const now = new Date();
        const older = new Date(now.getTime() - 60_000);

        const projectAPath = normalizeProjectPath(path.join(tempDir, 'A'));
        const projectBPath = normalizeProjectPath(path.join(tempDir, 'B'));

        await repo.saveProject({
            id: projectIdFromPath(projectAPath),
            name: 'A',
            path: projectAPath,
            status: 'active',
            createdAt: older,
            updatedAt: older,
        });

        await repo.saveProject({
            id: projectIdFromPath(projectBPath),
            name: 'B',
            path: projectBPath,
            status: 'active',
            createdAt: now,
            updatedAt: now,
        });

        const all = await repo.getAllProjects();
        expect(all[0]?.name).toBe('B');
        expect(all[1]?.name).toBe('A');

        db.close();
    });
});
