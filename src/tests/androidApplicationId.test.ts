import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { getAndroidApplicationId } from '../utilities/androidProjectName';

let tmpDir: string;

beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'droidforge-appid-'));
});

afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('getAndroidApplicationId', () => {
    test('reads applicationId from a module build.gradle.kts', () => {
        const appDir = path.join(tmpDir, 'app');
        fs.mkdirSync(appDir);
        fs.writeFileSync(
            path.join(appDir, 'build.gradle.kts'),
            'android {\n    defaultConfig {\n        applicationId = "com.example.myapp"\n    }\n}\n'
        );
        expect(getAndroidApplicationId(tmpDir)).toBe('com.example.myapp');
    });

    test('reads Groovy applicationId without equals sign', () => {
        const appDir = path.join(tmpDir, 'app');
        fs.mkdirSync(appDir);
        fs.writeFileSync(
            path.join(appDir, 'build.gradle'),
            "android {\n    defaultConfig {\n        applicationId 'com.example.groovy'\n    }\n}\n"
        );
        expect(getAndroidApplicationId(tmpDir)).toBe('com.example.groovy');
    });

    test('prefers applicationId over a library namespace', () => {
        const libDir = path.join(tmpDir, 'core');
        const appDir = path.join(tmpDir, 'app');
        fs.mkdirSync(libDir);
        fs.mkdirSync(appDir);
        fs.writeFileSync(
            path.join(libDir, 'build.gradle.kts'),
            'android {\n    namespace = "com.example.corelib"\n}\n'
        );
        fs.writeFileSync(
            path.join(appDir, 'build.gradle.kts'),
            'android {\n    defaultConfig {\n        applicationId = "com.example.realapp"\n    }\n}\n'
        );
        expect(getAndroidApplicationId(tmpDir)).toBe('com.example.realapp');
    });

    test('falls back to namespace when no applicationId exists', () => {
        const appDir = path.join(tmpDir, 'app');
        fs.mkdirSync(appDir);
        fs.writeFileSync(
            path.join(appDir, 'build.gradle.kts'),
            'android {\n    namespace = "com.example.namespaceonly"\n}\n'
        );
        expect(getAndroidApplicationId(tmpDir)).toBe('com.example.namespaceonly');
    });

    test('returns null for non-Android projects', () => {
        expect(getAndroidApplicationId(tmpDir)).toBeNull();
    });
});
