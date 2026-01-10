// Pseudo-code approach
// function isAndroidProject(dir: string): boolean {
//   // 1. Check for settings.gradle (most reliable)
//   if (exists('settings.gradle') || exists('settings.gradle.kts')) {
//     // 2. Verify it's Android by checking for android plugin in build files
//     return hasAndroidPlugin('build.gradle') || hasAndroidPlugin('app/build.gradle')
//   }
//   return false
// }

export class ProjectDetection {

    isAndroidProject(dir: string): string {
        const currentDir = dir

        return currentDir
    }


    detectAndroidProject(dir: string): DetectionResult {
        const fs = require('fs')
        const path = require('path')
        const currentDir = dir || process.cwd();
        // 1. Check for settings file (minimum requirement)
        const settingsFiles = ['settings.gradle', 'settings.gradle.kts'];
        const hasSettings = settingsFiles.some(f =>
            fs.existsSync(path.join(currentDir, f))
        );
        if (!hasSettings) {
            return { isAndroidProject: false, confidence: 'high' };
        }
        // 2. Define all detection strategies
        const androidPlugins = [
            'com.android.application',
            'com.android.library',
            'com.android.dynamic-feature'
        ];
        const buildFiles = [
            'build.gradle',
            'build.gradle.kts',
            'app/build.gradle',
            'app/build.gradle.kts'
        ];
        const versionCatalog = 'gradle/libs.versions.toml';
        let foundAndroidPlugin = false;
        let projectType: 'application' | 'library' | 'unknown' = 'unknown';
        // 3. Check version catalog first (most reliable for modern projects)
        const tomlPath = path.join(currentDir, versionCatalog);
        if (fs.existsSync(tomlPath)) {
            const content = fs.readFileSync(tomlPath, 'utf8');
            for (const plugin of androidPlugins) {
                // Matches: id = "com.android.application"
                if (content.includes(`id = "${plugin}"`)) {
                    foundAndroidPlugin = true;
                    projectType = plugin.includes('application') ? 'application' :
                        plugin.includes('library') ? 'library' : 'unknown';
                    break;
                }
            }
        }
        // 4. Check build files if not found in version catalog
        if (!foundAndroidPlugin) {
            for (const file of buildFiles) {
                const filePath = path.join(currentDir, file);
                if (!fs.existsSync(filePath)) continue;
                const content = fs.readFileSync(filePath, 'utf8');
                // Strategy A: Direct plugin declaration (Groovy/Kotlin DSL)
                // Matches: 'com.android.application', "com.android.application", id("com.android.application")
                for (const plugin of androidPlugins) {
                    if (
                        content.includes(`'${plugin}'`) ||
                        content.includes(`"${plugin}"`) ||
                        content.includes(`id("${plugin}")`)
                    ) {
                        foundAndroidPlugin = true;
                        projectType = plugin.includes('application') ? 'application' :
                            plugin.includes('library') ? 'library' : 'unknown';
                        break;
                    }
                }
                // Strategy B: Version catalog alias reference
                // Matches: alias(libs.plugins.android.application), alias(libs.plugins.android.library)
                if (!foundAndroidPlugin) {
                    const aliasPatterns = [
                        { pattern: /alias\(libs\.plugins\.android\.application\)/, type: 'application' as const },
                        { pattern: /alias\(libs\.plugins\.android\.library\)/, type: 'library' as const },
                        { pattern: /alias\(libs\.plugins\.com\.android\.application\)/, type: 'application' as const },
                        { pattern: /alias\(libs\.plugins\.com\.android\.library\)/, type: 'library' as const }
                    ];
                    for (const { pattern, type } of aliasPatterns) {
                        if (pattern.test(content)) {
                            foundAndroidPlugin = true;
                            projectType = type;
                            break;
                        }
                    }
                }
                if (foundAndroidPlugin) break;
            }
        }
        return {
            isAndroidProject: foundAndroidPlugin || hasSettings,
            projectType,
            confidence: foundAndroidPlugin ? 'high' : hasSettings ? 'medium' : 'low'
        };
    }
}

interface DetectionResult {
    isAndroidProject: boolean;
    projectType?: 'application' | 'library' | 'unknown';
    confidence: 'high' | 'medium' | 'low';
}
