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
