import fs from 'fs';
import path from 'path';

export function getAndroidProjectName(projectRoot: string): string {
    const settingsCandidates = ['settings.gradle.kts', 'settings.gradle'];

    for (const settingsFile of settingsCandidates) {
        const filePath = path.join(projectRoot, settingsFile);
        if (!fs.existsSync(filePath)) continue;

        try {
            const content = fs.readFileSync(filePath, 'utf8');

            // Groovy: rootProject.name = 'MyApp'
            // Kotlin: rootProject.name = "MyApp"
            const match = content.match(/rootProject\.name\s*=\s*['"]([^'"]+)['"]/);
            if (match?.[1]) {
                const name = match[1].trim();
                if (name.length > 0) return name;
            }
        } catch {
            // ignore
        }
    }

    return path.basename(projectRoot);
}

/**
 * Finds the Android applicationId (e.g. `com.example.app`) by scanning module
 * build files. Prefers `applicationId` over `namespace` so a library module's
 * namespace doesn't shadow the app module. Returns null when not found.
 */
export function getAndroidApplicationId(projectRoot: string): string | null {
    const buildFiles: string[] = [];
    const candidates = ['build.gradle.kts', 'build.gradle'];

    for (const candidate of candidates) {
        const rootFile = path.join(projectRoot, candidate);
        if (fs.existsSync(rootFile)) buildFiles.push(rootFile);
    }

    try {
        for (const entry of fs.readdirSync(projectRoot, { withFileTypes: true })) {
            if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
            for (const candidate of candidates) {
                const moduleFile = path.join(projectRoot, entry.name, candidate);
                if (fs.existsSync(moduleFile)) buildFiles.push(moduleFile);
            }
        }
    } catch {
        // Unreadable project dir - fall through with what we have
    }

    const patterns = [
        /applicationId\s*=\s*['"]([^'"]+)['"]/,
        /applicationId\s+['"]([^'"]+)['"]/,
        /namespace\s*=\s*['"]([^'"]+)['"]/,
        /namespace\s+['"]([^'"]+)['"]/,
    ];

    for (const pattern of patterns) {
        for (const file of buildFiles) {
            try {
                const match = fs.readFileSync(file, 'utf8').match(pattern);
                if (match?.[1]) return match[1];
            } catch {
                // ignore unreadable files
            }
        }
    }

    return null;
}
