#!/usr/bin/env bun
// @bun
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: (newValue) => all[name] = () => newValue
    });
};
var __esm = (fn, res) => () => (fn && (res = fn(fn = 0)), res);
var __require = import.meta.require;

// src/utilities/paths.ts
import os from "os";
import path from "path";
function resolveConfigDir(options) {
  const { platform, env, homedir } = options;
  const pathImpl = platform === "win32" ? path.win32 : path.posix;
  const overrideDir = env.DROIDFORGE_CONFIG_DIR;
  if (overrideDir && overrideDir.trim().length > 0) {
    return pathImpl.resolve(overrideDir);
  }
  if (platform === "win32") {
    const appData = env.APPDATA;
    if (appData && appData.trim().length > 0) {
      return pathImpl.join(appData, "droidforge");
    }
    return pathImpl.join(homedir, "AppData", "Roaming", "droidforge");
  }
  const xdgConfigHome = env.XDG_CONFIG_HOME;
  const baseDir = xdgConfigHome && xdgConfigHome.trim().length > 0 ? xdgConfigHome : pathImpl.join(homedir, ".config");
  return pathImpl.join(baseDir, "droidforge");
}
function getConfigDir() {
  return resolveConfigDir({
    platform: process.platform,
    env: process.env,
    homedir: os.homedir()
  });
}
function getConfigPath() {
  return path.join(getConfigDir(), "droidforge.json");
}
function getDbPath() {
  return path.join(getConfigDir(), "droidforge.db");
}
function getLegacyDbPath() {
  return path.join(os.homedir(), ".droidforge", "data.db");
}
var init_paths = () => {};

// src/config/config.ts
import fs from "fs";
import path2 from "path";
function getDefaultConfig() {
  return {
    version: 1,
    theme: {
      primaryColor: "#3b82f6",
      secondaryColor: "#1e40af",
      backgroundColor: "transparent",
      textColor: "#E2E8F0",
      borderColor: "#475569"
    },
    preferences: {
      themeMode: "system",
      themeId: "opencode",
      themeIdDark: "opencode",
      themeIdLight: "opencode",
      language: "English",
      autoSave: true,
      notifications: true
    }
  };
}
function safeJsonParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}
async function ensureConfigDirExists() {
  await fs.promises.mkdir(getConfigDir(), { recursive: true });
}
async function loadConfig() {
  const configPath = getConfigPath();
  try {
    const raw = await fs.promises.readFile(configPath, "utf8");
    const parsed = safeJsonParse(raw);
    if (!parsed || typeof parsed !== "object") {
      return getDefaultConfig();
    }
    const asAny = parsed;
    const defaults = getDefaultConfig();
    return {
      version: 1,
      theme: { ...defaults.theme, ...asAny.theme ?? {} },
      preferences: { ...defaults.preferences, ...asAny.preferences ?? {} }
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return getDefaultConfig();
    }
    throw error;
  }
}
async function atomicWriteJson(filePath, data) {
  const dir = path2.dirname(filePath);
  await fs.promises.mkdir(dir, { recursive: true });
  const tmpPath = path2.join(dir, `.${path2.basename(filePath)}.${process.pid}.tmp`);
  const content = JSON.stringify(data, null, 2) + `
`;
  await fs.promises.writeFile(tmpPath, content, "utf8");
  try {
    await fs.promises.rename(tmpPath, filePath);
  } catch (error) {
    if (error?.code === "EEXIST" || error?.code === "EPERM") {
      await fs.promises.unlink(filePath).catch(() => {
        return;
      });
      await fs.promises.rename(tmpPath, filePath);
      return;
    }
    throw error;
  }
}
async function saveConfig(config) {
  const configPath = getConfigPath();
  await atomicWriteJson(configPath, config);
}
async function ensureConfigFileExists() {
  await ensureConfigDirExists();
  const configPath = getConfigPath();
  try {
    await fs.promises.access(configPath, fs.constants.F_OK);
  } catch {
    const defaults = getDefaultConfig();
    await saveConfig(defaults);
    return defaults;
  }
  const config = await loadConfig();
  await saveConfig(config);
  return config;
}
async function updateConfig(patch) {
  const current = await ensureConfigFileExists();
  const next = {
    version: 1,
    theme: { ...current.theme, ...patch.theme ?? {} },
    preferences: { ...current.preferences, ...patch.preferences ?? {} }
  };
  await saveConfig(next);
  return next;
}
var init_config = __esm(() => {
  init_paths();
});

// src/bootstrap.ts
import fs2 from "fs";
import path3 from "path";
import sqlite3 from "sqlite3";
async function migrateDbFileIfNeeded(fromPath, toPath) {
  try {
    await fs2.promises.access(fromPath, fs2.constants.F_OK);
  } catch {
    return false;
  }
  try {
    await fs2.promises.access(toPath, fs2.constants.F_OK);
    return false;
  } catch {}
  await fs2.promises.mkdir(path3.dirname(toPath), { recursive: true });
  try {
    await fs2.promises.rename(fromPath, toPath);
  } catch {
    await fs2.promises.copyFile(fromPath, toPath);
    await fs2.promises.unlink(fromPath).catch(() => {
      return;
    });
  }
  return true;
}
async function readSettingsFromSqlite(dbPath) {
  return new Promise((resolve) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        resolve(null);
      }
    });
    db.get("SELECT * FROM settings WHERE id = 1", (err, row) => {
      if (err || !row) {
        db.close();
        resolve(null);
        return;
      }
      try {
        const theme = JSON.parse(row.theme);
        const preferences = JSON.parse(row.preferences);
        db.close();
        resolve({ theme, preferences });
      } catch {
        db.close();
        resolve(null);
      }
    });
  });
}
async function bootstrap() {
  await ensureConfigDirExists();
  const configPath = path3.join(getConfigDir(), "droidforge.json");
  const hasConfig = await fs2.promises.access(configPath, fs2.constants.F_OK).then(() => true).catch(() => false);
  if (!hasConfig) {
    const legacyDbPath = getLegacyDbPath();
    const legacySettings = await readSettingsFromSqlite(legacyDbPath);
    if (legacySettings) {
      await saveConfig({
        version: 1,
        theme: legacySettings.theme,
        preferences: legacySettings.preferences
      });
    } else {
      await saveConfig(getDefaultConfig());
    }
  } else {
    await ensureConfigFileExists();
  }
  await migrateDbFileIfNeeded(getLegacyDbPath(), getDbPath());
}
var init_bootstrap = __esm(() => {
  init_config();
  init_paths();
});

// src/data/repositories/Database.ts
import sqlite32 from "sqlite3";
import fs3 from "fs";
import path4 from "path";

class Database {
  db;
  constructor(dbPath = getDbPath()) {
    this.migrateLegacyDbIfNeeded(dbPath);
    const dir = path4.dirname(dbPath);
    if (!fs3.existsSync(dir)) {
      fs3.mkdirSync(dir, { recursive: true });
    }
    this.db = new sqlite32.Database(dbPath);
    this.initializeTables();
  }
  migrateLegacyDbIfNeeded(dbPath) {
    const legacyPath = getLegacyDbPath();
    if (legacyPath === dbPath)
      return;
    if (!fs3.existsSync(legacyPath))
      return;
    if (fs3.existsSync(dbPath))
      return;
    const dir = path4.dirname(dbPath);
    if (!fs3.existsSync(dir)) {
      fs3.mkdirSync(dir, { recursive: true });
    }
    try {
      fs3.renameSync(legacyPath, dbPath);
    } catch {
      fs3.copyFileSync(legacyPath, dbPath);
      try {
        fs3.unlinkSync(legacyPath);
      } catch {}
    }
  }
  initializeTables() {
    this.db.serialize(() => {
      this.db.run(`
                CREATE TABLE IF NOT EXISTS projects (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    path TEXT,
                    status TEXT NOT NULL,
                    description TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
      this.db.run("ALTER TABLE projects ADD COLUMN path TEXT", (err) => {
        const message = String(err?.message ?? "");
        if (err && !message.toLowerCase().includes("duplicate column name")) {
          console.warn("Failed to migrate projects.path column:", err);
        }
      });
      this.db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_path ON projects(path) WHERE path IS NOT NULL AND path != ''", (err) => {
        if (err) {
          console.warn("Failed to create idx_projects_path index:", err);
        }
      });
      this.db.run(`
                CREATE TABLE IF NOT EXISTS settings (
                    id INTEGER PRIMARY KEY DEFAULT 1,
                    theme TEXT,
                    preferences TEXT
                )
            `);
    });
  }
  getDb() {
    return this.db;
  }
  close() {
    this.db.close();
  }
}
var init_Database = __esm(() => {
  init_paths();
});

// src/data/repositories/ProjectRepository.ts
class ProjectRepository {
  db;
  constructor(db) {
    this.db = db;
  }
  async getProjectByPath(projectPath) {
    return new Promise((resolve, reject) => {
      this.db.getDb().get("SELECT * FROM projects WHERE path = ?", [projectPath], (err, row) => {
        if (err)
          reject(err);
        else if (row) {
          resolve({
            id: row.id,
            name: row.name,
            path: row.path ?? "",
            status: row.status,
            description: row.description,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at)
          });
        } else {
          resolve(null);
        }
      });
    });
  }
  async getAllProjects() {
    return new Promise((resolve, reject) => {
      this.db.getDb().all("SELECT * FROM projects ORDER BY updated_at DESC", (err, rows) => {
        if (err)
          reject(err);
        else
          resolve(rows.map((row) => ({
            id: row.id,
            name: row.name,
            path: row.path ?? "",
            status: row.status,
            description: row.description,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at)
          })).filter((project) => project.path.length > 0));
      });
    });
  }
  async getProjectById(id) {
    return new Promise((resolve, reject) => {
      this.db.getDb().get("SELECT * FROM projects WHERE id = ?", [id], (err, row) => {
        if (err)
          reject(err);
        else if (row) {
          resolve({
            id: row.id,
            name: row.name,
            path: row.path ?? "",
            status: row.status,
            description: row.description,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at)
          });
        } else {
          resolve(null);
        }
      });
    });
  }
  async saveProject(project) {
    return new Promise((resolve, reject) => {
      const projectPath = String(project.path ?? "").trim();
      if (!projectPath) {
        reject(new Error("Project path must be a non-empty string"));
        return;
      }
      const sql = `
                INSERT OR REPLACE INTO projects (id, name, path, status, description, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
      const params = [
        project.id,
        project.name,
        projectPath,
        project.status,
        project.description || null,
        project.createdAt.toISOString(),
        project.updatedAt.toISOString()
      ];
      this.db.getDb().run(sql, params, (err) => {
        if (err)
          reject(err);
        else
          resolve();
      });
    });
  }
  async deleteProject(id) {
    return new Promise((resolve, reject) => {
      this.db.getDb().run("DELETE FROM projects WHERE id = ?", [id], (err) => {
        if (err)
          reject(err);
        else
          resolve();
      });
    });
  }
}

// src/data/repositories/SettingsRepository.ts
class SettingsRepository {
  db;
  constructor(db) {
    this.db = db;
  }
  async getSettings() {
    return new Promise((resolve, reject) => {
      this.db.getDb().get("SELECT * FROM settings WHERE id = 1", (err, row) => {
        if (err)
          reject(err);
        else if (row) {
          resolve({
            theme: JSON.parse(row.theme),
            preferences: JSON.parse(row.preferences)
          });
        } else {
          resolve({
            theme: {
              primaryColor: "#3b82f6",
              secondaryColor: "#1e40af",
              backgroundColor: "transparent",
              textColor: "#E2E8F0",
              borderColor: "#475569"
            },
            preferences: {
              themeMode: "dark",
              language: "English",
              autoSave: true,
              notifications: true
            }
          });
        }
      });
    });
  }
  async saveSettings(settings) {
    return new Promise((resolve, reject) => {
      const sql = `
                INSERT OR REPLACE INTO settings (id, theme, preferences)
                VALUES (1, ?, ?)
            `;
      const params = [
        JSON.stringify(settings.theme),
        JSON.stringify(settings.preferences)
      ];
      this.db.getDb().run(sql, params, (err) => {
        if (err)
          reject(err);
        else
          resolve();
      });
    });
  }
}

// src/data/repositories/index.ts
var exports_repositories = {};
__export(exports_repositories, {
  SettingsRepository: () => SettingsRepository,
  ProjectRepository: () => ProjectRepository,
  Database: () => Database
});
var init_repositories = __esm(() => {
  init_Database();
});

// src/utilities/projectDetection.ts
class ProjectDetection {
  findAndroidProjectRoot(startDir) {
    const fs4 = __require("fs");
    const path5 = __require("path");
    let currentDir = path5.resolve(startDir || process.cwd());
    while (true) {
      const hasSettings = fs4.existsSync(path5.join(currentDir, "settings.gradle")) || fs4.existsSync(path5.join(currentDir, "settings.gradle.kts"));
      if (hasSettings)
        return currentDir;
      const parentDir = path5.dirname(currentDir);
      if (parentDir === currentDir)
        return null;
      currentDir = parentDir;
    }
  }
  detectAndroidProject(dir) {
    const fs4 = __require("fs");
    const path5 = __require("path");
    const projectRoot = this.findAndroidProjectRoot(dir || process.cwd());
    if (!projectRoot) {
      return { isAndroidProject: false, confidence: "high", projectRoot: null };
    }
    const androidPlugins = [
      "com.android.application",
      "com.android.library",
      "com.android.dynamic-feature"
    ];
    const buildFiles = [
      "build.gradle",
      "build.gradle.kts",
      "app/build.gradle",
      "app/build.gradle.kts"
    ];
    const versionCatalog = "gradle/libs.versions.toml";
    let foundAndroidPlugin = false;
    let projectType = "unknown";
    const tomlPath = path5.join(projectRoot, versionCatalog);
    if (fs4.existsSync(tomlPath)) {
      const content = fs4.readFileSync(tomlPath, "utf8");
      for (const plugin of androidPlugins) {
        if (content.includes(`id = "${plugin}"`)) {
          foundAndroidPlugin = true;
          projectType = plugin.includes("application") ? "application" : plugin.includes("library") ? "library" : "unknown";
          break;
        }
      }
    }
    if (!foundAndroidPlugin) {
      for (const file of buildFiles) {
        const filePath = path5.join(projectRoot, file);
        if (!fs4.existsSync(filePath))
          continue;
        const content = fs4.readFileSync(filePath, "utf8");
        for (const plugin of androidPlugins) {
          if (content.includes(`'${plugin}'`) || content.includes(`"${plugin}"`) || content.includes(`id("${plugin}")`)) {
            foundAndroidPlugin = true;
            projectType = plugin.includes("application") ? "application" : plugin.includes("library") ? "library" : "unknown";
            break;
          }
        }
        if (!foundAndroidPlugin) {
          const aliasPatterns = [
            { pattern: /alias\(libs\.plugins\.android\.application\)/, type: "application" },
            { pattern: /alias\(libs\.plugins\.android\.library\)/, type: "library" },
            { pattern: /alias\(libs\.plugins\.com\.android\.application\)/, type: "application" },
            { pattern: /alias\(libs\.plugins\.com\.android\.library\)/, type: "library" }
          ];
          for (const { pattern, type } of aliasPatterns) {
            if (pattern.test(content)) {
              foundAndroidPlugin = true;
              projectType = type;
              break;
            }
          }
        }
        if (foundAndroidPlugin)
          break;
      }
    }
    return {
      isAndroidProject: foundAndroidPlugin || Boolean(projectRoot),
      projectType,
      confidence: foundAndroidPlugin ? "high" : projectRoot ? "medium" : "low",
      projectRoot
    };
  }
}

// src/ui/theme/themes/aura.json
var aura_default;
var init_aura = __esm(() => {
  aura_default = {
    $schema: "https://opencode.ai/theme.json",
    defs: {
      darkBg: "#0f0f0f",
      darkBgPanel: "#15141b",
      darkBorder: "#2d2d2d",
      darkFgMuted: "#6d6d6d",
      darkFg: "#edecee",
      purple: "#a277ff",
      pink: "#f694ff",
      blue: "#82e2ff",
      red: "#ff6767",
      orange: "#ffca85",
      cyan: "#61ffca",
      green: "#9dff65"
    },
    theme: {
      primary: "purple",
      secondary: "pink",
      accent: "purple",
      error: "red",
      warning: "orange",
      success: "cyan",
      info: "purple",
      text: "darkFg",
      textMuted: "darkFgMuted",
      background: "darkBg",
      backgroundPanel: "darkBgPanel",
      backgroundElement: "darkBgPanel",
      border: "darkBorder",
      borderActive: "darkFgMuted",
      borderSubtle: "darkBorder",
      diffAdded: "cyan",
      diffRemoved: "red",
      diffContext: "darkFgMuted",
      diffHunkHeader: "darkFgMuted",
      diffHighlightAdded: "cyan",
      diffHighlightRemoved: "red",
      diffAddedBg: "#354933",
      diffRemovedBg: "#3f191a",
      diffContextBg: "darkBgPanel",
      diffLineNumber: "darkBorder",
      diffAddedLineNumberBg: "#162620",
      diffRemovedLineNumberBg: "#26161a",
      markdownText: "darkFg",
      markdownHeading: "purple",
      markdownLink: "pink",
      markdownLinkText: "purple",
      markdownCode: "cyan",
      markdownBlockQuote: "darkFgMuted",
      markdownEmph: "orange",
      markdownStrong: "purple",
      markdownHorizontalRule: "darkFgMuted",
      markdownListItem: "purple",
      markdownListEnumeration: "purple",
      markdownImage: "pink",
      markdownImageText: "purple",
      markdownCodeBlock: "darkFg",
      syntaxComment: "darkFgMuted",
      syntaxKeyword: "pink",
      syntaxFunction: "purple",
      syntaxVariable: "purple",
      syntaxString: "cyan",
      syntaxNumber: "green",
      syntaxType: "purple",
      syntaxOperator: "pink",
      syntaxPunctuation: "darkFg"
    }
  };
});

// src/ui/theme/themes/ayu.json
var ayu_default;
var init_ayu = __esm(() => {
  ayu_default = {
    $schema: "https://opencode.ai/theme.json",
    defs: {
      darkBg: "#0B0E14",
      darkBgAlt: "#0D1017",
      darkLine: "#11151C",
      darkPanel: "#0F131A",
      darkFg: "#BFBDB6",
      darkFgMuted: "#565B66",
      darkGutter: "#6C7380",
      darkTag: "#39BAE6",
      darkFunc: "#FFB454",
      darkEntity: "#59C2FF",
      darkString: "#AAD94C",
      darkRegexp: "#95E6CB",
      darkMarkup: "#F07178",
      darkKeyword: "#FF8F40",
      darkSpecial: "#E6B673",
      darkComment: "#ACB6BF",
      darkConstant: "#D2A6FF",
      darkOperator: "#F29668",
      darkAdded: "#7FD962",
      darkRemoved: "#F26D78",
      darkAccent: "#E6B450",
      darkError: "#D95757",
      darkIndentActive: "#6C7380"
    },
    theme: {
      primary: "darkEntity",
      secondary: "darkConstant",
      accent: "darkAccent",
      error: "darkError",
      warning: "darkSpecial",
      success: "darkAdded",
      info: "darkTag",
      text: "darkFg",
      textMuted: "darkFgMuted",
      background: "darkBg",
      backgroundPanel: "darkPanel",
      backgroundElement: "darkBgAlt",
      border: "darkGutter",
      borderActive: "darkIndentActive",
      borderSubtle: "darkLine",
      diffAdded: "darkAdded",
      diffRemoved: "darkRemoved",
      diffContext: "darkComment",
      diffHunkHeader: "darkComment",
      diffHighlightAdded: "darkString",
      diffHighlightRemoved: "darkMarkup",
      diffAddedBg: "#20303b",
      diffRemovedBg: "#37222c",
      diffContextBg: "darkPanel",
      diffLineNumber: "darkGutter",
      diffAddedLineNumberBg: "#1b2b34",
      diffRemovedLineNumberBg: "#2d1f26",
      markdownText: "darkFg",
      markdownHeading: "darkConstant",
      markdownLink: "darkEntity",
      markdownLinkText: "darkTag",
      markdownCode: "darkString",
      markdownBlockQuote: "darkSpecial",
      markdownEmph: "darkSpecial",
      markdownStrong: "darkFunc",
      markdownHorizontalRule: "darkFgMuted",
      markdownListItem: "darkEntity",
      markdownListEnumeration: "darkTag",
      markdownImage: "darkEntity",
      markdownImageText: "darkTag",
      markdownCodeBlock: "darkFg",
      syntaxComment: "darkComment",
      syntaxKeyword: "darkKeyword",
      syntaxFunction: "darkFunc",
      syntaxVariable: "darkEntity",
      syntaxString: "darkString",
      syntaxNumber: "darkConstant",
      syntaxType: "darkSpecial",
      syntaxOperator: "darkOperator",
      syntaxPunctuation: "darkFg"
    }
  };
});

// src/ui/theme/themes/catppuccin.json
var catppuccin_default;
var init_catppuccin = __esm(() => {
  catppuccin_default = {
    $schema: "https://opencode.ai/theme.json",
    defs: {
      lightRosewater: "#dc8a78",
      lightFlamingo: "#dd7878",
      lightPink: "#ea76cb",
      lightMauve: "#8839ef",
      lightRed: "#d20f39",
      lightMaroon: "#e64553",
      lightPeach: "#fe640b",
      lightYellow: "#df8e1d",
      lightGreen: "#40a02b",
      lightTeal: "#179299",
      lightSky: "#04a5e5",
      lightSapphire: "#209fb5",
      lightBlue: "#1e66f5",
      lightLavender: "#7287fd",
      lightText: "#4c4f69",
      lightSubtext1: "#5c5f77",
      lightSubtext0: "#6c6f85",
      lightOverlay2: "#7c7f93",
      lightOverlay1: "#8c8fa1",
      lightOverlay0: "#9ca0b0",
      lightSurface2: "#acb0be",
      lightSurface1: "#bcc0cc",
      lightSurface0: "#ccd0da",
      lightBase: "#eff1f5",
      lightMantle: "#e6e9ef",
      lightCrust: "#dce0e8",
      darkRosewater: "#f5e0dc",
      darkFlamingo: "#f2cdcd",
      darkPink: "#f5c2e7",
      darkMauve: "#cba6f7",
      darkRed: "#f38ba8",
      darkMaroon: "#eba0ac",
      darkPeach: "#fab387",
      darkYellow: "#f9e2af",
      darkGreen: "#a6e3a1",
      darkTeal: "#94e2d5",
      darkSky: "#89dceb",
      darkSapphire: "#74c7ec",
      darkBlue: "#89b4fa",
      darkLavender: "#b4befe",
      darkText: "#cdd6f4",
      darkSubtext1: "#bac2de",
      darkSubtext0: "#a6adc8",
      darkOverlay2: "#9399b2",
      darkOverlay1: "#7f849c",
      darkOverlay0: "#6c7086",
      darkSurface2: "#585b70",
      darkSurface1: "#45475a",
      darkSurface0: "#313244",
      darkBase: "#1e1e2e",
      darkMantle: "#181825",
      darkCrust: "#11111b"
    },
    theme: {
      primary: { dark: "darkBlue", light: "lightBlue" },
      secondary: { dark: "darkMauve", light: "lightMauve" },
      accent: { dark: "darkPink", light: "lightPink" },
      error: { dark: "darkRed", light: "lightRed" },
      warning: { dark: "darkYellow", light: "lightYellow" },
      success: { dark: "darkGreen", light: "lightGreen" },
      info: { dark: "darkTeal", light: "lightTeal" },
      text: { dark: "darkText", light: "lightText" },
      textMuted: { dark: "darkSubtext1", light: "lightSubtext1" },
      background: { dark: "darkBase", light: "lightBase" },
      backgroundPanel: { dark: "darkMantle", light: "lightMantle" },
      backgroundElement: { dark: "darkCrust", light: "lightCrust" },
      border: { dark: "darkSurface0", light: "lightSurface0" },
      borderActive: { dark: "darkSurface1", light: "lightSurface1" },
      borderSubtle: { dark: "darkSurface2", light: "lightSurface2" },
      diffAdded: { dark: "darkGreen", light: "lightGreen" },
      diffRemoved: { dark: "darkRed", light: "lightRed" },
      diffContext: { dark: "darkOverlay2", light: "lightOverlay2" },
      diffHunkHeader: { dark: "darkPeach", light: "lightPeach" },
      diffHighlightAdded: { dark: "darkGreen", light: "lightGreen" },
      diffHighlightRemoved: { dark: "darkRed", light: "lightRed" },
      diffAddedBg: { dark: "#24312b", light: "#d6f0d9" },
      diffRemovedBg: { dark: "#3c2a32", light: "#f6dfe2" },
      diffContextBg: { dark: "darkMantle", light: "lightMantle" },
      diffLineNumber: { dark: "darkSurface1", light: "lightSurface1" },
      diffAddedLineNumberBg: { dark: "#1e2a25", light: "#c9e3cb" },
      diffRemovedLineNumberBg: { dark: "#32232a", light: "#e9d3d6" },
      markdownText: { dark: "darkText", light: "lightText" },
      markdownHeading: { dark: "darkMauve", light: "lightMauve" },
      markdownLink: { dark: "darkBlue", light: "lightBlue" },
      markdownLinkText: { dark: "darkSky", light: "lightSky" },
      markdownCode: { dark: "darkGreen", light: "lightGreen" },
      markdownBlockQuote: { dark: "darkYellow", light: "lightYellow" },
      markdownEmph: { dark: "darkYellow", light: "lightYellow" },
      markdownStrong: { dark: "darkPeach", light: "lightPeach" },
      markdownHorizontalRule: {
        dark: "darkSubtext0",
        light: "lightSubtext0"
      },
      markdownListItem: { dark: "darkBlue", light: "lightBlue" },
      markdownListEnumeration: { dark: "darkSky", light: "lightSky" },
      markdownImage: { dark: "darkBlue", light: "lightBlue" },
      markdownImageText: { dark: "darkSky", light: "lightSky" },
      markdownCodeBlock: { dark: "darkText", light: "lightText" },
      syntaxComment: { dark: "darkOverlay2", light: "lightOverlay2" },
      syntaxKeyword: { dark: "darkMauve", light: "lightMauve" },
      syntaxFunction: { dark: "darkBlue", light: "lightBlue" },
      syntaxVariable: { dark: "darkRed", light: "lightRed" },
      syntaxString: { dark: "darkGreen", light: "lightGreen" },
      syntaxNumber: { dark: "darkPeach", light: "lightPeach" },
      syntaxType: { dark: "darkYellow", light: "lightYellow" },
      syntaxOperator: { dark: "darkSky", light: "lightSky" },
      syntaxPunctuation: { dark: "darkText", light: "lightText" }
    }
  };
});

// src/ui/theme/themes/catppuccin-frappe.json
var catppuccin_frappe_default;
var init_catppuccin_frappe = __esm(() => {
  catppuccin_frappe_default = {
    $schema: "https://opencode.ai/theme.json",
    defs: {
      frappeRosewater: "#f2d5cf",
      frappeFlamingo: "#eebebe",
      frappePink: "#f4b8e4",
      frappeMauve: "#ca9ee6",
      frappeRed: "#e78284",
      frappeMaroon: "#ea999c",
      frappePeach: "#ef9f76",
      frappeYellow: "#e5c890",
      frappeGreen: "#a6d189",
      frappeTeal: "#81c8be",
      frappeSky: "#99d1db",
      frappeSapphire: "#85c1dc",
      frappeBlue: "#8da4e2",
      frappeLavender: "#babbf1",
      frappeText: "#c6d0f5",
      frappeSubtext1: "#b5bfe2",
      frappeSubtext0: "#a5adce",
      frappeOverlay2: "#949cb8",
      frappeOverlay1: "#838ba7",
      frappeOverlay0: "#737994",
      frappeSurface2: "#626880",
      frappeSurface1: "#51576d",
      frappeSurface0: "#414559",
      frappeBase: "#303446",
      frappeMantle: "#292c3c",
      frappeCrust: "#232634"
    },
    theme: {
      primary: {
        dark: "frappeBlue",
        light: "frappeBlue"
      },
      secondary: {
        dark: "frappeMauve",
        light: "frappeMauve"
      },
      accent: {
        dark: "frappePink",
        light: "frappePink"
      },
      error: {
        dark: "frappeRed",
        light: "frappeRed"
      },
      warning: {
        dark: "frappeYellow",
        light: "frappeYellow"
      },
      success: {
        dark: "frappeGreen",
        light: "frappeGreen"
      },
      info: {
        dark: "frappeTeal",
        light: "frappeTeal"
      },
      text: {
        dark: "frappeText",
        light: "frappeText"
      },
      textMuted: {
        dark: "frappeSubtext1",
        light: "frappeSubtext1"
      },
      background: {
        dark: "frappeBase",
        light: "frappeBase"
      },
      backgroundPanel: {
        dark: "frappeMantle",
        light: "frappeMantle"
      },
      backgroundElement: {
        dark: "frappeCrust",
        light: "frappeCrust"
      },
      border: {
        dark: "frappeSurface0",
        light: "frappeSurface0"
      },
      borderActive: {
        dark: "frappeSurface1",
        light: "frappeSurface1"
      },
      borderSubtle: {
        dark: "frappeSurface2",
        light: "frappeSurface2"
      },
      diffAdded: {
        dark: "frappeGreen",
        light: "frappeGreen"
      },
      diffRemoved: {
        dark: "frappeRed",
        light: "frappeRed"
      },
      diffContext: {
        dark: "frappeOverlay2",
        light: "frappeOverlay2"
      },
      diffHunkHeader: {
        dark: "frappePeach",
        light: "frappePeach"
      },
      diffHighlightAdded: {
        dark: "frappeGreen",
        light: "frappeGreen"
      },
      diffHighlightRemoved: {
        dark: "frappeRed",
        light: "frappeRed"
      },
      diffAddedBg: {
        dark: "#29342b",
        light: "#29342b"
      },
      diffRemovedBg: {
        dark: "#3a2a31",
        light: "#3a2a31"
      },
      diffContextBg: {
        dark: "frappeMantle",
        light: "frappeMantle"
      },
      diffLineNumber: {
        dark: "frappeSurface1",
        light: "frappeSurface1"
      },
      diffAddedLineNumberBg: {
        dark: "#223025",
        light: "#223025"
      },
      diffRemovedLineNumberBg: {
        dark: "#2f242b",
        light: "#2f242b"
      },
      markdownText: {
        dark: "frappeText",
        light: "frappeText"
      },
      markdownHeading: {
        dark: "frappeMauve",
        light: "frappeMauve"
      },
      markdownLink: {
        dark: "frappeBlue",
        light: "frappeBlue"
      },
      markdownLinkText: {
        dark: "frappeSky",
        light: "frappeSky"
      },
      markdownCode: {
        dark: "frappeGreen",
        light: "frappeGreen"
      },
      markdownBlockQuote: {
        dark: "frappeYellow",
        light: "frappeYellow"
      },
      markdownEmph: {
        dark: "frappeYellow",
        light: "frappeYellow"
      },
      markdownStrong: {
        dark: "frappePeach",
        light: "frappePeach"
      },
      markdownHorizontalRule: {
        dark: "frappeSubtext0",
        light: "frappeSubtext0"
      },
      markdownListItem: {
        dark: "frappeBlue",
        light: "frappeBlue"
      },
      markdownListEnumeration: {
        dark: "frappeSky",
        light: "frappeSky"
      },
      markdownImage: {
        dark: "frappeBlue",
        light: "frappeBlue"
      },
      markdownImageText: {
        dark: "frappeSky",
        light: "frappeSky"
      },
      markdownCodeBlock: {
        dark: "frappeText",
        light: "frappeText"
      },
      syntaxComment: {
        dark: "frappeOverlay2",
        light: "frappeOverlay2"
      },
      syntaxKeyword: {
        dark: "frappeMauve",
        light: "frappeMauve"
      },
      syntaxFunction: {
        dark: "frappeBlue",
        light: "frappeBlue"
      },
      syntaxVariable: {
        dark: "frappeRed",
        light: "frappeRed"
      },
      syntaxString: {
        dark: "frappeGreen",
        light: "frappeGreen"
      },
      syntaxNumber: {
        dark: "frappePeach",
        light: "frappePeach"
      },
      syntaxType: {
        dark: "frappeYellow",
        light: "frappeYellow"
      },
      syntaxOperator: {
        dark: "frappeSky",
        light: "frappeSky"
      },
      syntaxPunctuation: {
        dark: "frappeText",
        light: "frappeText"
      }
    }
  };
});

// src/ui/theme/themes/catppuccin-macchiato.json
var catppuccin_macchiato_default;
var init_catppuccin_macchiato = __esm(() => {
  catppuccin_macchiato_default = {
    $schema: "https://opencode.ai/theme.json",
    defs: {
      macRosewater: "#f4dbd6",
      macFlamingo: "#f0c6c6",
      macPink: "#f5bde6",
      macMauve: "#c6a0f6",
      macRed: "#ed8796",
      macMaroon: "#ee99a0",
      macPeach: "#f5a97f",
      macYellow: "#eed49f",
      macGreen: "#a6da95",
      macTeal: "#8bd5ca",
      macSky: "#91d7e3",
      macSapphire: "#7dc4e4",
      macBlue: "#8aadf4",
      macLavender: "#b7bdf8",
      macText: "#cad3f5",
      macSubtext1: "#b8c0e0",
      macSubtext0: "#a5adcb",
      macOverlay2: "#939ab7",
      macOverlay1: "#8087a2",
      macOverlay0: "#6e738d",
      macSurface2: "#5b6078",
      macSurface1: "#494d64",
      macSurface0: "#363a4f",
      macBase: "#24273a",
      macMantle: "#1e2030",
      macCrust: "#181926"
    },
    theme: {
      primary: {
        dark: "macBlue",
        light: "macBlue"
      },
      secondary: {
        dark: "macMauve",
        light: "macMauve"
      },
      accent: {
        dark: "macPink",
        light: "macPink"
      },
      error: {
        dark: "macRed",
        light: "macRed"
      },
      warning: {
        dark: "macYellow",
        light: "macYellow"
      },
      success: {
        dark: "macGreen",
        light: "macGreen"
      },
      info: {
        dark: "macTeal",
        light: "macTeal"
      },
      text: {
        dark: "macText",
        light: "macText"
      },
      textMuted: {
        dark: "macSubtext1",
        light: "macSubtext1"
      },
      background: {
        dark: "macBase",
        light: "macBase"
      },
      backgroundPanel: {
        dark: "macMantle",
        light: "macMantle"
      },
      backgroundElement: {
        dark: "macCrust",
        light: "macCrust"
      },
      border: {
        dark: "macSurface0",
        light: "macSurface0"
      },
      borderActive: {
        dark: "macSurface1",
        light: "macSurface1"
      },
      borderSubtle: {
        dark: "macSurface2",
        light: "macSurface2"
      },
      diffAdded: {
        dark: "macGreen",
        light: "macGreen"
      },
      diffRemoved: {
        dark: "macRed",
        light: "macRed"
      },
      diffContext: {
        dark: "macOverlay2",
        light: "macOverlay2"
      },
      diffHunkHeader: {
        dark: "macPeach",
        light: "macPeach"
      },
      diffHighlightAdded: {
        dark: "macGreen",
        light: "macGreen"
      },
      diffHighlightRemoved: {
        dark: "macRed",
        light: "macRed"
      },
      diffAddedBg: {
        dark: "#29342b",
        light: "#29342b"
      },
      diffRemovedBg: {
        dark: "#3a2a31",
        light: "#3a2a31"
      },
      diffContextBg: {
        dark: "macMantle",
        light: "macMantle"
      },
      diffLineNumber: {
        dark: "macSurface1",
        light: "macSurface1"
      },
      diffAddedLineNumberBg: {
        dark: "#223025",
        light: "#223025"
      },
      diffRemovedLineNumberBg: {
        dark: "#2f242b",
        light: "#2f242b"
      },
      markdownText: {
        dark: "macText",
        light: "macText"
      },
      markdownHeading: {
        dark: "macMauve",
        light: "macMauve"
      },
      markdownLink: {
        dark: "macBlue",
        light: "macBlue"
      },
      markdownLinkText: {
        dark: "macSky",
        light: "macSky"
      },
      markdownCode: {
        dark: "macGreen",
        light: "macGreen"
      },
      markdownBlockQuote: {
        dark: "macYellow",
        light: "macYellow"
      },
      markdownEmph: {
        dark: "macYellow",
        light: "macYellow"
      },
      markdownStrong: {
        dark: "macPeach",
        light: "macPeach"
      },
      markdownHorizontalRule: {
        dark: "macSubtext0",
        light: "macSubtext0"
      },
      markdownListItem: {
        dark: "macBlue",
        light: "macBlue"
      },
      markdownListEnumeration: {
        dark: "macSky",
        light: "macSky"
      },
      markdownImage: {
        dark: "macBlue",
        light: "macBlue"
      },
      markdownImageText: {
        dark: "macSky",
        light: "macSky"
      },
      markdownCodeBlock: {
        dark: "macText",
        light: "macText"
      },
      syntaxComment: {
        dark: "macOverlay2",
        light: "macOverlay2"
      },
      syntaxKeyword: {
        dark: "macMauve",
        light: "macMauve"
      },
      syntaxFunction: {
        dark: "macBlue",
        light: "macBlue"
      },
      syntaxVariable: {
        dark: "macRed",
        light: "macRed"
      },
      syntaxString: {
        dark: "macGreen",
        light: "macGreen"
      },
      syntaxNumber: {
        dark: "macPeach",
        light: "macPeach"
      },
      syntaxType: {
        dark: "macYellow",
        light: "macYellow"
      },
      syntaxOperator: {
        dark: "macSky",
        light: "macSky"
      },
      syntaxPunctuation: {
        dark: "macText",
        light: "macText"
      }
    }
  };
});

// src/ui/theme/themes/cobalt2.json
var cobalt2_default;
var init_cobalt2 = __esm(() => {
  cobalt2_default = {
    $schema: "https://opencode.ai/theme.json",
    defs: {
      background: "#193549",
      backgroundAlt: "#122738",
      backgroundPanel: "#1f4662",
      foreground: "#ffffff",
      foregroundMuted: "#adb7c9",
      yellow: "#ffc600",
      yellowBright: "#ffe14c",
      orange: "#ff9d00",
      orangeBright: "#ffb454",
      mint: "#2affdf",
      mintBright: "#7efff5",
      blue: "#0088ff",
      blueBright: "#5cb7ff",
      pink: "#ff628c",
      pinkBright: "#ff86a5",
      green: "#9eff80",
      greenBright: "#b9ff9f",
      purple: "#9a5feb",
      purpleBright: "#b88cfd",
      red: "#ff0088",
      redBright: "#ff5fb3"
    },
    theme: {
      primary: {
        dark: "blue",
        light: "#0066cc"
      },
      secondary: {
        dark: "purple",
        light: "#7c4dff"
      },
      accent: {
        dark: "mint",
        light: "#00acc1"
      },
      error: {
        dark: "red",
        light: "#e91e63"
      },
      warning: {
        dark: "yellow",
        light: "#ff9800"
      },
      success: {
        dark: "green",
        light: "#4caf50"
      },
      info: {
        dark: "orange",
        light: "#ff5722"
      },
      text: {
        dark: "foreground",
        light: "#193549"
      },
      textMuted: {
        dark: "foregroundMuted",
        light: "#5c6b7d"
      },
      background: {
        dark: "#193549",
        light: "#ffffff"
      },
      backgroundPanel: {
        dark: "#122738",
        light: "#f5f7fa"
      },
      backgroundElement: {
        dark: "#1f4662",
        light: "#e8ecf1"
      },
      border: {
        dark: "#1f4662",
        light: "#d3dae3"
      },
      borderActive: {
        dark: "blue",
        light: "#0066cc"
      },
      borderSubtle: {
        dark: "#0e1e2e",
        light: "#e8ecf1"
      },
      diffAdded: {
        dark: "green",
        light: "#4caf50"
      },
      diffRemoved: {
        dark: "red",
        light: "#e91e63"
      },
      diffContext: {
        dark: "foregroundMuted",
        light: "#5c6b7d"
      },
      diffHunkHeader: {
        dark: "mint",
        light: "#00acc1"
      },
      diffHighlightAdded: {
        dark: "greenBright",
        light: "#4caf50"
      },
      diffHighlightRemoved: {
        dark: "redBright",
        light: "#e91e63"
      },
      diffAddedBg: {
        dark: "#1a3a2a",
        light: "#e8f5e9"
      },
      diffRemovedBg: {
        dark: "#3a1a2a",
        light: "#ffebee"
      },
      diffContextBg: {
        dark: "#122738",
        light: "#f5f7fa"
      },
      diffLineNumber: {
        dark: "#2d5a7b",
        light: "#b0bec5"
      },
      diffAddedLineNumberBg: {
        dark: "#1a3a2a",
        light: "#e8f5e9"
      },
      diffRemovedLineNumberBg: {
        dark: "#3a1a2a",
        light: "#ffebee"
      },
      markdownText: {
        dark: "foreground",
        light: "#193549"
      },
      markdownHeading: {
        dark: "yellow",
        light: "#ff9800"
      },
      markdownLink: {
        dark: "blue",
        light: "#0066cc"
      },
      markdownLinkText: {
        dark: "mint",
        light: "#00acc1"
      },
      markdownCode: {
        dark: "green",
        light: "#4caf50"
      },
      markdownBlockQuote: {
        dark: "foregroundMuted",
        light: "#5c6b7d"
      },
      markdownEmph: {
        dark: "orange",
        light: "#ff5722"
      },
      markdownStrong: {
        dark: "pink",
        light: "#e91e63"
      },
      markdownHorizontalRule: {
        dark: "#2d5a7b",
        light: "#d3dae3"
      },
      markdownListItem: {
        dark: "blue",
        light: "#0066cc"
      },
      markdownListEnumeration: {
        dark: "mint",
        light: "#00acc1"
      },
      markdownImage: {
        dark: "blue",
        light: "#0066cc"
      },
      markdownImageText: {
        dark: "mint",
        light: "#00acc1"
      },
      markdownCodeBlock: {
        dark: "foreground",
        light: "#193549"
      },
      syntaxComment: {
        dark: "#0088ff",
        light: "#5c6b7d"
      },
      syntaxKeyword: {
        dark: "orange",
        light: "#ff5722"
      },
      syntaxFunction: {
        dark: "yellow",
        light: "#ff9800"
      },
      syntaxVariable: {
        dark: "foreground",
        light: "#193549"
      },
      syntaxString: {
        dark: "green",
        light: "#4caf50"
      },
      syntaxNumber: {
        dark: "pink",
        light: "#e91e63"
      },
      syntaxType: {
        dark: "mint",
        light: "#00acc1"
      },
      syntaxOperator: {
        dark: "orange",
        light: "#ff5722"
      },
      syntaxPunctuation: {
        dark: "foreground",
        light: "#193549"
      }
    }
  };
});

// src/ui/theme/themes/cursor.json
var cursor_default;
var init_cursor = __esm(() => {
  cursor_default = {
    $schema: "https://opencode.ai/theme.json",
    defs: {
      darkBg: "#181818",
      darkPanel: "#141414",
      darkElement: "#262626",
      darkFg: "#e4e4e4",
      darkMuted: "#e4e4e45e",
      darkBorder: "#e4e4e413",
      darkBorderActive: "#e4e4e426",
      darkCyan: "#88c0d0",
      darkBlue: "#81a1c1",
      darkGreen: "#3fa266",
      darkGreenBright: "#70b489",
      darkRed: "#e34671",
      darkRedBright: "#fc6b83",
      darkYellow: "#f1b467",
      darkOrange: "#d2943e",
      darkPink: "#E394DC",
      darkPurple: "#AAA0FA",
      darkTeal: "#82D2CE",
      darkSyntaxYellow: "#F8C762",
      darkSyntaxOrange: "#EFB080",
      darkSyntaxGreen: "#A8CC7C",
      darkSyntaxBlue: "#87C3FF",
      lightBg: "#fcfcfc",
      lightPanel: "#f3f3f3",
      lightElement: "#ededed",
      lightFg: "#141414",
      lightMuted: "#141414ad",
      lightBorder: "#14141413",
      lightBorderActive: "#14141426",
      lightTeal: "#6f9ba6",
      lightBlue: "#3c7cab",
      lightBlueDark: "#206595",
      lightGreen: "#1f8a65",
      lightGreenBright: "#55a583",
      lightRed: "#cf2d56",
      lightRedBright: "#e75e78",
      lightOrange: "#db704b",
      lightYellow: "#c08532",
      lightPurple: "#9e94d5",
      lightPurpleDark: "#6049b3",
      lightPink: "#b8448b",
      lightMagenta: "#b3003f"
    },
    theme: {
      primary: {
        dark: "darkCyan",
        light: "lightTeal"
      },
      secondary: {
        dark: "darkBlue",
        light: "lightBlue"
      },
      accent: {
        dark: "darkCyan",
        light: "lightTeal"
      },
      error: {
        dark: "darkRed",
        light: "lightRed"
      },
      warning: {
        dark: "darkYellow",
        light: "lightOrange"
      },
      success: {
        dark: "darkGreen",
        light: "lightGreen"
      },
      info: {
        dark: "darkBlue",
        light: "lightBlue"
      },
      text: {
        dark: "darkFg",
        light: "lightFg"
      },
      textMuted: {
        dark: "darkMuted",
        light: "lightMuted"
      },
      background: {
        dark: "darkBg",
        light: "lightBg"
      },
      backgroundPanel: {
        dark: "darkPanel",
        light: "lightPanel"
      },
      backgroundElement: {
        dark: "darkElement",
        light: "lightElement"
      },
      border: {
        dark: "darkBorder",
        light: "lightBorder"
      },
      borderActive: {
        dark: "darkCyan",
        light: "lightTeal"
      },
      borderSubtle: {
        dark: "#0f0f0f",
        light: "#e0e0e0"
      },
      diffAdded: {
        dark: "darkGreen",
        light: "lightGreen"
      },
      diffRemoved: {
        dark: "darkRed",
        light: "lightRed"
      },
      diffContext: {
        dark: "darkMuted",
        light: "lightMuted"
      },
      diffHunkHeader: {
        dark: "darkMuted",
        light: "lightMuted"
      },
      diffHighlightAdded: {
        dark: "darkGreenBright",
        light: "lightGreenBright"
      },
      diffHighlightRemoved: {
        dark: "darkRedBright",
        light: "lightRedBright"
      },
      diffAddedBg: {
        dark: "#3fa26633",
        light: "#1f8a651f"
      },
      diffRemovedBg: {
        dark: "#b8004933",
        light: "#cf2d5614"
      },
      diffContextBg: {
        dark: "darkPanel",
        light: "lightPanel"
      },
      diffLineNumber: {
        dark: "#e4e4e442",
        light: "#1414147a"
      },
      diffAddedLineNumberBg: {
        dark: "#3fa26633",
        light: "#1f8a651f"
      },
      diffRemovedLineNumberBg: {
        dark: "#b8004933",
        light: "#cf2d5614"
      },
      markdownText: {
        dark: "darkFg",
        light: "lightFg"
      },
      markdownHeading: {
        dark: "darkPurple",
        light: "lightBlueDark"
      },
      markdownLink: {
        dark: "darkTeal",
        light: "lightBlueDark"
      },
      markdownLinkText: {
        dark: "darkBlue",
        light: "lightMuted"
      },
      markdownCode: {
        dark: "darkPink",
        light: "lightGreen"
      },
      markdownBlockQuote: {
        dark: "darkMuted",
        light: "lightMuted"
      },
      markdownEmph: {
        dark: "darkTeal",
        light: "lightFg"
      },
      markdownStrong: {
        dark: "darkSyntaxYellow",
        light: "lightFg"
      },
      markdownHorizontalRule: {
        dark: "darkMuted",
        light: "lightMuted"
      },
      markdownListItem: {
        dark: "darkFg",
        light: "lightFg"
      },
      markdownListEnumeration: {
        dark: "darkCyan",
        light: "lightMuted"
      },
      markdownImage: {
        dark: "darkCyan",
        light: "lightBlueDark"
      },
      markdownImageText: {
        dark: "darkBlue",
        light: "lightMuted"
      },
      markdownCodeBlock: {
        dark: "darkFg",
        light: "lightFg"
      },
      syntaxComment: {
        dark: "darkMuted",
        light: "lightMuted"
      },
      syntaxKeyword: {
        dark: "darkTeal",
        light: "lightMagenta"
      },
      syntaxFunction: {
        dark: "darkSyntaxOrange",
        light: "lightOrange"
      },
      syntaxVariable: {
        dark: "darkFg",
        light: "lightFg"
      },
      syntaxString: {
        dark: "darkPink",
        light: "lightPurple"
      },
      syntaxNumber: {
        dark: "darkSyntaxYellow",
        light: "lightPink"
      },
      syntaxType: {
        dark: "darkSyntaxOrange",
        light: "lightBlueDark"
      },
      syntaxOperator: {
        dark: "darkFg",
        light: "lightFg"
      },
      syntaxPunctuation: {
        dark: "darkFg",
        light: "lightFg"
      }
    }
  };
});

// src/ui/theme/themes/dracula.json
var dracula_default;
var init_dracula = __esm(() => {
  dracula_default = {
    $schema: "https://opencode.ai/theme.json",
    defs: {
      background: "#282a36",
      currentLine: "#44475a",
      selection: "#44475a",
      foreground: "#f8f8f2",
      comment: "#6272a4",
      cyan: "#8be9fd",
      green: "#50fa7b",
      orange: "#ffb86c",
      pink: "#ff79c6",
      purple: "#bd93f9",
      red: "#ff5555",
      yellow: "#f1fa8c"
    },
    theme: {
      primary: {
        dark: "purple",
        light: "purple"
      },
      secondary: {
        dark: "pink",
        light: "pink"
      },
      accent: {
        dark: "cyan",
        light: "cyan"
      },
      error: {
        dark: "red",
        light: "red"
      },
      warning: {
        dark: "yellow",
        light: "yellow"
      },
      success: {
        dark: "green",
        light: "green"
      },
      info: {
        dark: "orange",
        light: "orange"
      },
      text: {
        dark: "foreground",
        light: "#282a36"
      },
      textMuted: {
        dark: "comment",
        light: "#6272a4"
      },
      background: {
        dark: "#282a36",
        light: "#f8f8f2"
      },
      backgroundPanel: {
        dark: "#21222c",
        light: "#e8e8e2"
      },
      backgroundElement: {
        dark: "currentLine",
        light: "#d8d8d2"
      },
      border: {
        dark: "currentLine",
        light: "#c8c8c2"
      },
      borderActive: {
        dark: "purple",
        light: "purple"
      },
      borderSubtle: {
        dark: "#191a21",
        light: "#e0e0e0"
      },
      diffAdded: {
        dark: "green",
        light: "green"
      },
      diffRemoved: {
        dark: "red",
        light: "red"
      },
      diffContext: {
        dark: "comment",
        light: "#6272a4"
      },
      diffHunkHeader: {
        dark: "comment",
        light: "#6272a4"
      },
      diffHighlightAdded: {
        dark: "green",
        light: "green"
      },
      diffHighlightRemoved: {
        dark: "red",
        light: "red"
      },
      diffAddedBg: {
        dark: "#1a3a1a",
        light: "#e0ffe0"
      },
      diffRemovedBg: {
        dark: "#3a1a1a",
        light: "#ffe0e0"
      },
      diffContextBg: {
        dark: "#21222c",
        light: "#e8e8e2"
      },
      diffLineNumber: {
        dark: "currentLine",
        light: "#c8c8c2"
      },
      diffAddedLineNumberBg: {
        dark: "#1a3a1a",
        light: "#e0ffe0"
      },
      diffRemovedLineNumberBg: {
        dark: "#3a1a1a",
        light: "#ffe0e0"
      },
      markdownText: {
        dark: "foreground",
        light: "#282a36"
      },
      markdownHeading: {
        dark: "purple",
        light: "purple"
      },
      markdownLink: {
        dark: "cyan",
        light: "cyan"
      },
      markdownLinkText: {
        dark: "pink",
        light: "pink"
      },
      markdownCode: {
        dark: "green",
        light: "green"
      },
      markdownBlockQuote: {
        dark: "comment",
        light: "#6272a4"
      },
      markdownEmph: {
        dark: "yellow",
        light: "yellow"
      },
      markdownStrong: {
        dark: "orange",
        light: "orange"
      },
      markdownHorizontalRule: {
        dark: "comment",
        light: "#6272a4"
      },
      markdownListItem: {
        dark: "purple",
        light: "purple"
      },
      markdownListEnumeration: {
        dark: "cyan",
        light: "cyan"
      },
      markdownImage: {
        dark: "cyan",
        light: "cyan"
      },
      markdownImageText: {
        dark: "pink",
        light: "pink"
      },
      markdownCodeBlock: {
        dark: "foreground",
        light: "#282a36"
      },
      syntaxComment: {
        dark: "comment",
        light: "#6272a4"
      },
      syntaxKeyword: {
        dark: "pink",
        light: "pink"
      },
      syntaxFunction: {
        dark: "green",
        light: "green"
      },
      syntaxVariable: {
        dark: "foreground",
        light: "#282a36"
      },
      syntaxString: {
        dark: "yellow",
        light: "yellow"
      },
      syntaxNumber: {
        dark: "purple",
        light: "purple"
      },
      syntaxType: {
        dark: "cyan",
        light: "cyan"
      },
      syntaxOperator: {
        dark: "pink",
        light: "pink"
      },
      syntaxPunctuation: {
        dark: "foreground",
        light: "#282a36"
      }
    }
  };
});

// src/ui/theme/themes/everforest.json
var everforest_default;
var init_everforest = __esm(() => {
  everforest_default = {
    $schema: "https://opencode.ai/theme.json",
    defs: {
      darkStep1: "#2d353b",
      darkStep2: "#333c43",
      darkStep3: "#343f44",
      darkStep4: "#3d484d",
      darkStep5: "#475258",
      darkStep6: "#7a8478",
      darkStep7: "#859289",
      darkStep8: "#9da9a0",
      darkStep9: "#a7c080",
      darkStep10: "#83c092",
      darkStep11: "#7a8478",
      darkStep12: "#d3c6aa",
      darkRed: "#e67e80",
      darkOrange: "#e69875",
      darkGreen: "#a7c080",
      darkCyan: "#83c092",
      darkYellow: "#dbbc7f",
      lightStep1: "#fdf6e3",
      lightStep2: "#efebd4",
      lightStep3: "#f4f0d9",
      lightStep4: "#efebd4",
      lightStep5: "#e6e2cc",
      lightStep6: "#a6b0a0",
      lightStep7: "#939f91",
      lightStep8: "#829181",
      lightStep9: "#8da101",
      lightStep10: "#35a77c",
      lightStep11: "#a6b0a0",
      lightStep12: "#5c6a72",
      lightRed: "#f85552",
      lightOrange: "#f57d26",
      lightGreen: "#8da101",
      lightCyan: "#35a77c",
      lightYellow: "#dfa000"
    },
    theme: {
      primary: {
        dark: "darkStep9",
        light: "lightStep9"
      },
      secondary: {
        dark: "#7fbbb3",
        light: "#3a94c5"
      },
      accent: {
        dark: "#d699b6",
        light: "#df69ba"
      },
      error: {
        dark: "darkRed",
        light: "lightRed"
      },
      warning: {
        dark: "darkOrange",
        light: "lightOrange"
      },
      success: {
        dark: "darkGreen",
        light: "lightGreen"
      },
      info: {
        dark: "darkCyan",
        light: "lightCyan"
      },
      text: {
        dark: "darkStep12",
        light: "lightStep12"
      },
      textMuted: {
        dark: "darkStep11",
        light: "lightStep11"
      },
      background: {
        dark: "darkStep1",
        light: "lightStep1"
      },
      backgroundPanel: {
        dark: "darkStep2",
        light: "lightStep2"
      },
      backgroundElement: {
        dark: "darkStep3",
        light: "lightStep3"
      },
      border: {
        dark: "darkStep7",
        light: "lightStep7"
      },
      borderActive: {
        dark: "darkStep8",
        light: "lightStep8"
      },
      borderSubtle: {
        dark: "darkStep6",
        light: "lightStep6"
      },
      diffAdded: {
        dark: "#4fd6be",
        light: "#1e725c"
      },
      diffRemoved: {
        dark: "#c53b53",
        light: "#c53b53"
      },
      diffContext: {
        dark: "#828bb8",
        light: "#7086b5"
      },
      diffHunkHeader: {
        dark: "#828bb8",
        light: "#7086b5"
      },
      diffHighlightAdded: {
        dark: "#b8db87",
        light: "#4db380"
      },
      diffHighlightRemoved: {
        dark: "#e26a75",
        light: "#f52a65"
      },
      diffAddedBg: {
        dark: "#20303b",
        light: "#d5e5d5"
      },
      diffRemovedBg: {
        dark: "#37222c",
        light: "#f7d8db"
      },
      diffContextBg: {
        dark: "darkStep2",
        light: "lightStep2"
      },
      diffLineNumber: {
        dark: "darkStep3",
        light: "lightStep3"
      },
      diffAddedLineNumberBg: {
        dark: "#1b2b34",
        light: "#c5d5c5"
      },
      diffRemovedLineNumberBg: {
        dark: "#2d1f26",
        light: "#e7c8cb"
      },
      markdownText: {
        dark: "darkStep12",
        light: "lightStep12"
      },
      markdownHeading: {
        dark: "#d699b6",
        light: "#df69ba"
      },
      markdownLink: {
        dark: "darkStep9",
        light: "lightStep9"
      },
      markdownLinkText: {
        dark: "darkCyan",
        light: "lightCyan"
      },
      markdownCode: {
        dark: "darkGreen",
        light: "lightGreen"
      },
      markdownBlockQuote: {
        dark: "darkYellow",
        light: "lightYellow"
      },
      markdownEmph: {
        dark: "darkYellow",
        light: "lightYellow"
      },
      markdownStrong: {
        dark: "darkOrange",
        light: "lightOrange"
      },
      markdownHorizontalRule: {
        dark: "darkStep11",
        light: "lightStep11"
      },
      markdownListItem: {
        dark: "darkStep9",
        light: "lightStep9"
      },
      markdownListEnumeration: {
        dark: "darkCyan",
        light: "lightCyan"
      },
      markdownImage: {
        dark: "darkStep9",
        light: "lightStep9"
      },
      markdownImageText: {
        dark: "darkCyan",
        light: "lightCyan"
      },
      markdownCodeBlock: {
        dark: "darkStep12",
        light: "lightStep12"
      },
      syntaxComment: {
        dark: "darkStep11",
        light: "lightStep11"
      },
      syntaxKeyword: {
        dark: "#d699b6",
        light: "#df69ba"
      },
      syntaxFunction: {
        dark: "darkStep9",
        light: "lightStep9"
      },
      syntaxVariable: {
        dark: "darkRed",
        light: "lightRed"
      },
      syntaxString: {
        dark: "darkGreen",
        light: "lightGreen"
      },
      syntaxNumber: {
        dark: "darkOrange",
        light: "lightOrange"
      },
      syntaxType: {
        dark: "darkYellow",
        light: "lightYellow"
      },
      syntaxOperator: {
        dark: "darkCyan",
        light: "lightCyan"
      },
      syntaxPunctuation: {
        dark: "darkStep12",
        light: "lightStep12"
      }
    }
  };
});

// src/ui/theme/themes/flexoki.json
var flexoki_default;
var init_flexoki = __esm(() => {
  flexoki_default = {
    $schema: "https://opencode.ai/theme.json",
    defs: {
      black: "#100F0F",
      base950: "#1C1B1A",
      base900: "#282726",
      base850: "#343331",
      base800: "#403E3C",
      base700: "#575653",
      base600: "#6F6E69",
      base500: "#878580",
      base300: "#B7B5AC",
      base200: "#CECDC3",
      base150: "#DAD8CE",
      base100: "#E6E4D9",
      base50: "#F2F0E5",
      paper: "#FFFCF0",
      red400: "#D14D41",
      red600: "#AF3029",
      orange400: "#DA702C",
      orange600: "#BC5215",
      yellow400: "#D0A215",
      yellow600: "#AD8301",
      green400: "#879A39",
      green600: "#66800B",
      cyan400: "#3AA99F",
      cyan600: "#24837B",
      blue400: "#4385BE",
      blue600: "#205EA6",
      purple400: "#8B7EC8",
      purple600: "#5E409D",
      magenta400: "#CE5D97",
      magenta600: "#A02F6F"
    },
    theme: {
      primary: {
        dark: "orange400",
        light: "blue600"
      },
      secondary: {
        dark: "blue400",
        light: "purple600"
      },
      accent: {
        dark: "purple400",
        light: "orange600"
      },
      error: {
        dark: "red400",
        light: "red600"
      },
      warning: {
        dark: "orange400",
        light: "orange600"
      },
      success: {
        dark: "green400",
        light: "green600"
      },
      info: {
        dark: "cyan400",
        light: "cyan600"
      },
      text: {
        dark: "base200",
        light: "black"
      },
      textMuted: {
        dark: "base600",
        light: "base600"
      },
      background: {
        dark: "black",
        light: "paper"
      },
      backgroundPanel: {
        dark: "base950",
        light: "base50"
      },
      backgroundElement: {
        dark: "base900",
        light: "base100"
      },
      border: {
        dark: "base700",
        light: "base300"
      },
      borderActive: {
        dark: "base600",
        light: "base500"
      },
      borderSubtle: {
        dark: "base800",
        light: "base200"
      },
      diffAdded: {
        dark: "green400",
        light: "green600"
      },
      diffRemoved: {
        dark: "red400",
        light: "red600"
      },
      diffContext: {
        dark: "base600",
        light: "base600"
      },
      diffHunkHeader: {
        dark: "blue400",
        light: "blue600"
      },
      diffHighlightAdded: {
        dark: "green400",
        light: "green600"
      },
      diffHighlightRemoved: {
        dark: "red400",
        light: "red600"
      },
      diffAddedBg: {
        dark: "#1A2D1A",
        light: "#D5E5D5"
      },
      diffRemovedBg: {
        dark: "#2D1A1A",
        light: "#F7D8DB"
      },
      diffContextBg: {
        dark: "base950",
        light: "base50"
      },
      diffLineNumber: {
        dark: "base600",
        light: "base600"
      },
      diffAddedLineNumberBg: {
        dark: "#152515",
        light: "#C5D5C5"
      },
      diffRemovedLineNumberBg: {
        dark: "#251515",
        light: "#E7C8CB"
      },
      markdownText: {
        dark: "base200",
        light: "black"
      },
      markdownHeading: {
        dark: "purple400",
        light: "purple600"
      },
      markdownLink: {
        dark: "blue400",
        light: "blue600"
      },
      markdownLinkText: {
        dark: "cyan400",
        light: "cyan600"
      },
      markdownCode: {
        dark: "cyan400",
        light: "cyan600"
      },
      markdownBlockQuote: {
        dark: "yellow400",
        light: "yellow600"
      },
      markdownEmph: {
        dark: "yellow400",
        light: "yellow600"
      },
      markdownStrong: {
        dark: "orange400",
        light: "orange600"
      },
      markdownHorizontalRule: {
        dark: "base600",
        light: "base600"
      },
      markdownListItem: {
        dark: "orange400",
        light: "orange600"
      },
      markdownListEnumeration: {
        dark: "cyan400",
        light: "cyan600"
      },
      markdownImage: {
        dark: "magenta400",
        light: "magenta600"
      },
      markdownImageText: {
        dark: "cyan400",
        light: "cyan600"
      },
      markdownCodeBlock: {
        dark: "base200",
        light: "black"
      },
      syntaxComment: {
        dark: "base600",
        light: "base600"
      },
      syntaxKeyword: {
        dark: "green400",
        light: "green600"
      },
      syntaxFunction: {
        dark: "orange400",
        light: "orange600"
      },
      syntaxVariable: {
        dark: "blue400",
        light: "blue600"
      },
      syntaxString: {
        dark: "cyan400",
        light: "cyan600"
      },
      syntaxNumber: {
        dark: "purple400",
        light: "purple600"
      },
      syntaxType: {
        dark: "yellow400",
        light: "yellow600"
      },
      syntaxOperator: {
        dark: "base300",
        light: "base600"
      },
      syntaxPunctuation: {
        dark: "base300",
        light: "base600"
      }
    }
  };
});

// src/ui/theme/themes/github.json
var github_default;
var init_github = __esm(() => {
  github_default = {
    $schema: "https://opencode.ai/theme.json",
    defs: {
      darkBg: "#0d1117",
      darkBgAlt: "#010409",
      darkBgPanel: "#161b22",
      darkFg: "#c9d1d9",
      darkFgMuted: "#8b949e",
      darkBlue: "#58a6ff",
      darkGreen: "#3fb950",
      darkRed: "#f85149",
      darkOrange: "#d29922",
      darkPurple: "#bc8cff",
      darkPink: "#ff7b72",
      darkYellow: "#e3b341",
      darkCyan: "#39c5cf",
      lightBg: "#ffffff",
      lightBgAlt: "#f6f8fa",
      lightBgPanel: "#f0f3f6",
      lightFg: "#24292f",
      lightFgMuted: "#57606a",
      lightBlue: "#0969da",
      lightGreen: "#1a7f37",
      lightRed: "#cf222e",
      lightOrange: "#bc4c00",
      lightPurple: "#8250df",
      lightPink: "#bf3989",
      lightYellow: "#9a6700",
      lightCyan: "#1b7c83"
    },
    theme: {
      primary: {
        dark: "darkBlue",
        light: "lightBlue"
      },
      secondary: {
        dark: "darkPurple",
        light: "lightPurple"
      },
      accent: {
        dark: "darkCyan",
        light: "lightCyan"
      },
      error: {
        dark: "darkRed",
        light: "lightRed"
      },
      warning: {
        dark: "darkYellow",
        light: "lightYellow"
      },
      success: {
        dark: "darkGreen",
        light: "lightGreen"
      },
      info: {
        dark: "darkOrange",
        light: "lightOrange"
      },
      text: {
        dark: "darkFg",
        light: "lightFg"
      },
      textMuted: {
        dark: "darkFgMuted",
        light: "lightFgMuted"
      },
      background: {
        dark: "darkBg",
        light: "lightBg"
      },
      backgroundPanel: {
        dark: "darkBgAlt",
        light: "lightBgAlt"
      },
      backgroundElement: {
        dark: "darkBgPanel",
        light: "lightBgPanel"
      },
      border: {
        dark: "#30363d",
        light: "#d0d7de"
      },
      borderActive: {
        dark: "darkBlue",
        light: "lightBlue"
      },
      borderSubtle: {
        dark: "#21262d",
        light: "#d8dee4"
      },
      diffAdded: {
        dark: "darkGreen",
        light: "lightGreen"
      },
      diffRemoved: {
        dark: "darkRed",
        light: "lightRed"
      },
      diffContext: {
        dark: "darkFgMuted",
        light: "lightFgMuted"
      },
      diffHunkHeader: {
        dark: "darkBlue",
        light: "lightBlue"
      },
      diffHighlightAdded: {
        dark: "#3fb950",
        light: "#1a7f37"
      },
      diffHighlightRemoved: {
        dark: "#f85149",
        light: "#cf222e"
      },
      diffAddedBg: {
        dark: "#033a16",
        light: "#dafbe1"
      },
      diffRemovedBg: {
        dark: "#67060c",
        light: "#ffebe9"
      },
      diffContextBg: {
        dark: "darkBgAlt",
        light: "lightBgAlt"
      },
      diffLineNumber: {
        dark: "#484f58",
        light: "#afb8c1"
      },
      diffAddedLineNumberBg: {
        dark: "#033a16",
        light: "#dafbe1"
      },
      diffRemovedLineNumberBg: {
        dark: "#67060c",
        light: "#ffebe9"
      },
      markdownText: {
        dark: "darkFg",
        light: "lightFg"
      },
      markdownHeading: {
        dark: "darkBlue",
        light: "lightBlue"
      },
      markdownLink: {
        dark: "darkBlue",
        light: "lightBlue"
      },
      markdownLinkText: {
        dark: "darkCyan",
        light: "lightCyan"
      },
      markdownCode: {
        dark: "darkPink",
        light: "lightPink"
      },
      markdownBlockQuote: {
        dark: "darkFgMuted",
        light: "lightFgMuted"
      },
      markdownEmph: {
        dark: "darkYellow",
        light: "lightYellow"
      },
      markdownStrong: {
        dark: "darkOrange",
        light: "lightOrange"
      },
      markdownHorizontalRule: {
        dark: "#30363d",
        light: "#d0d7de"
      },
      markdownListItem: {
        dark: "darkBlue",
        light: "lightBlue"
      },
      markdownListEnumeration: {
        dark: "darkCyan",
        light: "lightCyan"
      },
      markdownImage: {
        dark: "darkBlue",
        light: "lightBlue"
      },
      markdownImageText: {
        dark: "darkCyan",
        light: "lightCyan"
      },
      markdownCodeBlock: {
        dark: "darkFg",
        light: "lightFg"
      },
      syntaxComment: {
        dark: "darkFgMuted",
        light: "lightFgMuted"
      },
      syntaxKeyword: {
        dark: "darkPink",
        light: "lightRed"
      },
      syntaxFunction: {
        dark: "darkPurple",
        light: "lightPurple"
      },
      syntaxVariable: {
        dark: "darkOrange",
        light: "lightOrange"
      },
      syntaxString: {
        dark: "darkCyan",
        light: "lightBlue"
      },
      syntaxNumber: {
        dark: "darkBlue",
        light: "lightCyan"
      },
      syntaxType: {
        dark: "darkOrange",
        light: "lightOrange"
      },
      syntaxOperator: {
        dark: "darkPink",
        light: "lightRed"
      },
      syntaxPunctuation: {
        dark: "darkFg",
        light: "lightFg"
      }
    }
  };
});

// src/ui/theme/themes/gruvbox.json
var gruvbox_default;
var init_gruvbox = __esm(() => {
  gruvbox_default = {
    $schema: "https://opencode.ai/theme.json",
    defs: {
      darkBg0: "#282828",
      darkBg1: "#3c3836",
      darkBg2: "#504945",
      darkBg3: "#665c54",
      darkFg0: "#fbf1c7",
      darkFg1: "#ebdbb2",
      darkGray: "#928374",
      darkRed: "#cc241d",
      darkGreen: "#98971a",
      darkYellow: "#d79921",
      darkBlue: "#458588",
      darkPurple: "#b16286",
      darkAqua: "#689d6a",
      darkOrange: "#d65d0e",
      darkRedBright: "#fb4934",
      darkGreenBright: "#b8bb26",
      darkYellowBright: "#fabd2f",
      darkBlueBright: "#83a598",
      darkPurpleBright: "#d3869b",
      darkAquaBright: "#8ec07c",
      darkOrangeBright: "#fe8019",
      lightBg0: "#fbf1c7",
      lightBg1: "#ebdbb2",
      lightBg2: "#d5c4a1",
      lightBg3: "#bdae93",
      lightFg0: "#282828",
      lightFg1: "#3c3836",
      lightGray: "#7c6f64",
      lightRed: "#9d0006",
      lightGreen: "#79740e",
      lightYellow: "#b57614",
      lightBlue: "#076678",
      lightPurple: "#8f3f71",
      lightAqua: "#427b58",
      lightOrange: "#af3a03"
    },
    theme: {
      primary: { dark: "darkBlueBright", light: "lightBlue" },
      secondary: { dark: "darkPurpleBright", light: "lightPurple" },
      accent: { dark: "darkAquaBright", light: "lightAqua" },
      error: { dark: "darkRedBright", light: "lightRed" },
      warning: { dark: "darkOrangeBright", light: "lightOrange" },
      success: { dark: "darkGreenBright", light: "lightGreen" },
      info: { dark: "darkYellowBright", light: "lightYellow" },
      text: { dark: "darkFg1", light: "lightFg1" },
      textMuted: { dark: "darkGray", light: "lightGray" },
      background: { dark: "darkBg0", light: "lightBg0" },
      backgroundPanel: { dark: "darkBg1", light: "lightBg1" },
      backgroundElement: { dark: "darkBg2", light: "lightBg2" },
      border: { dark: "darkBg3", light: "lightBg3" },
      borderActive: { dark: "darkFg1", light: "lightFg1" },
      borderSubtle: { dark: "darkBg2", light: "lightBg2" },
      diffAdded: { dark: "darkGreen", light: "lightGreen" },
      diffRemoved: { dark: "darkRed", light: "lightRed" },
      diffContext: { dark: "darkGray", light: "lightGray" },
      diffHunkHeader: { dark: "darkAqua", light: "lightAqua" },
      diffHighlightAdded: { dark: "darkGreenBright", light: "lightGreen" },
      diffHighlightRemoved: { dark: "darkRedBright", light: "lightRed" },
      diffAddedBg: { dark: "#32302f", light: "#e2e0b5" },
      diffRemovedBg: { dark: "#322929", light: "#e9d8d5" },
      diffContextBg: { dark: "darkBg1", light: "lightBg1" },
      diffLineNumber: { dark: "darkBg3", light: "lightBg3" },
      diffAddedLineNumberBg: { dark: "#2a2827", light: "#d4d2a9" },
      diffRemovedLineNumberBg: { dark: "#2a2222", light: "#d8cbc8" },
      markdownText: { dark: "darkFg1", light: "lightFg1" },
      markdownHeading: { dark: "darkBlueBright", light: "lightBlue" },
      markdownLink: { dark: "darkAquaBright", light: "lightAqua" },
      markdownLinkText: { dark: "darkGreenBright", light: "lightGreen" },
      markdownCode: { dark: "darkYellowBright", light: "lightYellow" },
      markdownBlockQuote: { dark: "darkGray", light: "lightGray" },
      markdownEmph: { dark: "darkPurpleBright", light: "lightPurple" },
      markdownStrong: { dark: "darkOrangeBright", light: "lightOrange" },
      markdownHorizontalRule: { dark: "darkGray", light: "lightGray" },
      markdownListItem: { dark: "darkBlueBright", light: "lightBlue" },
      markdownListEnumeration: {
        dark: "darkAquaBright",
        light: "lightAqua"
      },
      markdownImage: { dark: "darkAquaBright", light: "lightAqua" },
      markdownImageText: { dark: "darkGreenBright", light: "lightGreen" },
      markdownCodeBlock: { dark: "darkFg1", light: "lightFg1" },
      syntaxComment: { dark: "darkGray", light: "lightGray" },
      syntaxKeyword: { dark: "darkRedBright", light: "lightRed" },
      syntaxFunction: { dark: "darkGreenBright", light: "lightGreen" },
      syntaxVariable: { dark: "darkBlueBright", light: "lightBlue" },
      syntaxString: { dark: "darkYellowBright", light: "lightYellow" },
      syntaxNumber: { dark: "darkPurpleBright", light: "lightPurple" },
      syntaxType: { dark: "darkAquaBright", light: "lightAqua" },
      syntaxOperator: { dark: "darkOrangeBright", light: "lightOrange" },
      syntaxPunctuation: { dark: "darkFg1", light: "lightFg1" }
    }
  };
});

// src/ui/theme/themes/kanagawa.json
var kanagawa_default;
var init_kanagawa = __esm(() => {
  kanagawa_default = {
    $schema: "https://opencode.ai/theme.json",
    defs: {
      sumiInk0: "#1F1F28",
      sumiInk1: "#2A2A37",
      sumiInk2: "#363646",
      sumiInk3: "#54546D",
      fujiWhite: "#DCD7BA",
      oldWhite: "#C8C093",
      fujiGray: "#727169",
      oniViolet: "#957FB8",
      crystalBlue: "#7E9CD8",
      carpYellow: "#C38D9D",
      sakuraPink: "#D27E99",
      waveAqua: "#76946A",
      roninYellow: "#D7A657",
      dragonRed: "#E82424",
      lotusGreen: "#98BB6C",
      waveBlue: "#2D4F67",
      lightBg: "#F2E9DE",
      lightPaper: "#EAE4D7",
      lightText: "#54433A",
      lightGray: "#9E9389"
    },
    theme: {
      primary: { dark: "crystalBlue", light: "waveBlue" },
      secondary: { dark: "oniViolet", light: "oniViolet" },
      accent: { dark: "sakuraPink", light: "sakuraPink" },
      error: { dark: "dragonRed", light: "dragonRed" },
      warning: { dark: "roninYellow", light: "roninYellow" },
      success: { dark: "lotusGreen", light: "lotusGreen" },
      info: { dark: "waveAqua", light: "waveAqua" },
      text: { dark: "fujiWhite", light: "lightText" },
      textMuted: { dark: "fujiGray", light: "lightGray" },
      background: { dark: "sumiInk0", light: "lightBg" },
      backgroundPanel: { dark: "sumiInk1", light: "lightPaper" },
      backgroundElement: { dark: "sumiInk2", light: "#E3DCD2" },
      border: { dark: "sumiInk3", light: "#D4CBBF" },
      borderActive: { dark: "carpYellow", light: "carpYellow" },
      borderSubtle: { dark: "sumiInk2", light: "#DCD4C9" },
      diffAdded: { dark: "lotusGreen", light: "lotusGreen" },
      diffRemoved: { dark: "dragonRed", light: "dragonRed" },
      diffContext: { dark: "fujiGray", light: "lightGray" },
      diffHunkHeader: { dark: "waveBlue", light: "waveBlue" },
      diffHighlightAdded: { dark: "#A9D977", light: "#89AF5B" },
      diffHighlightRemoved: { dark: "#F24A4A", light: "#D61F1F" },
      diffAddedBg: { dark: "#252E25", light: "#EAF3E4" },
      diffRemovedBg: { dark: "#362020", light: "#FBE6E6" },
      diffContextBg: { dark: "sumiInk1", light: "lightPaper" },
      diffLineNumber: { dark: "sumiInk3", light: "#C7BEB4" },
      diffAddedLineNumberBg: { dark: "#202820", light: "#DDE8D6" },
      diffRemovedLineNumberBg: { dark: "#2D1C1C", light: "#F2DADA" },
      markdownText: { dark: "fujiWhite", light: "lightText" },
      markdownHeading: { dark: "oniViolet", light: "oniViolet" },
      markdownLink: { dark: "crystalBlue", light: "waveBlue" },
      markdownLinkText: { dark: "waveAqua", light: "waveAqua" },
      markdownCode: { dark: "lotusGreen", light: "lotusGreen" },
      markdownBlockQuote: { dark: "fujiGray", light: "lightGray" },
      markdownEmph: { dark: "carpYellow", light: "carpYellow" },
      markdownStrong: { dark: "roninYellow", light: "roninYellow" },
      markdownHorizontalRule: { dark: "fujiGray", light: "lightGray" },
      markdownListItem: { dark: "crystalBlue", light: "waveBlue" },
      markdownListEnumeration: { dark: "waveAqua", light: "waveAqua" },
      markdownImage: { dark: "crystalBlue", light: "waveBlue" },
      markdownImageText: { dark: "waveAqua", light: "waveAqua" },
      markdownCodeBlock: { dark: "fujiWhite", light: "lightText" },
      syntaxComment: { dark: "fujiGray", light: "lightGray" },
      syntaxKeyword: { dark: "oniViolet", light: "oniViolet" },
      syntaxFunction: { dark: "crystalBlue", light: "waveBlue" },
      syntaxVariable: { dark: "fujiWhite", light: "lightText" },
      syntaxString: { dark: "lotusGreen", light: "lotusGreen" },
      syntaxNumber: { dark: "roninYellow", light: "roninYellow" },
      syntaxType: { dark: "carpYellow", light: "carpYellow" },
      syntaxOperator: { dark: "sakuraPink", light: "sakuraPink" },
      syntaxPunctuation: { dark: "fujiWhite", light: "lightText" }
    }
  };
});

// src/ui/theme/themes/lucent-orng.json
var lucent_orng_default;
var init_lucent_orng = __esm(() => {
  lucent_orng_default = {
    $schema: "https://opencode.ai/theme.json",
    defs: {
      darkStep6: "#3c3c3c",
      darkStep11: "#808080",
      darkStep12: "#eeeeee",
      darkSecondary: "#EE7948",
      darkAccent: "#FFF7F1",
      darkRed: "#e06c75",
      darkOrange: "#EC5B2B",
      darkBlue: "#6ba1e6",
      darkCyan: "#56b6c2",
      darkYellow: "#e5c07b",
      darkPanelBg: "#2a1a1599",
      lightStep6: "#d4d4d4",
      lightStep11: "#8a8a8a",
      lightStep12: "#1a1a1a",
      lightSecondary: "#EE7948",
      lightAccent: "#c94d24",
      lightRed: "#d1383d",
      lightOrange: "#EC5B2B",
      lightBlue: "#0062d1",
      lightCyan: "#318795",
      lightYellow: "#b0851f",
      lightPanelBg: "#fff5f099"
    },
    theme: {
      primary: {
        dark: "darkOrange",
        light: "lightOrange"
      },
      secondary: {
        dark: "darkSecondary",
        light: "lightSecondary"
      },
      accent: {
        dark: "darkAccent",
        light: "lightAccent"
      },
      error: {
        dark: "darkRed",
        light: "lightRed"
      },
      warning: {
        dark: "darkOrange",
        light: "lightOrange"
      },
      success: {
        dark: "darkBlue",
        light: "lightBlue"
      },
      info: {
        dark: "darkCyan",
        light: "lightCyan"
      },
      text: {
        dark: "darkStep12",
        light: "lightStep12"
      },
      textMuted: {
        dark: "darkStep11",
        light: "lightStep11"
      },
      selectedListItemText: {
        dark: "#0a0a0a",
        light: "#ffffff"
      },
      background: {
        dark: "transparent",
        light: "transparent"
      },
      backgroundPanel: {
        dark: "transparent",
        light: "transparent"
      },
      backgroundElement: {
        dark: "transparent",
        light: "transparent"
      },
      backgroundMenu: {
        dark: "darkPanelBg",
        light: "lightPanelBg"
      },
      border: {
        dark: "darkOrange",
        light: "lightOrange"
      },
      borderActive: {
        dark: "darkSecondary",
        light: "lightAccent"
      },
      borderSubtle: {
        dark: "darkStep6",
        light: "lightStep6"
      },
      diffAdded: {
        dark: "darkBlue",
        light: "lightBlue"
      },
      diffRemoved: {
        dark: "#c53b53",
        light: "#c53b53"
      },
      diffContext: {
        dark: "#828bb8",
        light: "#7086b5"
      },
      diffHunkHeader: {
        dark: "#828bb8",
        light: "#7086b5"
      },
      diffHighlightAdded: {
        dark: "darkBlue",
        light: "lightBlue"
      },
      diffHighlightRemoved: {
        dark: "#e26a75",
        light: "#f52a65"
      },
      diffAddedBg: {
        dark: "transparent",
        light: "transparent"
      },
      diffRemovedBg: {
        dark: "transparent",
        light: "transparent"
      },
      diffContextBg: {
        dark: "transparent",
        light: "transparent"
      },
      diffLineNumber: {
        dark: "#666666",
        light: "#999999"
      },
      diffAddedLineNumberBg: {
        dark: "transparent",
        light: "transparent"
      },
      diffRemovedLineNumberBg: {
        dark: "transparent",
        light: "transparent"
      },
      markdownText: {
        dark: "darkStep12",
        light: "lightStep12"
      },
      markdownHeading: {
        dark: "darkOrange",
        light: "lightOrange"
      },
      markdownLink: {
        dark: "darkOrange",
        light: "lightOrange"
      },
      markdownLinkText: {
        dark: "darkCyan",
        light: "lightCyan"
      },
      markdownCode: {
        dark: "darkBlue",
        light: "lightBlue"
      },
      markdownBlockQuote: {
        dark: "darkAccent",
        light: "lightYellow"
      },
      markdownEmph: {
        dark: "darkYellow",
        light: "lightYellow"
      },
      markdownStrong: {
        dark: "darkSecondary",
        light: "lightOrange"
      },
      markdownHorizontalRule: {
        dark: "darkStep11",
        light: "lightStep11"
      },
      markdownListItem: {
        dark: "darkOrange",
        light: "lightOrange"
      },
      markdownListEnumeration: {
        dark: "darkCyan",
        light: "lightCyan"
      },
      markdownImage: {
        dark: "darkOrange",
        light: "lightOrange"
      },
      markdownImageText: {
        dark: "darkCyan",
        light: "lightCyan"
      },
      markdownCodeBlock: {
        dark: "darkStep12",
        light: "lightStep12"
      },
      syntaxComment: {
        dark: "darkStep11",
        light: "lightStep11"
      },
      syntaxKeyword: {
        dark: "darkOrange",
        light: "lightOrange"
      },
      syntaxFunction: {
        dark: "darkSecondary",
        light: "lightAccent"
      },
      syntaxVariable: {
        dark: "darkRed",
        light: "lightRed"
      },
      syntaxString: {
        dark: "darkBlue",
        light: "lightBlue"
      },
      syntaxNumber: {
        dark: "darkAccent",
        light: "lightOrange"
      },
      syntaxType: {
        dark: "darkYellow",
        light: "lightYellow"
      },
      syntaxOperator: {
        dark: "darkCyan",
        light: "lightCyan"
      },
      syntaxPunctuation: {
        dark: "darkStep12",
        light: "lightStep12"
      }
    }
  };
});

// src/ui/theme/themes/material.json
var material_default;
var init_material = __esm(() => {
  material_default = {
    $schema: "https://opencode.ai/theme.json",
    defs: {
      darkBg: "#263238",
      darkBgAlt: "#1e272c",
      darkBgPanel: "#37474f",
      darkFg: "#eeffff",
      darkFgMuted: "#546e7a",
      darkRed: "#f07178",
      darkPink: "#f78c6c",
      darkOrange: "#ffcb6b",
      darkYellow: "#ffcb6b",
      darkGreen: "#c3e88d",
      darkCyan: "#89ddff",
      darkBlue: "#82aaff",
      darkPurple: "#c792ea",
      darkViolet: "#bb80b3",
      lightBg: "#fafafa",
      lightBgAlt: "#f5f5f5",
      lightBgPanel: "#e7e7e8",
      lightFg: "#263238",
      lightFgMuted: "#90a4ae",
      lightRed: "#e53935",
      lightPink: "#ec407a",
      lightOrange: "#f4511e",
      lightYellow: "#ffb300",
      lightGreen: "#91b859",
      lightCyan: "#39adb5",
      lightBlue: "#6182b8",
      lightPurple: "#7c4dff",
      lightViolet: "#945eb8"
    },
    theme: {
      primary: {
        dark: "darkBlue",
        light: "lightBlue"
      },
      secondary: {
        dark: "darkPurple",
        light: "lightPurple"
      },
      accent: {
        dark: "darkCyan",
        light: "lightCyan"
      },
      error: {
        dark: "darkRed",
        light: "lightRed"
      },
      warning: {
        dark: "darkYellow",
        light: "lightYellow"
      },
      success: {
        dark: "darkGreen",
        light: "lightGreen"
      },
      info: {
        dark: "darkOrange",
        light: "lightOrange"
      },
      text: {
        dark: "darkFg",
        light: "lightFg"
      },
      textMuted: {
        dark: "darkFgMuted",
        light: "lightFgMuted"
      },
      background: {
        dark: "darkBg",
        light: "lightBg"
      },
      backgroundPanel: {
        dark: "darkBgAlt",
        light: "lightBgAlt"
      },
      backgroundElement: {
        dark: "darkBgPanel",
        light: "lightBgPanel"
      },
      border: {
        dark: "#37474f",
        light: "#e0e0e0"
      },
      borderActive: {
        dark: "darkBlue",
        light: "lightBlue"
      },
      borderSubtle: {
        dark: "#1e272c",
        light: "#eeeeee"
      },
      diffAdded: {
        dark: "darkGreen",
        light: "lightGreen"
      },
      diffRemoved: {
        dark: "darkRed",
        light: "lightRed"
      },
      diffContext: {
        dark: "darkFgMuted",
        light: "lightFgMuted"
      },
      diffHunkHeader: {
        dark: "darkCyan",
        light: "lightCyan"
      },
      diffHighlightAdded: {
        dark: "darkGreen",
        light: "lightGreen"
      },
      diffHighlightRemoved: {
        dark: "darkRed",
        light: "lightRed"
      },
      diffAddedBg: {
        dark: "#2e3c2b",
        light: "#e8f5e9"
      },
      diffRemovedBg: {
        dark: "#3c2b2b",
        light: "#ffebee"
      },
      diffContextBg: {
        dark: "darkBgAlt",
        light: "lightBgAlt"
      },
      diffLineNumber: {
        dark: "#37474f",
        light: "#cfd8dc"
      },
      diffAddedLineNumberBg: {
        dark: "#2e3c2b",
        light: "#e8f5e9"
      },
      diffRemovedLineNumberBg: {
        dark: "#3c2b2b",
        light: "#ffebee"
      },
      markdownText: {
        dark: "darkFg",
        light: "lightFg"
      },
      markdownHeading: {
        dark: "darkBlue",
        light: "lightBlue"
      },
      markdownLink: {
        dark: "darkCyan",
        light: "lightCyan"
      },
      markdownLinkText: {
        dark: "darkPurple",
        light: "lightPurple"
      },
      markdownCode: {
        dark: "darkGreen",
        light: "lightGreen"
      },
      markdownBlockQuote: {
        dark: "darkFgMuted",
        light: "lightFgMuted"
      },
      markdownEmph: {
        dark: "darkYellow",
        light: "lightYellow"
      },
      markdownStrong: {
        dark: "darkOrange",
        light: "lightOrange"
      },
      markdownHorizontalRule: {
        dark: "#37474f",
        light: "#e0e0e0"
      },
      markdownListItem: {
        dark: "darkBlue",
        light: "lightBlue"
      },
      markdownListEnumeration: {
        dark: "darkCyan",
        light: "lightCyan"
      },
      markdownImage: {
        dark: "darkCyan",
        light: "lightCyan"
      },
      markdownImageText: {
        dark: "darkPurple",
        light: "lightPurple"
      },
      markdownCodeBlock: {
        dark: "darkFg",
        light: "lightFg"
      },
      syntaxComment: {
        dark: "darkFgMuted",
        light: "lightFgMuted"
      },
      syntaxKeyword: {
        dark: "darkPurple",
        light: "lightPurple"
      },
      syntaxFunction: {
        dark: "darkBlue",
        light: "lightBlue"
      },
      syntaxVariable: {
        dark: "darkFg",
        light: "lightFg"
      },
      syntaxString: {
        dark: "darkGreen",
        light: "lightGreen"
      },
      syntaxNumber: {
        dark: "darkOrange",
        light: "lightOrange"
      },
      syntaxType: {
        dark: "darkYellow",
        light: "lightYellow"
      },
      syntaxOperator: {
        dark: "darkCyan",
        light: "lightCyan"
      },
      syntaxPunctuation: {
        dark: "darkFg",
        light: "lightFg"
      }
    }
  };
});

// src/ui/theme/themes/matrix.json
var matrix_default;
var init_matrix = __esm(() => {
  matrix_default = {
    $schema: "https://opencode.ai/theme.json",
    defs: {
      matrixInk0: "#0a0e0a",
      matrixInk1: "#0e130d",
      matrixInk2: "#141c12",
      matrixInk3: "#1e2a1b",
      rainGreen: "#2eff6a",
      rainGreenDim: "#1cc24b",
      rainGreenHi: "#62ff94",
      rainCyan: "#00efff",
      rainTeal: "#24f6d9",
      rainPurple: "#c770ff",
      rainOrange: "#ffa83d",
      alertRed: "#ff4b4b",
      alertYellow: "#e6ff57",
      alertBlue: "#30b3ff",
      rainGray: "#8ca391",
      lightBg: "#eef3ea",
      lightPaper: "#e4ebe1",
      lightInk1: "#dae1d7",
      lightText: "#203022",
      lightGray: "#748476"
    },
    theme: {
      primary: { dark: "rainGreen", light: "rainGreenDim" },
      secondary: { dark: "rainCyan", light: "rainTeal" },
      accent: { dark: "rainPurple", light: "rainPurple" },
      error: { dark: "alertRed", light: "alertRed" },
      warning: { dark: "alertYellow", light: "alertYellow" },
      success: { dark: "rainGreenHi", light: "rainGreenDim" },
      info: { dark: "alertBlue", light: "alertBlue" },
      text: { dark: "rainGreenHi", light: "lightText" },
      textMuted: { dark: "rainGray", light: "lightGray" },
      background: { dark: "matrixInk0", light: "lightBg" },
      backgroundPanel: { dark: "matrixInk1", light: "lightPaper" },
      backgroundElement: { dark: "matrixInk2", light: "lightInk1" },
      border: { dark: "matrixInk3", light: "lightGray" },
      borderActive: { dark: "rainGreen", light: "rainGreenDim" },
      borderSubtle: { dark: "matrixInk2", light: "lightInk1" },
      diffAdded: { dark: "rainGreenDim", light: "rainGreenDim" },
      diffRemoved: { dark: "alertRed", light: "alertRed" },
      diffContext: { dark: "rainGray", light: "lightGray" },
      diffHunkHeader: { dark: "alertBlue", light: "alertBlue" },
      diffHighlightAdded: { dark: "#77ffaf", light: "#5dac7e" },
      diffHighlightRemoved: { dark: "#ff7171", light: "#d53a3a" },
      diffAddedBg: { dark: "#132616", light: "#e0efde" },
      diffRemovedBg: { dark: "#261212", light: "#f9e5e5" },
      diffContextBg: { dark: "matrixInk1", light: "lightPaper" },
      diffLineNumber: { dark: "matrixInk3", light: "lightGray" },
      diffAddedLineNumberBg: { dark: "#0f1b11", light: "#d6e7d2" },
      diffRemovedLineNumberBg: { dark: "#1b1414", light: "#f2d2d2" },
      markdownText: { dark: "rainGreenHi", light: "lightText" },
      markdownHeading: { dark: "rainCyan", light: "rainTeal" },
      markdownLink: { dark: "alertBlue", light: "alertBlue" },
      markdownLinkText: { dark: "rainTeal", light: "rainTeal" },
      markdownCode: { dark: "rainGreenDim", light: "rainGreenDim" },
      markdownBlockQuote: { dark: "rainGray", light: "lightGray" },
      markdownEmph: { dark: "rainOrange", light: "rainOrange" },
      markdownStrong: { dark: "alertYellow", light: "alertYellow" },
      markdownHorizontalRule: { dark: "rainGray", light: "lightGray" },
      markdownListItem: { dark: "alertBlue", light: "alertBlue" },
      markdownListEnumeration: { dark: "rainTeal", light: "rainTeal" },
      markdownImage: { dark: "alertBlue", light: "alertBlue" },
      markdownImageText: { dark: "rainTeal", light: "rainTeal" },
      markdownCodeBlock: { dark: "rainGreenHi", light: "lightText" },
      syntaxComment: { dark: "rainGray", light: "lightGray" },
      syntaxKeyword: { dark: "rainPurple", light: "rainPurple" },
      syntaxFunction: { dark: "alertBlue", light: "alertBlue" },
      syntaxVariable: { dark: "rainGreenHi", light: "lightText" },
      syntaxString: { dark: "rainGreenDim", light: "rainGreenDim" },
      syntaxNumber: { dark: "rainOrange", light: "rainOrange" },
      syntaxType: { dark: "alertYellow", light: "alertYellow" },
      syntaxOperator: { dark: "rainTeal", light: "rainTeal" },
      syntaxPunctuation: { dark: "rainGreenHi", light: "lightText" }
    }
  };
});

// src/ui/theme/themes/mercury.json
var mercury_default;
var init_mercury = __esm(() => {
  mercury_default = {
    $schema: "https://opencode.ai/theme.json",
    defs: {
      "purple-800": "#3442a6",
      "purple-700": "#465bd1",
      "purple-600": "#5266eb",
      "purple-400": "#8da4f5",
      "purple-300": "#a7b6f8",
      "red-700": "#b0175f",
      "red-600": "#d03275",
      "red-400": "#fc92b4",
      "green-700": "#036e43",
      "green-600": "#188554",
      "green-400": "#77c599",
      "orange-700": "#a44200",
      "orange-600": "#c45000",
      "orange-400": "#fc9b6f",
      "blue-600": "#007f95",
      "blue-400": "#77becf",
      "neutral-1000": "#10101a",
      "neutral-950": "#171721",
      "neutral-900": "#1e1e2a",
      "neutral-800": "#272735",
      "neutral-700": "#363644",
      "neutral-600": "#535461",
      "neutral-500": "#70707d",
      "neutral-400": "#9d9da8",
      "neutral-300": "#c3c3cc",
      "neutral-200": "#dddde5",
      "neutral-100": "#f4f5f9",
      "neutral-050": "#fbfcfd",
      "neutral-000": "#ffffff",
      "neutral-150": "#ededf3",
      "border-light": "#7073931a",
      "border-light-subtle": "#7073930f",
      "border-dark": "#b4b7c81f",
      "border-dark-subtle": "#b4b7c814",
      "diff-added-light": "#1885541a",
      "diff-removed-light": "#d032751a",
      "diff-added-dark": "#77c59933",
      "diff-removed-dark": "#fc92b433"
    },
    theme: {
      primary: {
        light: "purple-600",
        dark: "purple-400"
      },
      secondary: {
        light: "purple-700",
        dark: "purple-300"
      },
      accent: {
        light: "purple-400",
        dark: "purple-400"
      },
      error: {
        light: "red-700",
        dark: "red-400"
      },
      warning: {
        light: "orange-700",
        dark: "orange-400"
      },
      success: {
        light: "green-700",
        dark: "green-400"
      },
      info: {
        light: "blue-600",
        dark: "blue-400"
      },
      text: {
        light: "neutral-700",
        dark: "neutral-200"
      },
      textMuted: {
        light: "neutral-500",
        dark: "neutral-400"
      },
      background: {
        light: "neutral-000",
        dark: "neutral-950"
      },
      backgroundPanel: {
        light: "neutral-050",
        dark: "neutral-1000"
      },
      backgroundElement: {
        light: "neutral-100",
        dark: "neutral-800"
      },
      border: {
        light: "border-light",
        dark: "border-dark"
      },
      borderActive: {
        light: "purple-600",
        dark: "purple-400"
      },
      borderSubtle: {
        light: "border-light-subtle",
        dark: "border-dark-subtle"
      },
      diffAdded: {
        light: "green-700",
        dark: "green-400"
      },
      diffRemoved: {
        light: "red-700",
        dark: "red-400"
      },
      diffContext: {
        light: "neutral-500",
        dark: "neutral-400"
      },
      diffHunkHeader: {
        light: "neutral-500",
        dark: "neutral-400"
      },
      diffHighlightAdded: {
        light: "green-700",
        dark: "green-400"
      },
      diffHighlightRemoved: {
        light: "red-700",
        dark: "red-400"
      },
      diffAddedBg: {
        light: "diff-added-light",
        dark: "diff-added-dark"
      },
      diffRemovedBg: {
        light: "diff-removed-light",
        dark: "diff-removed-dark"
      },
      diffContextBg: {
        light: "neutral-050",
        dark: "neutral-900"
      },
      diffLineNumber: {
        light: "neutral-600",
        dark: "neutral-300"
      },
      diffAddedLineNumberBg: {
        light: "diff-added-light",
        dark: "diff-added-dark"
      },
      diffRemovedLineNumberBg: {
        light: "diff-removed-light",
        dark: "diff-removed-dark"
      },
      markdownText: {
        light: "neutral-700",
        dark: "neutral-200"
      },
      markdownHeading: {
        light: "neutral-900",
        dark: "neutral-000"
      },
      markdownLink: {
        light: "purple-700",
        dark: "purple-400"
      },
      markdownLinkText: {
        light: "purple-600",
        dark: "purple-300"
      },
      markdownCode: {
        light: "green-700",
        dark: "green-400"
      },
      markdownBlockQuote: {
        light: "neutral-500",
        dark: "neutral-400"
      },
      markdownEmph: {
        light: "orange-700",
        dark: "orange-400"
      },
      markdownStrong: {
        light: "neutral-900",
        dark: "neutral-100"
      },
      markdownHorizontalRule: {
        light: "border-light",
        dark: "border-dark"
      },
      markdownListItem: {
        light: "neutral-900",
        dark: "neutral-000"
      },
      markdownListEnumeration: {
        light: "purple-600",
        dark: "purple-400"
      },
      markdownImage: {
        light: "purple-700",
        dark: "purple-400"
      },
      markdownImageText: {
        light: "purple-600",
        dark: "purple-300"
      },
      markdownCodeBlock: {
        light: "neutral-700",
        dark: "neutral-200"
      },
      syntaxComment: {
        light: "neutral-500",
        dark: "neutral-400"
      },
      syntaxKeyword: {
        light: "purple-700",
        dark: "purple-400"
      },
      syntaxFunction: {
        light: "purple-600",
        dark: "purple-400"
      },
      syntaxVariable: {
        light: "blue-600",
        dark: "blue-400"
      },
      syntaxString: {
        light: "green-700",
        dark: "green-400"
      },
      syntaxNumber: {
        light: "orange-700",
        dark: "orange-400"
      },
      syntaxType: {
        light: "blue-600",
        dark: "blue-400"
      },
      syntaxOperator: {
        light: "purple-700",
        dark: "purple-400"
      },
      syntaxPunctuation: {
        light: "neutral-700",
        dark: "neutral-200"
      }
    }
  };
});

// src/ui/theme/themes/monokai.json
var monokai_default;
var init_monokai = __esm(() => {
  monokai_default = {
    $schema: "https://opencode.ai/theme.json",
    defs: {
      background: "#272822",
      backgroundAlt: "#1e1f1c",
      backgroundPanel: "#3e3d32",
      foreground: "#f8f8f2",
      comment: "#75715e",
      red: "#f92672",
      orange: "#fd971f",
      lightOrange: "#e69f66",
      yellow: "#e6db74",
      green: "#a6e22e",
      cyan: "#66d9ef",
      blue: "#66d9ef",
      purple: "#ae81ff",
      pink: "#f92672"
    },
    theme: {
      primary: {
        dark: "cyan",
        light: "blue"
      },
      secondary: {
        dark: "purple",
        light: "purple"
      },
      accent: {
        dark: "green",
        light: "green"
      },
      error: {
        dark: "red",
        light: "red"
      },
      warning: {
        dark: "yellow",
        light: "orange"
      },
      success: {
        dark: "green",
        light: "green"
      },
      info: {
        dark: "orange",
        light: "orange"
      },
      text: {
        dark: "foreground",
        light: "#272822"
      },
      textMuted: {
        dark: "comment",
        light: "#75715e"
      },
      background: {
        dark: "#272822",
        light: "#fafafa"
      },
      backgroundPanel: {
        dark: "#1e1f1c",
        light: "#f0f0f0"
      },
      backgroundElement: {
        dark: "#3e3d32",
        light: "#e0e0e0"
      },
      border: {
        dark: "#3e3d32",
        light: "#d0d0d0"
      },
      borderActive: {
        dark: "cyan",
        light: "blue"
      },
      borderSubtle: {
        dark: "#1e1f1c",
        light: "#e8e8e8"
      },
      diffAdded: {
        dark: "green",
        light: "green"
      },
      diffRemoved: {
        dark: "red",
        light: "red"
      },
      diffContext: {
        dark: "comment",
        light: "#75715e"
      },
      diffHunkHeader: {
        dark: "comment",
        light: "#75715e"
      },
      diffHighlightAdded: {
        dark: "green",
        light: "green"
      },
      diffHighlightRemoved: {
        dark: "red",
        light: "red"
      },
      diffAddedBg: {
        dark: "#1a3a1a",
        light: "#e0ffe0"
      },
      diffRemovedBg: {
        dark: "#3a1a1a",
        light: "#ffe0e0"
      },
      diffContextBg: {
        dark: "#1e1f1c",
        light: "#f0f0f0"
      },
      diffLineNumber: {
        dark: "#3e3d32",
        light: "#d0d0d0"
      },
      diffAddedLineNumberBg: {
        dark: "#1a3a1a",
        light: "#e0ffe0"
      },
      diffRemovedLineNumberBg: {
        dark: "#3a1a1a",
        light: "#ffe0e0"
      },
      markdownText: {
        dark: "foreground",
        light: "#272822"
      },
      markdownHeading: {
        dark: "pink",
        light: "pink"
      },
      markdownLink: {
        dark: "cyan",
        light: "blue"
      },
      markdownLinkText: {
        dark: "purple",
        light: "purple"
      },
      markdownCode: {
        dark: "green",
        light: "green"
      },
      markdownBlockQuote: {
        dark: "comment",
        light: "#75715e"
      },
      markdownEmph: {
        dark: "yellow",
        light: "orange"
      },
      markdownStrong: {
        dark: "orange",
        light: "orange"
      },
      markdownHorizontalRule: {
        dark: "comment",
        light: "#75715e"
      },
      markdownListItem: {
        dark: "cyan",
        light: "blue"
      },
      markdownListEnumeration: {
        dark: "purple",
        light: "purple"
      },
      markdownImage: {
        dark: "cyan",
        light: "blue"
      },
      markdownImageText: {
        dark: "purple",
        light: "purple"
      },
      markdownCodeBlock: {
        dark: "foreground",
        light: "#272822"
      },
      syntaxComment: {
        dark: "comment",
        light: "#75715e"
      },
      syntaxKeyword: {
        dark: "pink",
        light: "pink"
      },
      syntaxFunction: {
        dark: "green",
        light: "green"
      },
      syntaxVariable: {
        dark: "foreground",
        light: "#272822"
      },
      syntaxString: {
        dark: "yellow",
        light: "orange"
      },
      syntaxNumber: {
        dark: "purple",
        light: "purple"
      },
      syntaxType: {
        dark: "cyan",
        light: "blue"
      },
      syntaxOperator: {
        dark: "pink",
        light: "pink"
      },
      syntaxPunctuation: {
        dark: "foreground",
        light: "#272822"
      }
    }
  };
});

// src/ui/theme/themes/nightowl.json
var nightowl_default;
var init_nightowl = __esm(() => {
  nightowl_default = {
    $schema: "https://opencode.ai/theme.json",
    defs: {
      nightOwlBg: "#011627",
      nightOwlFg: "#d6deeb",
      nightOwlBlue: "#82AAFF",
      nightOwlCyan: "#7fdbca",
      nightOwlGreen: "#c5e478",
      nightOwlYellow: "#ecc48d",
      nightOwlOrange: "#F78C6C",
      nightOwlRed: "#EF5350",
      nightOwlPink: "#ff5874",
      nightOwlPurple: "#c792ea",
      nightOwlMuted: "#5f7e97",
      nightOwlGray: "#637777",
      nightOwlLightGray: "#89a4bb",
      nightOwlPanel: "#0b253a"
    },
    theme: {
      primary: {
        dark: "nightOwlBlue",
        light: "nightOwlBlue"
      },
      secondary: {
        dark: "nightOwlCyan",
        light: "nightOwlCyan"
      },
      accent: {
        dark: "nightOwlPurple",
        light: "nightOwlPurple"
      },
      error: {
        dark: "nightOwlRed",
        light: "nightOwlRed"
      },
      warning: {
        dark: "nightOwlYellow",
        light: "nightOwlYellow"
      },
      success: {
        dark: "nightOwlGreen",
        light: "nightOwlGreen"
      },
      info: {
        dark: "nightOwlBlue",
        light: "nightOwlBlue"
      },
      text: {
        dark: "nightOwlFg",
        light: "nightOwlFg"
      },
      textMuted: {
        dark: "nightOwlMuted",
        light: "nightOwlMuted"
      },
      background: {
        dark: "nightOwlBg",
        light: "nightOwlBg"
      },
      backgroundPanel: {
        dark: "nightOwlPanel",
        light: "nightOwlPanel"
      },
      backgroundElement: {
        dark: "nightOwlPanel",
        light: "nightOwlPanel"
      },
      border: {
        dark: "nightOwlMuted",
        light: "nightOwlMuted"
      },
      borderActive: {
        dark: "nightOwlBlue",
        light: "nightOwlBlue"
      },
      borderSubtle: {
        dark: "nightOwlMuted",
        light: "nightOwlMuted"
      },
      diffAdded: {
        dark: "nightOwlGreen",
        light: "nightOwlGreen"
      },
      diffRemoved: {
        dark: "nightOwlRed",
        light: "nightOwlRed"
      },
      diffContext: {
        dark: "nightOwlMuted",
        light: "nightOwlMuted"
      },
      diffHunkHeader: {
        dark: "nightOwlMuted",
        light: "nightOwlMuted"
      },
      diffHighlightAdded: {
        dark: "nightOwlGreen",
        light: "nightOwlGreen"
      },
      diffHighlightRemoved: {
        dark: "nightOwlRed",
        light: "nightOwlRed"
      },
      diffAddedBg: {
        dark: "#0a2e1a",
        light: "#0a2e1a"
      },
      diffRemovedBg: {
        dark: "#2d1b1b",
        light: "#2d1b1b"
      },
      diffContextBg: {
        dark: "nightOwlPanel",
        light: "nightOwlPanel"
      },
      diffLineNumber: {
        dark: "nightOwlMuted",
        light: "nightOwlMuted"
      },
      diffAddedLineNumberBg: {
        dark: "#0a2e1a",
        light: "#0a2e1a"
      },
      diffRemovedLineNumberBg: {
        dark: "#2d1b1b",
        light: "#2d1b1b"
      },
      markdownText: {
        dark: "nightOwlFg",
        light: "nightOwlFg"
      },
      markdownHeading: {
        dark: "nightOwlBlue",
        light: "nightOwlBlue"
      },
      markdownLink: {
        dark: "nightOwlCyan",
        light: "nightOwlCyan"
      },
      markdownLinkText: {
        dark: "nightOwlBlue",
        light: "nightOwlBlue"
      },
      markdownCode: {
        dark: "nightOwlGreen",
        light: "nightOwlGreen"
      },
      markdownBlockQuote: {
        dark: "nightOwlMuted",
        light: "nightOwlMuted"
      },
      markdownEmph: {
        dark: "nightOwlPurple",
        light: "nightOwlPurple"
      },
      markdownStrong: {
        dark: "nightOwlYellow",
        light: "nightOwlYellow"
      },
      markdownHorizontalRule: {
        dark: "nightOwlMuted",
        light: "nightOwlMuted"
      },
      markdownListItem: {
        dark: "nightOwlBlue",
        light: "nightOwlBlue"
      },
      markdownListEnumeration: {
        dark: "nightOwlCyan",
        light: "nightOwlCyan"
      },
      markdownImage: {
        dark: "nightOwlCyan",
        light: "nightOwlCyan"
      },
      markdownImageText: {
        dark: "nightOwlBlue",
        light: "nightOwlBlue"
      },
      markdownCodeBlock: {
        dark: "nightOwlFg",
        light: "nightOwlFg"
      },
      syntaxComment: {
        dark: "nightOwlGray",
        light: "nightOwlGray"
      },
      syntaxKeyword: {
        dark: "nightOwlPurple",
        light: "nightOwlPurple"
      },
      syntaxFunction: {
        dark: "nightOwlBlue",
        light: "nightOwlBlue"
      },
      syntaxVariable: {
        dark: "nightOwlFg",
        light: "nightOwlFg"
      },
      syntaxString: {
        dark: "nightOwlYellow",
        light: "nightOwlYellow"
      },
      syntaxNumber: {
        dark: "nightOwlOrange",
        light: "nightOwlOrange"
      },
      syntaxType: {
        dark: "nightOwlGreen",
        light: "nightOwlGreen"
      },
      syntaxOperator: {
        dark: "nightOwlCyan",
        light: "nightOwlCyan"
      },
      syntaxPunctuation: {
        dark: "nightOwlFg",
        light: "nightOwlFg"
      }
    }
  };
});

// src/ui/theme/themes/nord.json
var nord_default;
var init_nord = __esm(() => {
  nord_default = {
    $schema: "https://opencode.ai/theme.json",
    defs: {
      nord0: "#2E3440",
      nord1: "#3B4252",
      nord2: "#434C5E",
      nord3: "#4C566A",
      nord4: "#D8DEE9",
      nord5: "#E5E9F0",
      nord6: "#ECEFF4",
      nord7: "#8FBCBB",
      nord8: "#88C0D0",
      nord9: "#81A1C1",
      nord10: "#5E81AC",
      nord11: "#BF616A",
      nord12: "#D08770",
      nord13: "#EBCB8B",
      nord14: "#A3BE8C",
      nord15: "#B48EAD"
    },
    theme: {
      primary: {
        dark: "nord8",
        light: "nord10"
      },
      secondary: {
        dark: "nord9",
        light: "nord9"
      },
      accent: {
        dark: "nord7",
        light: "nord7"
      },
      error: {
        dark: "nord11",
        light: "nord11"
      },
      warning: {
        dark: "nord12",
        light: "nord12"
      },
      success: {
        dark: "nord14",
        light: "nord14"
      },
      info: {
        dark: "nord8",
        light: "nord10"
      },
      text: {
        dark: "nord6",
        light: "nord0"
      },
      textMuted: {
        dark: "#8B95A7",
        light: "nord1"
      },
      background: {
        dark: "nord0",
        light: "nord6"
      },
      backgroundPanel: {
        dark: "nord1",
        light: "nord5"
      },
      backgroundElement: {
        dark: "nord2",
        light: "nord4"
      },
      border: {
        dark: "nord2",
        light: "nord3"
      },
      borderActive: {
        dark: "nord3",
        light: "nord2"
      },
      borderSubtle: {
        dark: "nord2",
        light: "nord3"
      },
      diffAdded: {
        dark: "nord14",
        light: "nord14"
      },
      diffRemoved: {
        dark: "nord11",
        light: "nord11"
      },
      diffContext: {
        dark: "#8B95A7",
        light: "nord3"
      },
      diffHunkHeader: {
        dark: "#8B95A7",
        light: "nord3"
      },
      diffHighlightAdded: {
        dark: "nord14",
        light: "nord14"
      },
      diffHighlightRemoved: {
        dark: "nord11",
        light: "nord11"
      },
      diffAddedBg: {
        dark: "#3B4252",
        light: "#E5E9F0"
      },
      diffRemovedBg: {
        dark: "#3B4252",
        light: "#E5E9F0"
      },
      diffContextBg: {
        dark: "nord1",
        light: "nord5"
      },
      diffLineNumber: {
        dark: "nord2",
        light: "nord4"
      },
      diffAddedLineNumberBg: {
        dark: "#3B4252",
        light: "#E5E9F0"
      },
      diffRemovedLineNumberBg: {
        dark: "#3B4252",
        light: "#E5E9F0"
      },
      markdownText: {
        dark: "nord4",
        light: "nord0"
      },
      markdownHeading: {
        dark: "nord8",
        light: "nord10"
      },
      markdownLink: {
        dark: "nord9",
        light: "nord9"
      },
      markdownLinkText: {
        dark: "nord7",
        light: "nord7"
      },
      markdownCode: {
        dark: "nord14",
        light: "nord14"
      },
      markdownBlockQuote: {
        dark: "#8B95A7",
        light: "nord3"
      },
      markdownEmph: {
        dark: "nord12",
        light: "nord12"
      },
      markdownStrong: {
        dark: "nord13",
        light: "nord13"
      },
      markdownHorizontalRule: {
        dark: "#8B95A7",
        light: "nord3"
      },
      markdownListItem: {
        dark: "nord8",
        light: "nord10"
      },
      markdownListEnumeration: {
        dark: "nord7",
        light: "nord7"
      },
      markdownImage: {
        dark: "nord9",
        light: "nord9"
      },
      markdownImageText: {
        dark: "nord7",
        light: "nord7"
      },
      markdownCodeBlock: {
        dark: "nord4",
        light: "nord0"
      },
      syntaxComment: {
        dark: "#8B95A7",
        light: "nord3"
      },
      syntaxKeyword: {
        dark: "nord9",
        light: "nord9"
      },
      syntaxFunction: {
        dark: "nord8",
        light: "nord8"
      },
      syntaxVariable: {
        dark: "nord7",
        light: "nord7"
      },
      syntaxString: {
        dark: "nord14",
        light: "nord14"
      },
      syntaxNumber: {
        dark: "nord15",
        light: "nord15"
      },
      syntaxType: {
        dark: "nord7",
        light: "nord7"
      },
      syntaxOperator: {
        dark: "nord9",
        light: "nord9"
      },
      syntaxPunctuation: {
        dark: "nord4",
        light: "nord0"
      }
    }
  };
});

// src/ui/theme/themes/one-dark.json
var one_dark_default;
var init_one_dark = __esm(() => {
  one_dark_default = {
    $schema: "https://opencode.ai/theme.json",
    defs: {
      darkBg: "#282c34",
      darkBgAlt: "#21252b",
      darkBgPanel: "#353b45",
      darkFg: "#abb2bf",
      darkFgMuted: "#5c6370",
      darkPurple: "#c678dd",
      darkBlue: "#61afef",
      darkRed: "#e06c75",
      darkGreen: "#98c379",
      darkYellow: "#e5c07b",
      darkOrange: "#d19a66",
      darkCyan: "#56b6c2",
      lightBg: "#fafafa",
      lightBgAlt: "#f0f0f1",
      lightBgPanel: "#eaeaeb",
      lightFg: "#383a42",
      lightFgMuted: "#a0a1a7",
      lightPurple: "#a626a4",
      lightBlue: "#4078f2",
      lightRed: "#e45649",
      lightGreen: "#50a14f",
      lightYellow: "#c18401",
      lightOrange: "#986801",
      lightCyan: "#0184bc"
    },
    theme: {
      primary: { dark: "darkBlue", light: "lightBlue" },
      secondary: { dark: "darkPurple", light: "lightPurple" },
      accent: { dark: "darkCyan", light: "lightCyan" },
      error: { dark: "darkRed", light: "lightRed" },
      warning: { dark: "darkYellow", light: "lightYellow" },
      success: { dark: "darkGreen", light: "lightGreen" },
      info: { dark: "darkOrange", light: "lightOrange" },
      text: { dark: "darkFg", light: "lightFg" },
      textMuted: { dark: "darkFgMuted", light: "lightFgMuted" },
      background: { dark: "darkBg", light: "lightBg" },
      backgroundPanel: { dark: "darkBgAlt", light: "lightBgAlt" },
      backgroundElement: { dark: "darkBgPanel", light: "lightBgPanel" },
      border: { dark: "#393f4a", light: "#d1d1d2" },
      borderActive: { dark: "darkBlue", light: "lightBlue" },
      borderSubtle: { dark: "#2c313a", light: "#e0e0e1" },
      diffAdded: { dark: "darkGreen", light: "lightGreen" },
      diffRemoved: { dark: "darkRed", light: "lightRed" },
      diffContext: { dark: "darkFgMuted", light: "lightFgMuted" },
      diffHunkHeader: { dark: "darkCyan", light: "lightCyan" },
      diffHighlightAdded: { dark: "#aad482", light: "#489447" },
      diffHighlightRemoved: { dark: "#e8828b", light: "#d65145" },
      diffAddedBg: { dark: "#2c382b", light: "#eafbe9" },
      diffRemovedBg: { dark: "#3a2d2f", light: "#fce9e8" },
      diffContextBg: { dark: "darkBgAlt", light: "lightBgAlt" },
      diffLineNumber: { dark: "#495162", light: "#c9c9ca" },
      diffAddedLineNumberBg: { dark: "#283427", light: "#e1f3df" },
      diffRemovedLineNumberBg: { dark: "#36292b", light: "#f5e2e1" },
      markdownText: { dark: "darkFg", light: "lightFg" },
      markdownHeading: { dark: "darkPurple", light: "lightPurple" },
      markdownLink: { dark: "darkBlue", light: "lightBlue" },
      markdownLinkText: { dark: "darkCyan", light: "lightCyan" },
      markdownCode: { dark: "darkGreen", light: "lightGreen" },
      markdownBlockQuote: { dark: "darkFgMuted", light: "lightFgMuted" },
      markdownEmph: { dark: "darkYellow", light: "lightYellow" },
      markdownStrong: { dark: "darkOrange", light: "lightOrange" },
      markdownHorizontalRule: {
        dark: "darkFgMuted",
        light: "lightFgMuted"
      },
      markdownListItem: { dark: "darkBlue", light: "lightBlue" },
      markdownListEnumeration: { dark: "darkCyan", light: "lightCyan" },
      markdownImage: { dark: "darkBlue", light: "lightBlue" },
      markdownImageText: { dark: "darkCyan", light: "lightCyan" },
      markdownCodeBlock: { dark: "darkFg", light: "lightFg" },
      syntaxComment: { dark: "darkFgMuted", light: "lightFgMuted" },
      syntaxKeyword: { dark: "darkPurple", light: "lightPurple" },
      syntaxFunction: { dark: "darkBlue", light: "lightBlue" },
      syntaxVariable: { dark: "darkRed", light: "lightRed" },
      syntaxString: { dark: "darkGreen", light: "lightGreen" },
      syntaxNumber: { dark: "darkOrange", light: "lightOrange" },
      syntaxType: { dark: "darkYellow", light: "lightYellow" },
      syntaxOperator: { dark: "darkCyan", light: "lightCyan" },
      syntaxPunctuation: { dark: "darkFg", light: "lightFg" }
    }
  };
});

// src/ui/theme/themes/opencode.json
var opencode_default;
var init_opencode = __esm(() => {
  opencode_default = {
    $schema: "https://opencode.ai/theme.json",
    defs: {
      darkStep1: "#0a0a0a",
      darkStep2: "#141414",
      darkStep3: "#1e1e1e",
      darkStep4: "#282828",
      darkStep5: "#323232",
      darkStep6: "#3c3c3c",
      darkStep7: "#484848",
      darkStep8: "#606060",
      darkStep9: "#fab283",
      darkStep10: "#ffc09f",
      darkStep11: "#808080",
      darkStep12: "#eeeeee",
      darkSecondary: "#5c9cf5",
      darkAccent: "#9d7cd8",
      darkRed: "#e06c75",
      darkOrange: "#f5a742",
      darkGreen: "#7fd88f",
      darkCyan: "#56b6c2",
      darkYellow: "#e5c07b",
      lightStep1: "#ffffff",
      lightStep2: "#fafafa",
      lightStep3: "#f5f5f5",
      lightStep4: "#ebebeb",
      lightStep5: "#e1e1e1",
      lightStep6: "#d4d4d4",
      lightStep7: "#b8b8b8",
      lightStep8: "#a0a0a0",
      lightStep9: "#3b7dd8",
      lightStep10: "#2968c3",
      lightStep11: "#8a8a8a",
      lightStep12: "#1a1a1a",
      lightSecondary: "#7b5bb6",
      lightAccent: "#d68c27",
      lightRed: "#d1383d",
      lightOrange: "#d68c27",
      lightGreen: "#3d9a57",
      lightCyan: "#318795",
      lightYellow: "#b0851f"
    },
    theme: {
      primary: {
        dark: "darkStep9",
        light: "lightStep9"
      },
      secondary: {
        dark: "darkSecondary",
        light: "lightSecondary"
      },
      accent: {
        dark: "darkAccent",
        light: "lightAccent"
      },
      error: {
        dark: "darkRed",
        light: "lightRed"
      },
      warning: {
        dark: "darkOrange",
        light: "lightOrange"
      },
      success: {
        dark: "darkGreen",
        light: "lightGreen"
      },
      info: {
        dark: "darkCyan",
        light: "lightCyan"
      },
      text: {
        dark: "darkStep12",
        light: "lightStep12"
      },
      textMuted: {
        dark: "darkStep11",
        light: "lightStep11"
      },
      background: {
        dark: "darkStep1",
        light: "lightStep1"
      },
      backgroundPanel: {
        dark: "darkStep2",
        light: "lightStep2"
      },
      backgroundElement: {
        dark: "darkStep3",
        light: "lightStep3"
      },
      border: {
        dark: "darkStep7",
        light: "lightStep7"
      },
      borderActive: {
        dark: "darkStep8",
        light: "lightStep8"
      },
      borderSubtle: {
        dark: "darkStep6",
        light: "lightStep6"
      },
      diffAdded: {
        dark: "#4fd6be",
        light: "#1e725c"
      },
      diffRemoved: {
        dark: "#c53b53",
        light: "#c53b53"
      },
      diffContext: {
        dark: "#828bb8",
        light: "#7086b5"
      },
      diffHunkHeader: {
        dark: "#828bb8",
        light: "#7086b5"
      },
      diffHighlightAdded: {
        dark: "#b8db87",
        light: "#4db380"
      },
      diffHighlightRemoved: {
        dark: "#e26a75",
        light: "#f52a65"
      },
      diffAddedBg: {
        dark: "#20303b",
        light: "#d5e5d5"
      },
      diffRemovedBg: {
        dark: "#37222c",
        light: "#f7d8db"
      },
      diffContextBg: {
        dark: "darkStep2",
        light: "lightStep2"
      },
      diffLineNumber: {
        dark: "darkStep3",
        light: "lightStep3"
      },
      diffAddedLineNumberBg: {
        dark: "#1b2b34",
        light: "#c5d5c5"
      },
      diffRemovedLineNumberBg: {
        dark: "#2d1f26",
        light: "#e7c8cb"
      },
      markdownText: {
        dark: "darkStep12",
        light: "lightStep12"
      },
      markdownHeading: {
        dark: "darkAccent",
        light: "lightAccent"
      },
      markdownLink: {
        dark: "darkStep9",
        light: "lightStep9"
      },
      markdownLinkText: {
        dark: "darkCyan",
        light: "lightCyan"
      },
      markdownCode: {
        dark: "darkGreen",
        light: "lightGreen"
      },
      markdownBlockQuote: {
        dark: "darkYellow",
        light: "lightYellow"
      },
      markdownEmph: {
        dark: "darkYellow",
        light: "lightYellow"
      },
      markdownStrong: {
        dark: "darkOrange",
        light: "lightOrange"
      },
      markdownHorizontalRule: {
        dark: "darkStep11",
        light: "lightStep11"
      },
      markdownListItem: {
        dark: "darkStep9",
        light: "lightStep9"
      },
      markdownListEnumeration: {
        dark: "darkCyan",
        light: "lightCyan"
      },
      markdownImage: {
        dark: "darkStep9",
        light: "lightStep9"
      },
      markdownImageText: {
        dark: "darkCyan",
        light: "lightCyan"
      },
      markdownCodeBlock: {
        dark: "darkStep12",
        light: "lightStep12"
      },
      syntaxComment: {
        dark: "darkStep11",
        light: "lightStep11"
      },
      syntaxKeyword: {
        dark: "darkAccent",
        light: "lightAccent"
      },
      syntaxFunction: {
        dark: "darkStep9",
        light: "lightStep9"
      },
      syntaxVariable: {
        dark: "darkRed",
        light: "lightRed"
      },
      syntaxString: {
        dark: "darkGreen",
        light: "lightGreen"
      },
      syntaxNumber: {
        dark: "darkOrange",
        light: "lightOrange"
      },
      syntaxType: {
        dark: "darkYellow",
        light: "lightYellow"
      },
      syntaxOperator: {
        dark: "darkCyan",
        light: "lightCyan"
      },
      syntaxPunctuation: {
        dark: "darkStep12",
        light: "lightStep12"
      }
    }
  };
});

// src/ui/theme/themes/orng.json
var orng_default;
var init_orng = __esm(() => {
  orng_default = {
    $schema: "https://opencode.ai/theme.json",
    defs: {
      darkStep1: "#0a0a0a",
      darkStep2: "#141414",
      darkStep3: "#1e1e1e",
      darkStep4: "#282828",
      darkStep5: "#323232",
      darkStep6: "#3c3c3c",
      darkStep7: "#484848",
      darkStep8: "#606060",
      darkStep9: "#EC5B2B",
      darkStep10: "#EE7948",
      darkStep11: "#808080",
      darkStep12: "#eeeeee",
      darkSecondary: "#EE7948",
      darkAccent: "#FFF7F1",
      darkRed: "#e06c75",
      darkOrange: "#EC5B2B",
      darkBlue: "#6ba1e6",
      darkCyan: "#56b6c2",
      darkYellow: "#e5c07b",
      lightStep1: "#ffffff",
      lightStep2: "#FFF7F1",
      lightStep3: "#f5f0eb",
      lightStep4: "#ebebeb",
      lightStep5: "#e1e1e1",
      lightStep6: "#d4d4d4",
      lightStep7: "#b8b8b8",
      lightStep8: "#a0a0a0",
      lightStep9: "#EC5B2B",
      lightStep10: "#c94d24",
      lightStep11: "#8a8a8a",
      lightStep12: "#1a1a1a",
      lightSecondary: "#EE7948",
      lightAccent: "#c94d24",
      lightRed: "#d1383d",
      lightOrange: "#EC5B2B",
      lightBlue: "#0062d1",
      lightCyan: "#318795",
      lightYellow: "#b0851f"
    },
    theme: {
      primary: {
        dark: "darkStep9",
        light: "lightStep9"
      },
      secondary: {
        dark: "darkSecondary",
        light: "lightSecondary"
      },
      accent: {
        dark: "darkAccent",
        light: "lightAccent"
      },
      error: {
        dark: "darkRed",
        light: "lightRed"
      },
      warning: {
        dark: "darkOrange",
        light: "lightOrange"
      },
      success: {
        dark: "darkBlue",
        light: "lightBlue"
      },
      info: {
        dark: "darkCyan",
        light: "lightCyan"
      },
      text: {
        dark: "darkStep12",
        light: "lightStep12"
      },
      textMuted: {
        dark: "darkStep11",
        light: "lightStep11"
      },
      selectedListItemText: {
        dark: "#0a0a0a",
        light: "#ffffff"
      },
      background: {
        dark: "darkStep1",
        light: "lightStep1"
      },
      backgroundPanel: {
        dark: "darkStep2",
        light: "lightStep2"
      },
      backgroundElement: {
        dark: "darkStep3",
        light: "lightStep3"
      },
      border: {
        dark: "#EC5B2B",
        light: "#EC5B2B"
      },
      borderActive: {
        dark: "#EE7948",
        light: "#c94d24"
      },
      borderSubtle: {
        dark: "darkStep6",
        light: "lightStep6"
      },
      diffAdded: {
        dark: "#6ba1e6",
        light: "#0062d1"
      },
      diffRemoved: {
        dark: "#c53b53",
        light: "#c53b53"
      },
      diffContext: {
        dark: "#828bb8",
        light: "#7086b5"
      },
      diffHunkHeader: {
        dark: "#828bb8",
        light: "#7086b5"
      },
      diffHighlightAdded: {
        dark: "#6ba1e6",
        light: "#0062d1"
      },
      diffHighlightRemoved: {
        dark: "#e26a75",
        light: "#f52a65"
      },
      diffAddedBg: {
        dark: "#1a2a3d",
        light: "#e0edfa"
      },
      diffRemovedBg: {
        dark: "#37222c",
        light: "#f7d8db"
      },
      diffContextBg: {
        dark: "darkStep2",
        light: "lightStep2"
      },
      diffLineNumber: {
        dark: "darkStep3",
        light: "lightStep3"
      },
      diffAddedLineNumberBg: {
        dark: "#162535",
        light: "#d0e5f5"
      },
      diffRemovedLineNumberBg: {
        dark: "#2d1f26",
        light: "#e7c8cb"
      },
      markdownText: {
        dark: "darkStep12",
        light: "lightStep12"
      },
      markdownHeading: {
        dark: "#EC5B2B",
        light: "#EC5B2B"
      },
      markdownLink: {
        dark: "darkStep9",
        light: "lightStep9"
      },
      markdownLinkText: {
        dark: "darkCyan",
        light: "lightCyan"
      },
      markdownCode: {
        dark: "darkBlue",
        light: "lightBlue"
      },
      markdownBlockQuote: {
        dark: "#FFF7F1",
        light: "lightYellow"
      },
      markdownEmph: {
        dark: "darkYellow",
        light: "lightYellow"
      },
      markdownStrong: {
        dark: "#EE7948",
        light: "#EC5B2B"
      },
      markdownHorizontalRule: {
        dark: "darkStep11",
        light: "lightStep11"
      },
      markdownListItem: {
        dark: "darkStep9",
        light: "lightStep9"
      },
      markdownListEnumeration: {
        dark: "darkCyan",
        light: "lightCyan"
      },
      markdownImage: {
        dark: "darkStep9",
        light: "lightStep9"
      },
      markdownImageText: {
        dark: "darkCyan",
        light: "lightCyan"
      },
      markdownCodeBlock: {
        dark: "darkStep12",
        light: "lightStep12"
      },
      syntaxComment: {
        dark: "darkStep11",
        light: "lightStep11"
      },
      syntaxKeyword: {
        dark: "#EC5B2B",
        light: "#EC5B2B"
      },
      syntaxFunction: {
        dark: "#EE7948",
        light: "#c94d24"
      },
      syntaxVariable: {
        dark: "darkRed",
        light: "lightRed"
      },
      syntaxString: {
        dark: "darkBlue",
        light: "lightBlue"
      },
      syntaxNumber: {
        dark: "#FFF7F1",
        light: "#EC5B2B"
      },
      syntaxType: {
        dark: "darkYellow",
        light: "lightYellow"
      },
      syntaxOperator: {
        dark: "darkCyan",
        light: "lightCyan"
      },
      syntaxPunctuation: {
        dark: "darkStep12",
        light: "lightStep12"
      }
    }
  };
});

// src/ui/theme/themes/osaka-jade.json
var osaka_jade_default;
var init_osaka_jade = __esm(() => {
  osaka_jade_default = {
    $schema: "https://opencode.ai/theme.json",
    defs: {
      darkBg0: "#111c18",
      darkBg1: "#1a2520",
      darkBg2: "#23372B",
      darkBg3: "#3d4a44",
      darkFg0: "#C1C497",
      darkFg1: "#9aa88a",
      darkGray: "#53685B",
      darkRed: "#FF5345",
      darkGreen: "#549e6a",
      darkYellow: "#459451",
      darkBlue: "#509475",
      darkMagenta: "#D2689C",
      darkCyan: "#2DD5B7",
      darkWhite: "#F6F5DD",
      darkRedBright: "#db9f9c",
      darkGreenBright: "#63b07a",
      darkYellowBright: "#E5C736",
      darkBlueBright: "#ACD4CF",
      darkMagentaBright: "#75bbb3",
      darkCyanBright: "#8CD3CB",
      lightBg0: "#F6F5DD",
      lightBg1: "#E8E7CC",
      lightBg2: "#D5D4B8",
      lightBg3: "#A8A78C",
      lightFg0: "#111c18",
      lightFg1: "#1a2520",
      lightGray: "#53685B",
      lightRed: "#c7392d",
      lightGreen: "#3d7a52",
      lightYellow: "#b5a020",
      lightBlue: "#3d7560",
      lightMagenta: "#a8527a",
      lightCyan: "#1faa90"
    },
    theme: {
      primary: { dark: "darkCyan", light: "lightCyan" },
      secondary: { dark: "darkMagenta", light: "lightMagenta" },
      accent: { dark: "darkGreen", light: "lightGreen" },
      error: { dark: "darkRed", light: "lightRed" },
      warning: { dark: "darkYellowBright", light: "lightYellow" },
      success: { dark: "darkGreen", light: "lightGreen" },
      info: { dark: "darkCyan", light: "lightCyan" },
      text: { dark: "darkFg0", light: "lightFg0" },
      textMuted: { dark: "darkGray", light: "lightGray" },
      background: { dark: "darkBg0", light: "lightBg0" },
      backgroundPanel: { dark: "darkBg1", light: "lightBg1" },
      backgroundElement: { dark: "darkBg2", light: "lightBg2" },
      border: { dark: "darkBg3", light: "lightBg3" },
      borderActive: { dark: "darkCyan", light: "lightCyan" },
      borderSubtle: { dark: "darkBg2", light: "lightBg2" },
      diffAdded: { dark: "darkGreen", light: "lightGreen" },
      diffRemoved: { dark: "darkRed", light: "lightRed" },
      diffContext: { dark: "darkGray", light: "lightGray" },
      diffHunkHeader: { dark: "darkCyan", light: "lightCyan" },
      diffHighlightAdded: { dark: "darkGreenBright", light: "lightGreen" },
      diffHighlightRemoved: { dark: "darkRedBright", light: "lightRed" },
      diffAddedBg: { dark: "#15241c", light: "#e0eee5" },
      diffRemovedBg: { dark: "#241515", light: "#eee0e0" },
      diffContextBg: { dark: "darkBg1", light: "lightBg1" },
      diffLineNumber: { dark: "darkBg3", light: "lightBg3" },
      diffAddedLineNumberBg: { dark: "#121f18", light: "#d5e5da" },
      diffRemovedLineNumberBg: { dark: "#1f1212", light: "#e5d5d5" },
      markdownText: { dark: "darkFg0", light: "lightFg0" },
      markdownHeading: { dark: "darkCyan", light: "lightCyan" },
      markdownLink: { dark: "darkCyanBright", light: "lightCyan" },
      markdownLinkText: { dark: "darkGreen", light: "lightGreen" },
      markdownCode: { dark: "darkGreenBright", light: "lightGreen" },
      markdownBlockQuote: { dark: "darkGray", light: "lightGray" },
      markdownEmph: { dark: "darkMagenta", light: "lightMagenta" },
      markdownStrong: { dark: "darkFg0", light: "lightFg0" },
      markdownHorizontalRule: { dark: "darkGray", light: "lightGray" },
      markdownListItem: { dark: "darkCyan", light: "lightCyan" },
      markdownListEnumeration: {
        dark: "darkCyanBright",
        light: "lightCyan"
      },
      markdownImage: { dark: "darkCyanBright", light: "lightCyan" },
      markdownImageText: { dark: "darkGreen", light: "lightGreen" },
      markdownCodeBlock: { dark: "darkFg0", light: "lightFg0" },
      syntaxComment: { dark: "darkGray", light: "lightGray" },
      syntaxKeyword: { dark: "darkCyan", light: "lightCyan" },
      syntaxFunction: { dark: "darkBlue", light: "lightBlue" },
      syntaxVariable: { dark: "darkFg0", light: "lightFg0" },
      syntaxString: { dark: "darkGreenBright", light: "lightGreen" },
      syntaxNumber: { dark: "darkMagenta", light: "lightMagenta" },
      syntaxType: { dark: "darkGreen", light: "lightGreen" },
      syntaxOperator: { dark: "darkYellow", light: "lightYellow" },
      syntaxPunctuation: { dark: "darkFg0", light: "lightFg0" }
    }
  };
});

// src/ui/theme/themes/palenight.json
var palenight_default;
var init_palenight = __esm(() => {
  palenight_default = {
    $schema: "https://opencode.ai/theme.json",
    defs: {
      background: "#292d3e",
      backgroundAlt: "#1e2132",
      backgroundPanel: "#32364a",
      foreground: "#a6accd",
      foregroundBright: "#bfc7d5",
      comment: "#676e95",
      red: "#f07178",
      orange: "#f78c6c",
      yellow: "#ffcb6b",
      green: "#c3e88d",
      cyan: "#89ddff",
      blue: "#82aaff",
      purple: "#c792ea",
      magenta: "#ff5370",
      pink: "#f07178"
    },
    theme: {
      primary: {
        dark: "blue",
        light: "#4976eb"
      },
      secondary: {
        dark: "purple",
        light: "#a854f2"
      },
      accent: {
        dark: "cyan",
        light: "#00acc1"
      },
      error: {
        dark: "red",
        light: "#e53935"
      },
      warning: {
        dark: "yellow",
        light: "#ffb300"
      },
      success: {
        dark: "green",
        light: "#91b859"
      },
      info: {
        dark: "orange",
        light: "#f4511e"
      },
      text: {
        dark: "foreground",
        light: "#292d3e"
      },
      textMuted: {
        dark: "comment",
        light: "#8796b0"
      },
      background: {
        dark: "#292d3e",
        light: "#fafafa"
      },
      backgroundPanel: {
        dark: "#1e2132",
        light: "#f5f5f5"
      },
      backgroundElement: {
        dark: "#32364a",
        light: "#e7e7e8"
      },
      border: {
        dark: "#32364a",
        light: "#e0e0e0"
      },
      borderActive: {
        dark: "blue",
        light: "#4976eb"
      },
      borderSubtle: {
        dark: "#1e2132",
        light: "#eeeeee"
      },
      diffAdded: {
        dark: "green",
        light: "#91b859"
      },
      diffRemoved: {
        dark: "red",
        light: "#e53935"
      },
      diffContext: {
        dark: "comment",
        light: "#8796b0"
      },
      diffHunkHeader: {
        dark: "cyan",
        light: "#00acc1"
      },
      diffHighlightAdded: {
        dark: "green",
        light: "#91b859"
      },
      diffHighlightRemoved: {
        dark: "red",
        light: "#e53935"
      },
      diffAddedBg: {
        dark: "#2e3c2b",
        light: "#e8f5e9"
      },
      diffRemovedBg: {
        dark: "#3c2b2b",
        light: "#ffebee"
      },
      diffContextBg: {
        dark: "#1e2132",
        light: "#f5f5f5"
      },
      diffLineNumber: {
        dark: "#444760",
        light: "#cfd8dc"
      },
      diffAddedLineNumberBg: {
        dark: "#2e3c2b",
        light: "#e8f5e9"
      },
      diffRemovedLineNumberBg: {
        dark: "#3c2b2b",
        light: "#ffebee"
      },
      markdownText: {
        dark: "foreground",
        light: "#292d3e"
      },
      markdownHeading: {
        dark: "purple",
        light: "#a854f2"
      },
      markdownLink: {
        dark: "blue",
        light: "#4976eb"
      },
      markdownLinkText: {
        dark: "cyan",
        light: "#00acc1"
      },
      markdownCode: {
        dark: "green",
        light: "#91b859"
      },
      markdownBlockQuote: {
        dark: "comment",
        light: "#8796b0"
      },
      markdownEmph: {
        dark: "yellow",
        light: "#ffb300"
      },
      markdownStrong: {
        dark: "orange",
        light: "#f4511e"
      },
      markdownHorizontalRule: {
        dark: "comment",
        light: "#8796b0"
      },
      markdownListItem: {
        dark: "blue",
        light: "#4976eb"
      },
      markdownListEnumeration: {
        dark: "cyan",
        light: "#00acc1"
      },
      markdownImage: {
        dark: "blue",
        light: "#4976eb"
      },
      markdownImageText: {
        dark: "cyan",
        light: "#00acc1"
      },
      markdownCodeBlock: {
        dark: "foreground",
        light: "#292d3e"
      },
      syntaxComment: {
        dark: "comment",
        light: "#8796b0"
      },
      syntaxKeyword: {
        dark: "purple",
        light: "#a854f2"
      },
      syntaxFunction: {
        dark: "blue",
        light: "#4976eb"
      },
      syntaxVariable: {
        dark: "foreground",
        light: "#292d3e"
      },
      syntaxString: {
        dark: "green",
        light: "#91b859"
      },
      syntaxNumber: {
        dark: "orange",
        light: "#f4511e"
      },
      syntaxType: {
        dark: "yellow",
        light: "#ffb300"
      },
      syntaxOperator: {
        dark: "cyan",
        light: "#00acc1"
      },
      syntaxPunctuation: {
        dark: "foreground",
        light: "#292d3e"
      }
    }
  };
});

// src/ui/theme/themes/rosepine.json
var rosepine_default;
var init_rosepine = __esm(() => {
  rosepine_default = {
    $schema: "https://opencode.ai/theme.json",
    defs: {
      base: "#191724",
      surface: "#1f1d2e",
      overlay: "#26233a",
      muted: "#6e6a86",
      subtle: "#908caa",
      text: "#e0def4",
      love: "#eb6f92",
      gold: "#f6c177",
      rose: "#ebbcba",
      pine: "#31748f",
      foam: "#9ccfd8",
      iris: "#c4a7e7",
      highlightLow: "#21202e",
      highlightMed: "#403d52",
      highlightHigh: "#524f67",
      moonBase: "#232136",
      moonSurface: "#2a273f",
      moonOverlay: "#393552",
      moonMuted: "#6e6a86",
      moonSubtle: "#908caa",
      moonText: "#e0def4",
      dawnBase: "#faf4ed",
      dawnSurface: "#fffaf3",
      dawnOverlay: "#f2e9e1",
      dawnMuted: "#9893a5",
      dawnSubtle: "#797593",
      dawnText: "#575279"
    },
    theme: {
      primary: {
        dark: "foam",
        light: "pine"
      },
      secondary: {
        dark: "iris",
        light: "#907aa9"
      },
      accent: {
        dark: "rose",
        light: "#d7827e"
      },
      error: {
        dark: "love",
        light: "#b4637a"
      },
      warning: {
        dark: "gold",
        light: "#ea9d34"
      },
      success: {
        dark: "pine",
        light: "#286983"
      },
      info: {
        dark: "foam",
        light: "#56949f"
      },
      text: {
        dark: "#e0def4",
        light: "#575279"
      },
      textMuted: {
        dark: "muted",
        light: "dawnMuted"
      },
      background: {
        dark: "base",
        light: "dawnBase"
      },
      backgroundPanel: {
        dark: "surface",
        light: "dawnSurface"
      },
      backgroundElement: {
        dark: "overlay",
        light: "dawnOverlay"
      },
      border: {
        dark: "highlightMed",
        light: "#dfdad9"
      },
      borderActive: {
        dark: "foam",
        light: "pine"
      },
      borderSubtle: {
        dark: "highlightLow",
        light: "#f4ede8"
      },
      diffAdded: {
        dark: "pine",
        light: "#286983"
      },
      diffRemoved: {
        dark: "love",
        light: "#b4637a"
      },
      diffContext: {
        dark: "muted",
        light: "dawnMuted"
      },
      diffHunkHeader: {
        dark: "iris",
        light: "#907aa9"
      },
      diffHighlightAdded: {
        dark: "pine",
        light: "#286983"
      },
      diffHighlightRemoved: {
        dark: "love",
        light: "#b4637a"
      },
      diffAddedBg: {
        dark: "#1f2d3a",
        light: "#e5f2f3"
      },
      diffRemovedBg: {
        dark: "#3a1f2d",
        light: "#fce5e8"
      },
      diffContextBg: {
        dark: "surface",
        light: "dawnSurface"
      },
      diffLineNumber: {
        dark: "muted",
        light: "dawnMuted"
      },
      diffAddedLineNumberBg: {
        dark: "#1f2d3a",
        light: "#e5f2f3"
      },
      diffRemovedLineNumberBg: {
        dark: "#3a1f2d",
        light: "#fce5e8"
      },
      markdownText: {
        dark: "#e0def4",
        light: "#575279"
      },
      markdownHeading: {
        dark: "iris",
        light: "#907aa9"
      },
      markdownLink: {
        dark: "foam",
        light: "pine"
      },
      markdownLinkText: {
        dark: "rose",
        light: "#d7827e"
      },
      markdownCode: {
        dark: "pine",
        light: "#286983"
      },
      markdownBlockQuote: {
        dark: "muted",
        light: "dawnMuted"
      },
      markdownEmph: {
        dark: "gold",
        light: "#ea9d34"
      },
      markdownStrong: {
        dark: "love",
        light: "#b4637a"
      },
      markdownHorizontalRule: {
        dark: "highlightMed",
        light: "#dfdad9"
      },
      markdownListItem: {
        dark: "foam",
        light: "pine"
      },
      markdownListEnumeration: {
        dark: "rose",
        light: "#d7827e"
      },
      markdownImage: {
        dark: "foam",
        light: "pine"
      },
      markdownImageText: {
        dark: "rose",
        light: "#d7827e"
      },
      markdownCodeBlock: {
        dark: "#e0def4",
        light: "#575279"
      },
      syntaxComment: {
        dark: "muted",
        light: "dawnMuted"
      },
      syntaxKeyword: {
        dark: "pine",
        light: "#286983"
      },
      syntaxFunction: {
        dark: "rose",
        light: "#d7827e"
      },
      syntaxVariable: {
        dark: "#e0def4",
        light: "#575279"
      },
      syntaxString: {
        dark: "gold",
        light: "#ea9d34"
      },
      syntaxNumber: {
        dark: "iris",
        light: "#907aa9"
      },
      syntaxType: {
        dark: "foam",
        light: "#56949f"
      },
      syntaxOperator: {
        dark: "subtle",
        light: "dawnSubtle"
      },
      syntaxPunctuation: {
        dark: "subtle",
        light: "dawnSubtle"
      }
    }
  };
});

// src/ui/theme/themes/solarized.json
var solarized_default;
var init_solarized = __esm(() => {
  solarized_default = {
    $schema: "https://opencode.ai/theme.json",
    defs: {
      base03: "#002b36",
      base02: "#073642",
      base01: "#586e75",
      base00: "#657b83",
      base0: "#839496",
      base1: "#93a1a1",
      base2: "#eee8d5",
      base3: "#fdf6e3",
      yellow: "#b58900",
      orange: "#cb4b16",
      red: "#dc322f",
      magenta: "#d33682",
      violet: "#6c71c4",
      blue: "#268bd2",
      cyan: "#2aa198",
      green: "#859900"
    },
    theme: {
      primary: {
        dark: "blue",
        light: "blue"
      },
      secondary: {
        dark: "violet",
        light: "violet"
      },
      accent: {
        dark: "cyan",
        light: "cyan"
      },
      error: {
        dark: "red",
        light: "red"
      },
      warning: {
        dark: "yellow",
        light: "yellow"
      },
      success: {
        dark: "green",
        light: "green"
      },
      info: {
        dark: "orange",
        light: "orange"
      },
      text: {
        dark: "base0",
        light: "base00"
      },
      textMuted: {
        dark: "base01",
        light: "base1"
      },
      background: {
        dark: "base03",
        light: "base3"
      },
      backgroundPanel: {
        dark: "base02",
        light: "base2"
      },
      backgroundElement: {
        dark: "#073642",
        light: "#eee8d5"
      },
      border: {
        dark: "base02",
        light: "base2"
      },
      borderActive: {
        dark: "base01",
        light: "base1"
      },
      borderSubtle: {
        dark: "#073642",
        light: "#eee8d5"
      },
      diffAdded: {
        dark: "green",
        light: "green"
      },
      diffRemoved: {
        dark: "red",
        light: "red"
      },
      diffContext: {
        dark: "base01",
        light: "base1"
      },
      diffHunkHeader: {
        dark: "base01",
        light: "base1"
      },
      diffHighlightAdded: {
        dark: "green",
        light: "green"
      },
      diffHighlightRemoved: {
        dark: "red",
        light: "red"
      },
      diffAddedBg: {
        dark: "#073642",
        light: "#eee8d5"
      },
      diffRemovedBg: {
        dark: "#073642",
        light: "#eee8d5"
      },
      diffContextBg: {
        dark: "base02",
        light: "base2"
      },
      diffLineNumber: {
        dark: "base01",
        light: "base1"
      },
      diffAddedLineNumberBg: {
        dark: "#073642",
        light: "#eee8d5"
      },
      diffRemovedLineNumberBg: {
        dark: "#073642",
        light: "#eee8d5"
      },
      markdownText: {
        dark: "base0",
        light: "base00"
      },
      markdownHeading: {
        dark: "blue",
        light: "blue"
      },
      markdownLink: {
        dark: "cyan",
        light: "cyan"
      },
      markdownLinkText: {
        dark: "violet",
        light: "violet"
      },
      markdownCode: {
        dark: "green",
        light: "green"
      },
      markdownBlockQuote: {
        dark: "base01",
        light: "base1"
      },
      markdownEmph: {
        dark: "yellow",
        light: "yellow"
      },
      markdownStrong: {
        dark: "orange",
        light: "orange"
      },
      markdownHorizontalRule: {
        dark: "base01",
        light: "base1"
      },
      markdownListItem: {
        dark: "blue",
        light: "blue"
      },
      markdownListEnumeration: {
        dark: "cyan",
        light: "cyan"
      },
      markdownImage: {
        dark: "cyan",
        light: "cyan"
      },
      markdownImageText: {
        dark: "violet",
        light: "violet"
      },
      markdownCodeBlock: {
        dark: "base0",
        light: "base00"
      },
      syntaxComment: {
        dark: "base01",
        light: "base1"
      },
      syntaxKeyword: {
        dark: "green",
        light: "green"
      },
      syntaxFunction: {
        dark: "blue",
        light: "blue"
      },
      syntaxVariable: {
        dark: "cyan",
        light: "cyan"
      },
      syntaxString: {
        dark: "cyan",
        light: "cyan"
      },
      syntaxNumber: {
        dark: "magenta",
        light: "magenta"
      },
      syntaxType: {
        dark: "yellow",
        light: "yellow"
      },
      syntaxOperator: {
        dark: "green",
        light: "green"
      },
      syntaxPunctuation: {
        dark: "base0",
        light: "base00"
      }
    }
  };
});

// src/ui/theme/themes/synthwave84.json
var synthwave84_default;
var init_synthwave84 = __esm(() => {
  synthwave84_default = {
    $schema: "https://opencode.ai/theme.json",
    defs: {
      background: "#262335",
      backgroundAlt: "#1e1a29",
      backgroundPanel: "#2a2139",
      foreground: "#ffffff",
      foregroundMuted: "#848bbd",
      pink: "#ff7edb",
      pinkBright: "#ff92df",
      cyan: "#36f9f6",
      cyanBright: "#72f1f8",
      yellow: "#fede5d",
      yellowBright: "#fff95d",
      orange: "#ff8b39",
      orangeBright: "#ff9f43",
      purple: "#b084eb",
      purpleBright: "#c792ea",
      red: "#fe4450",
      redBright: "#ff5e5b",
      green: "#72f1b8",
      greenBright: "#97f1d8"
    },
    theme: {
      primary: {
        dark: "cyan",
        light: "#00bcd4"
      },
      secondary: {
        dark: "pink",
        light: "#e91e63"
      },
      accent: {
        dark: "purple",
        light: "#9c27b0"
      },
      error: {
        dark: "red",
        light: "#f44336"
      },
      warning: {
        dark: "yellow",
        light: "#ff9800"
      },
      success: {
        dark: "green",
        light: "#4caf50"
      },
      info: {
        dark: "orange",
        light: "#ff5722"
      },
      text: {
        dark: "foreground",
        light: "#262335"
      },
      textMuted: {
        dark: "foregroundMuted",
        light: "#5c5c8a"
      },
      background: {
        dark: "#262335",
        light: "#fafafa"
      },
      backgroundPanel: {
        dark: "#1e1a29",
        light: "#f5f5f5"
      },
      backgroundElement: {
        dark: "#2a2139",
        light: "#eeeeee"
      },
      border: {
        dark: "#495495",
        light: "#e0e0e0"
      },
      borderActive: {
        dark: "cyan",
        light: "#00bcd4"
      },
      borderSubtle: {
        dark: "#241b2f",
        light: "#f0f0f0"
      },
      diffAdded: {
        dark: "green",
        light: "#4caf50"
      },
      diffRemoved: {
        dark: "red",
        light: "#f44336"
      },
      diffContext: {
        dark: "foregroundMuted",
        light: "#5c5c8a"
      },
      diffHunkHeader: {
        dark: "purple",
        light: "#9c27b0"
      },
      diffHighlightAdded: {
        dark: "greenBright",
        light: "#4caf50"
      },
      diffHighlightRemoved: {
        dark: "redBright",
        light: "#f44336"
      },
      diffAddedBg: {
        dark: "#1a3a2a",
        light: "#e8f5e9"
      },
      diffRemovedBg: {
        dark: "#3a1a2a",
        light: "#ffebee"
      },
      diffContextBg: {
        dark: "#1e1a29",
        light: "#f5f5f5"
      },
      diffLineNumber: {
        dark: "#495495",
        light: "#b0b0b0"
      },
      diffAddedLineNumberBg: {
        dark: "#1a3a2a",
        light: "#e8f5e9"
      },
      diffRemovedLineNumberBg: {
        dark: "#3a1a2a",
        light: "#ffebee"
      },
      markdownText: {
        dark: "foreground",
        light: "#262335"
      },
      markdownHeading: {
        dark: "pink",
        light: "#e91e63"
      },
      markdownLink: {
        dark: "cyan",
        light: "#00bcd4"
      },
      markdownLinkText: {
        dark: "purple",
        light: "#9c27b0"
      },
      markdownCode: {
        dark: "green",
        light: "#4caf50"
      },
      markdownBlockQuote: {
        dark: "foregroundMuted",
        light: "#5c5c8a"
      },
      markdownEmph: {
        dark: "yellow",
        light: "#ff9800"
      },
      markdownStrong: {
        dark: "orange",
        light: "#ff5722"
      },
      markdownHorizontalRule: {
        dark: "#495495",
        light: "#e0e0e0"
      },
      markdownListItem: {
        dark: "cyan",
        light: "#00bcd4"
      },
      markdownListEnumeration: {
        dark: "purple",
        light: "#9c27b0"
      },
      markdownImage: {
        dark: "cyan",
        light: "#00bcd4"
      },
      markdownImageText: {
        dark: "purple",
        light: "#9c27b0"
      },
      markdownCodeBlock: {
        dark: "foreground",
        light: "#262335"
      },
      syntaxComment: {
        dark: "foregroundMuted",
        light: "#5c5c8a"
      },
      syntaxKeyword: {
        dark: "pink",
        light: "#e91e63"
      },
      syntaxFunction: {
        dark: "orange",
        light: "#ff5722"
      },
      syntaxVariable: {
        dark: "foreground",
        light: "#262335"
      },
      syntaxString: {
        dark: "yellow",
        light: "#ff9800"
      },
      syntaxNumber: {
        dark: "purple",
        light: "#9c27b0"
      },
      syntaxType: {
        dark: "cyan",
        light: "#00bcd4"
      },
      syntaxOperator: {
        dark: "pink",
        light: "#e91e63"
      },
      syntaxPunctuation: {
        dark: "foreground",
        light: "#262335"
      }
    }
  };
});

// src/ui/theme/themes/tokyonight.json
var tokyonight_default;
var init_tokyonight = __esm(() => {
  tokyonight_default = {
    $schema: "https://opencode.ai/theme.json",
    defs: {
      darkStep1: "#1a1b26",
      darkStep2: "#1e2030",
      darkStep3: "#222436",
      darkStep4: "#292e42",
      darkStep5: "#3b4261",
      darkStep6: "#545c7e",
      darkStep7: "#737aa2",
      darkStep8: "#9099b2",
      darkStep9: "#82aaff",
      darkStep10: "#89b4fa",
      darkStep11: "#828bb8",
      darkStep12: "#c8d3f5",
      darkRed: "#ff757f",
      darkOrange: "#ff966c",
      darkYellow: "#ffc777",
      darkGreen: "#c3e88d",
      darkCyan: "#86e1fc",
      darkPurple: "#c099ff",
      lightStep1: "#e1e2e7",
      lightStep2: "#d5d6db",
      lightStep3: "#c8c9ce",
      lightStep4: "#b9bac1",
      lightStep5: "#a8aecb",
      lightStep6: "#9699a8",
      lightStep7: "#737a8c",
      lightStep8: "#5a607d",
      lightStep9: "#2e7de9",
      lightStep10: "#1a6ce7",
      lightStep11: "#8990a3",
      lightStep12: "#3760bf",
      lightRed: "#f52a65",
      lightOrange: "#b15c00",
      lightYellow: "#8c6c3e",
      lightGreen: "#587539",
      lightCyan: "#007197",
      lightPurple: "#9854f1"
    },
    theme: {
      primary: {
        dark: "darkStep9",
        light: "lightStep9"
      },
      secondary: {
        dark: "darkPurple",
        light: "lightPurple"
      },
      accent: {
        dark: "darkOrange",
        light: "lightOrange"
      },
      error: {
        dark: "darkRed",
        light: "lightRed"
      },
      warning: {
        dark: "darkOrange",
        light: "lightOrange"
      },
      success: {
        dark: "darkGreen",
        light: "lightGreen"
      },
      info: {
        dark: "darkStep9",
        light: "lightStep9"
      },
      text: {
        dark: "darkStep12",
        light: "lightStep12"
      },
      textMuted: {
        dark: "darkStep11",
        light: "lightStep11"
      },
      background: {
        dark: "darkStep1",
        light: "lightStep1"
      },
      backgroundPanel: {
        dark: "darkStep2",
        light: "lightStep2"
      },
      backgroundElement: {
        dark: "darkStep3",
        light: "lightStep3"
      },
      border: {
        dark: "darkStep7",
        light: "lightStep7"
      },
      borderActive: {
        dark: "darkStep8",
        light: "lightStep8"
      },
      borderSubtle: {
        dark: "darkStep6",
        light: "lightStep6"
      },
      diffAdded: {
        dark: "#4fd6be",
        light: "#1e725c"
      },
      diffRemoved: {
        dark: "#c53b53",
        light: "#c53b53"
      },
      diffContext: {
        dark: "#828bb8",
        light: "#7086b5"
      },
      diffHunkHeader: {
        dark: "#828bb8",
        light: "#7086b5"
      },
      diffHighlightAdded: {
        dark: "#b8db87",
        light: "#4db380"
      },
      diffHighlightRemoved: {
        dark: "#e26a75",
        light: "#f52a65"
      },
      diffAddedBg: {
        dark: "#20303b",
        light: "#d5e5d5"
      },
      diffRemovedBg: {
        dark: "#37222c",
        light: "#f7d8db"
      },
      diffContextBg: {
        dark: "darkStep2",
        light: "lightStep2"
      },
      diffLineNumber: {
        dark: "darkStep3",
        light: "lightStep3"
      },
      diffAddedLineNumberBg: {
        dark: "#1b2b34",
        light: "#c5d5c5"
      },
      diffRemovedLineNumberBg: {
        dark: "#2d1f26",
        light: "#e7c8cb"
      },
      markdownText: {
        dark: "darkStep12",
        light: "lightStep12"
      },
      markdownHeading: {
        dark: "darkPurple",
        light: "lightPurple"
      },
      markdownLink: {
        dark: "darkStep9",
        light: "lightStep9"
      },
      markdownLinkText: {
        dark: "darkCyan",
        light: "lightCyan"
      },
      markdownCode: {
        dark: "darkGreen",
        light: "lightGreen"
      },
      markdownBlockQuote: {
        dark: "darkYellow",
        light: "lightYellow"
      },
      markdownEmph: {
        dark: "darkYellow",
        light: "lightYellow"
      },
      markdownStrong: {
        dark: "darkOrange",
        light: "lightOrange"
      },
      markdownHorizontalRule: {
        dark: "darkStep11",
        light: "lightStep11"
      },
      markdownListItem: {
        dark: "darkStep9",
        light: "lightStep9"
      },
      markdownListEnumeration: {
        dark: "darkCyan",
        light: "lightCyan"
      },
      markdownImage: {
        dark: "darkStep9",
        light: "lightStep9"
      },
      markdownImageText: {
        dark: "darkCyan",
        light: "lightCyan"
      },
      markdownCodeBlock: {
        dark: "darkStep12",
        light: "lightStep12"
      },
      syntaxComment: {
        dark: "darkStep11",
        light: "lightStep11"
      },
      syntaxKeyword: {
        dark: "darkPurple",
        light: "lightPurple"
      },
      syntaxFunction: {
        dark: "darkStep9",
        light: "lightStep9"
      },
      syntaxVariable: {
        dark: "darkRed",
        light: "lightRed"
      },
      syntaxString: {
        dark: "darkGreen",
        light: "lightGreen"
      },
      syntaxNumber: {
        dark: "darkOrange",
        light: "lightOrange"
      },
      syntaxType: {
        dark: "darkYellow",
        light: "lightYellow"
      },
      syntaxOperator: {
        dark: "darkCyan",
        light: "lightCyan"
      },
      syntaxPunctuation: {
        dark: "darkStep12",
        light: "lightStep12"
      }
    }
  };
});

// src/ui/theme/themes/vercel.json
var vercel_default;
var init_vercel = __esm(() => {
  vercel_default = {
    $schema: "https://opencode.ai/theme.json",
    defs: {
      background100: "#0A0A0A",
      background200: "#000000",
      gray100: "#1A1A1A",
      gray200: "#1F1F1F",
      gray300: "#292929",
      gray400: "#2E2E2E",
      gray500: "#454545",
      gray600: "#878787",
      gray700: "#8F8F8F",
      gray900: "#A1A1A1",
      gray1000: "#EDEDED",
      blue600: "#0099FF",
      blue700: "#0070F3",
      blue900: "#52A8FF",
      blue1000: "#EBF8FF",
      red700: "#E5484D",
      red900: "#FF6166",
      red1000: "#FDECED",
      amber700: "#FFB224",
      amber900: "#F2A700",
      amber1000: "#FDF4DC",
      green700: "#46A758",
      green900: "#63C46D",
      green1000: "#E6F9E9",
      teal700: "#12A594",
      teal900: "#0AC7AC",
      purple700: "#8E4EC6",
      purple900: "#BF7AF0",
      pink700: "#E93D82",
      pink900: "#F75590",
      highlightPink: "#FF0080",
      highlightPurple: "#F81CE5",
      cyan: "#50E3C2",
      lightBackground: "#FFFFFF",
      lightGray100: "#FAFAFA",
      lightGray200: "#EAEAEA",
      lightGray600: "#666666",
      lightGray1000: "#171717"
    },
    theme: {
      primary: {
        dark: "blue700",
        light: "blue700"
      },
      secondary: {
        dark: "blue900",
        light: "#0062D1"
      },
      accent: {
        dark: "purple700",
        light: "purple700"
      },
      error: {
        dark: "red700",
        light: "#DC3545"
      },
      warning: {
        dark: "amber700",
        light: "#FF9500"
      },
      success: {
        dark: "green700",
        light: "#388E3C"
      },
      info: {
        dark: "blue900",
        light: "blue700"
      },
      text: {
        dark: "gray1000",
        light: "lightGray1000"
      },
      textMuted: {
        dark: "gray600",
        light: "lightGray600"
      },
      background: {
        dark: "background200",
        light: "lightBackground"
      },
      backgroundPanel: {
        dark: "gray100",
        light: "lightGray100"
      },
      backgroundElement: {
        dark: "gray300",
        light: "lightGray200"
      },
      border: {
        dark: "gray200",
        light: "lightGray200"
      },
      borderActive: {
        dark: "gray500",
        light: "#999999"
      },
      borderSubtle: {
        dark: "gray100",
        light: "#EAEAEA"
      },
      diffAdded: {
        dark: "green900",
        light: "green700"
      },
      diffRemoved: {
        dark: "red900",
        light: "red700"
      },
      diffContext: {
        dark: "gray600",
        light: "lightGray600"
      },
      diffHunkHeader: {
        dark: "gray600",
        light: "lightGray600"
      },
      diffHighlightAdded: {
        dark: "green900",
        light: "green700"
      },
      diffHighlightRemoved: {
        dark: "red900",
        light: "red700"
      },
      diffAddedBg: {
        dark: "#0B1D0F",
        light: "#E6F9E9"
      },
      diffRemovedBg: {
        dark: "#2A1314",
        light: "#FDECED"
      },
      diffContextBg: {
        dark: "background200",
        light: "lightBackground"
      },
      diffLineNumber: {
        dark: "gray600",
        light: "lightGray600"
      },
      diffAddedLineNumberBg: {
        dark: "#0F2613",
        light: "#D6F5D6"
      },
      diffRemovedLineNumberBg: {
        dark: "#3C1618",
        light: "#FFE5E5"
      },
      markdownText: {
        dark: "gray1000",
        light: "lightGray1000"
      },
      markdownHeading: {
        dark: "purple900",
        light: "purple700"
      },
      markdownLink: {
        dark: "blue900",
        light: "blue700"
      },
      markdownLinkText: {
        dark: "teal900",
        light: "teal700"
      },
      markdownCode: {
        dark: "green900",
        light: "green700"
      },
      markdownBlockQuote: {
        dark: "gray600",
        light: "lightGray600"
      },
      markdownEmph: {
        dark: "amber900",
        light: "amber700"
      },
      markdownStrong: {
        dark: "pink900",
        light: "pink700"
      },
      markdownHorizontalRule: {
        dark: "gray500",
        light: "#999999"
      },
      markdownListItem: {
        dark: "gray1000",
        light: "lightGray1000"
      },
      markdownListEnumeration: {
        dark: "blue900",
        light: "blue700"
      },
      markdownImage: {
        dark: "teal900",
        light: "teal700"
      },
      markdownImageText: {
        dark: "cyan",
        light: "teal700"
      },
      markdownCodeBlock: {
        dark: "gray1000",
        light: "lightGray1000"
      },
      syntaxComment: {
        dark: "gray600",
        light: "#888888"
      },
      syntaxKeyword: {
        dark: "pink900",
        light: "pink700"
      },
      syntaxFunction: {
        dark: "purple900",
        light: "purple700"
      },
      syntaxVariable: {
        dark: "blue900",
        light: "blue700"
      },
      syntaxString: {
        dark: "green900",
        light: "green700"
      },
      syntaxNumber: {
        dark: "amber900",
        light: "amber700"
      },
      syntaxType: {
        dark: "teal900",
        light: "teal700"
      },
      syntaxOperator: {
        dark: "pink900",
        light: "pink700"
      },
      syntaxPunctuation: {
        dark: "gray1000",
        light: "lightGray1000"
      }
    }
  };
});

// src/ui/theme/themes/vesper.json
var vesper_default;
var init_vesper = __esm(() => {
  vesper_default = {
    $schema: "https://opencode.ai/theme.json",
    defs: {
      vesperBg: "#101010",
      vesperFg: "#FFF",
      vesperComment: "#8b8b8b",
      vesperKeyword: "#A0A0A0",
      vesperFunction: "#FFC799",
      vesperString: "#99FFE4",
      vesperNumber: "#FFC799",
      vesperError: "#FF8080",
      vesperWarning: "#FFC799",
      vesperSuccess: "#99FFE4",
      vesperMuted: "#A0A0A0"
    },
    theme: {
      primary: {
        dark: "#FFC799",
        light: "#FFC799"
      },
      secondary: {
        dark: "#99FFE4",
        light: "#99FFE4"
      },
      accent: {
        dark: "#FFC799",
        light: "#FFC799"
      },
      error: {
        dark: "vesperError",
        light: "vesperError"
      },
      warning: {
        dark: "vesperWarning",
        light: "vesperWarning"
      },
      success: {
        dark: "vesperSuccess",
        light: "vesperSuccess"
      },
      info: {
        dark: "#FFC799",
        light: "#FFC799"
      },
      text: {
        dark: "vesperFg",
        light: "vesperBg"
      },
      textMuted: {
        dark: "vesperMuted",
        light: "vesperMuted"
      },
      background: {
        dark: "vesperBg",
        light: "#FFF"
      },
      backgroundPanel: {
        dark: "vesperBg",
        light: "#F0F0F0"
      },
      backgroundElement: {
        dark: "vesperBg",
        light: "#E0E0E0"
      },
      border: {
        dark: "#282828",
        light: "#D0D0D0"
      },
      borderActive: {
        dark: "#FFC799",
        light: "#FFC799"
      },
      borderSubtle: {
        dark: "#1C1C1C",
        light: "#E8E8E8"
      },
      diffAdded: {
        dark: "vesperSuccess",
        light: "vesperSuccess"
      },
      diffRemoved: {
        dark: "vesperError",
        light: "vesperError"
      },
      diffContext: {
        dark: "vesperMuted",
        light: "vesperMuted"
      },
      diffHunkHeader: {
        dark: "vesperMuted",
        light: "vesperMuted"
      },
      diffHighlightAdded: {
        dark: "vesperSuccess",
        light: "vesperSuccess"
      },
      diffHighlightRemoved: {
        dark: "vesperError",
        light: "vesperError"
      },
      diffAddedBg: {
        dark: "#0d2818",
        light: "#e8f5e8"
      },
      diffRemovedBg: {
        dark: "#281a1a",
        light: "#f5e8e8"
      },
      diffContextBg: {
        dark: "vesperBg",
        light: "#F8F8F8"
      },
      diffLineNumber: {
        dark: "#505050",
        light: "#808080"
      },
      diffAddedLineNumberBg: {
        dark: "#0d2818",
        light: "#e8f5e8"
      },
      diffRemovedLineNumberBg: {
        dark: "#281a1a",
        light: "#f5e8e8"
      },
      markdownText: {
        dark: "vesperFg",
        light: "vesperBg"
      },
      markdownHeading: {
        dark: "#FFC799",
        light: "#FFC799"
      },
      markdownLink: {
        dark: "#FFC799",
        light: "#FFC799"
      },
      markdownLinkText: {
        dark: "vesperMuted",
        light: "vesperMuted"
      },
      markdownCode: {
        dark: "vesperMuted",
        light: "vesperMuted"
      },
      markdownBlockQuote: {
        dark: "vesperFg",
        light: "vesperBg"
      },
      markdownEmph: {
        dark: "vesperFg",
        light: "vesperBg"
      },
      markdownStrong: {
        dark: "vesperFg",
        light: "vesperBg"
      },
      markdownHorizontalRule: {
        dark: "#65737E",
        light: "#65737E"
      },
      markdownListItem: {
        dark: "vesperFg",
        light: "vesperBg"
      },
      markdownListEnumeration: {
        dark: "vesperFg",
        light: "vesperBg"
      },
      markdownImage: {
        dark: "#FFC799",
        light: "#FFC799"
      },
      markdownImageText: {
        dark: "vesperMuted",
        light: "vesperMuted"
      },
      markdownCodeBlock: {
        dark: "vesperFg",
        light: "vesperBg"
      },
      syntaxComment: {
        dark: "vesperComment",
        light: "vesperComment"
      },
      syntaxKeyword: {
        dark: "vesperKeyword",
        light: "vesperKeyword"
      },
      syntaxFunction: {
        dark: "vesperFunction",
        light: "vesperFunction"
      },
      syntaxVariable: {
        dark: "vesperFg",
        light: "vesperBg"
      },
      syntaxString: {
        dark: "vesperString",
        light: "vesperString"
      },
      syntaxNumber: {
        dark: "vesperNumber",
        light: "vesperNumber"
      },
      syntaxType: {
        dark: "vesperFunction",
        light: "vesperFunction"
      },
      syntaxOperator: {
        dark: "vesperKeyword",
        light: "vesperKeyword"
      },
      syntaxPunctuation: {
        dark: "vesperFg",
        light: "vesperBg"
      }
    }
  };
});

// src/ui/theme/themes/zenburn.json
var zenburn_default;
var init_zenburn = __esm(() => {
  zenburn_default = {
    $schema: "https://opencode.ai/theme.json",
    defs: {
      bg: "#3f3f3f",
      bgAlt: "#4f4f4f",
      bgPanel: "#5f5f5f",
      fg: "#dcdccc",
      fgMuted: "#9f9f9f",
      red: "#cc9393",
      redBright: "#dca3a3",
      green: "#7f9f7f",
      greenBright: "#8fb28f",
      yellow: "#f0dfaf",
      yellowDim: "#e0cf9f",
      blue: "#8cd0d3",
      blueDim: "#7cb8bb",
      magenta: "#dc8cc3",
      cyan: "#93e0e3",
      orange: "#dfaf8f"
    },
    theme: {
      primary: {
        dark: "blue",
        light: "#5f7f8f"
      },
      secondary: {
        dark: "magenta",
        light: "#8f5f8f"
      },
      accent: {
        dark: "cyan",
        light: "#5f8f8f"
      },
      error: {
        dark: "red",
        light: "#8f5f5f"
      },
      warning: {
        dark: "yellow",
        light: "#8f8f5f"
      },
      success: {
        dark: "green",
        light: "#5f8f5f"
      },
      info: {
        dark: "orange",
        light: "#8f7f5f"
      },
      text: {
        dark: "fg",
        light: "#3f3f3f"
      },
      textMuted: {
        dark: "fgMuted",
        light: "#6f6f6f"
      },
      background: {
        dark: "bg",
        light: "#ffffef"
      },
      backgroundPanel: {
        dark: "bgAlt",
        light: "#f5f5e5"
      },
      backgroundElement: {
        dark: "bgPanel",
        light: "#ebebdb"
      },
      border: {
        dark: "#5f5f5f",
        light: "#d0d0c0"
      },
      borderActive: {
        dark: "blue",
        light: "#5f7f8f"
      },
      borderSubtle: {
        dark: "#4f4f4f",
        light: "#e0e0d0"
      },
      diffAdded: {
        dark: "green",
        light: "#5f8f5f"
      },
      diffRemoved: {
        dark: "red",
        light: "#8f5f5f"
      },
      diffContext: {
        dark: "fgMuted",
        light: "#6f6f6f"
      },
      diffHunkHeader: {
        dark: "cyan",
        light: "#5f8f8f"
      },
      diffHighlightAdded: {
        dark: "greenBright",
        light: "#5f8f5f"
      },
      diffHighlightRemoved: {
        dark: "redBright",
        light: "#8f5f5f"
      },
      diffAddedBg: {
        dark: "#4f5f4f",
        light: "#efffef"
      },
      diffRemovedBg: {
        dark: "#5f4f4f",
        light: "#ffefef"
      },
      diffContextBg: {
        dark: "bgAlt",
        light: "#f5f5e5"
      },
      diffLineNumber: {
        dark: "#6f6f6f",
        light: "#b0b0a0"
      },
      diffAddedLineNumberBg: {
        dark: "#4f5f4f",
        light: "#efffef"
      },
      diffRemovedLineNumberBg: {
        dark: "#5f4f4f",
        light: "#ffefef"
      },
      markdownText: {
        dark: "fg",
        light: "#3f3f3f"
      },
      markdownHeading: {
        dark: "yellow",
        light: "#8f8f5f"
      },
      markdownLink: {
        dark: "blue",
        light: "#5f7f8f"
      },
      markdownLinkText: {
        dark: "cyan",
        light: "#5f8f8f"
      },
      markdownCode: {
        dark: "green",
        light: "#5f8f5f"
      },
      markdownBlockQuote: {
        dark: "fgMuted",
        light: "#6f6f6f"
      },
      markdownEmph: {
        dark: "yellowDim",
        light: "#8f8f5f"
      },
      markdownStrong: {
        dark: "orange",
        light: "#8f7f5f"
      },
      markdownHorizontalRule: {
        dark: "fgMuted",
        light: "#6f6f6f"
      },
      markdownListItem: {
        dark: "blue",
        light: "#5f7f8f"
      },
      markdownListEnumeration: {
        dark: "cyan",
        light: "#5f8f8f"
      },
      markdownImage: {
        dark: "blue",
        light: "#5f7f8f"
      },
      markdownImageText: {
        dark: "cyan",
        light: "#5f8f8f"
      },
      markdownCodeBlock: {
        dark: "fg",
        light: "#3f3f3f"
      },
      syntaxComment: {
        dark: "#7f9f7f",
        light: "#5f7f5f"
      },
      syntaxKeyword: {
        dark: "yellow",
        light: "#8f8f5f"
      },
      syntaxFunction: {
        dark: "blue",
        light: "#5f7f8f"
      },
      syntaxVariable: {
        dark: "fg",
        light: "#3f3f3f"
      },
      syntaxString: {
        dark: "red",
        light: "#8f5f5f"
      },
      syntaxNumber: {
        dark: "greenBright",
        light: "#5f8f5f"
      },
      syntaxType: {
        dark: "cyan",
        light: "#5f8f8f"
      },
      syntaxOperator: {
        dark: "yellow",
        light: "#8f8f5f"
      },
      syntaxPunctuation: {
        dark: "fg",
        light: "#3f3f3f"
      }
    }
  };
});

// src/ui/theme/builtinThemes.ts
var BUILTIN_THEMES;
var init_builtinThemes = __esm(() => {
  init_aura();
  init_ayu();
  init_catppuccin();
  init_catppuccin_frappe();
  init_catppuccin_macchiato();
  init_cobalt2();
  init_cursor();
  init_dracula();
  init_everforest();
  init_flexoki();
  init_github();
  init_gruvbox();
  init_kanagawa();
  init_lucent_orng();
  init_material();
  init_matrix();
  init_mercury();
  init_monokai();
  init_nightowl();
  init_nord();
  init_one_dark();
  init_opencode();
  init_orng();
  init_osaka_jade();
  init_palenight();
  init_rosepine();
  init_solarized();
  init_synthwave84();
  init_tokyonight();
  init_vercel();
  init_vesper();
  init_zenburn();
  BUILTIN_THEMES = [
    { id: "opencode", displayName: "OpenCode", source: "builtin", file: opencode_default },
    { id: "aura", displayName: "Aura", source: "builtin", file: aura_default },
    { id: "tokyonight", displayName: "Tokyo Night", source: "builtin", file: tokyonight_default },
    { id: "everforest", displayName: "Everforest", source: "builtin", file: everforest_default },
    { id: "ayu", displayName: "Ayu", source: "builtin", file: ayu_default, mode: "dark" },
    { id: "catppuccin-mocha", displayName: "Catppuccin Mocha", source: "builtin", file: catppuccin_default, mode: "dark" },
    { id: "catppuccin-latte", displayName: "Catppuccin Latte", source: "builtin", file: catppuccin_default, mode: "light" },
    { id: "catppuccin-frappe", displayName: "Catppuccin Frappe", source: "builtin", file: catppuccin_frappe_default, mode: "dark" },
    { id: "catppuccin-macchiato", displayName: "Catppuccin Macchiato", source: "builtin", file: catppuccin_macchiato_default, mode: "dark" },
    { id: "cobalt2", displayName: "Cobalt2", source: "builtin", file: cobalt2_default },
    { id: "cursor", displayName: "Cursor", source: "builtin", file: cursor_default },
    { id: "dracula", displayName: "Dracula", source: "builtin", file: dracula_default },
    { id: "flexoki", displayName: "Flexoki", source: "builtin", file: flexoki_default },
    { id: "github", displayName: "GitHub", source: "builtin", file: github_default },
    { id: "gruvbox", displayName: "Gruvbox", source: "builtin", file: gruvbox_default },
    { id: "kanagawa", displayName: "Kanagawa", source: "builtin", file: kanagawa_default },
    { id: "lucent-orng", displayName: "Lucent Orng", source: "builtin", file: lucent_orng_default },
    { id: "material", displayName: "Material", source: "builtin", file: material_default },
    { id: "matrix", displayName: "Matrix", source: "builtin", file: matrix_default },
    { id: "mercury", displayName: "Mercury", source: "builtin", file: mercury_default },
    { id: "monokai", displayName: "Monokai", source: "builtin", file: monokai_default },
    { id: "nightowl", displayName: "Night Owl", source: "builtin", file: nightowl_default },
    { id: "nord", displayName: "Nord", source: "builtin", file: nord_default },
    { id: "one-dark", displayName: "One Dark", source: "builtin", file: one_dark_default },
    { id: "orng", displayName: "Orng", source: "builtin", file: orng_default },
    { id: "osaka-jade", displayName: "Osaka Jade", source: "builtin", file: osaka_jade_default },
    { id: "palenight", displayName: "Palenight", source: "builtin", file: palenight_default },
    { id: "rosepine", displayName: "Ros\xE9 Pine", source: "builtin", file: rosepine_default },
    { id: "solarized", displayName: "Solarized", source: "builtin", file: solarized_default },
    { id: "synthwave84", displayName: "Synthwave 84", source: "builtin", file: synthwave84_default },
    { id: "vercel", displayName: "Vercel", source: "builtin", file: vercel_default },
    { id: "vesper", displayName: "Vesper", source: "builtin", file: vesper_default },
    { id: "zenburn", displayName: "Zenburn", source: "builtin", file: zenburn_default }
  ];
});

// src/ui/theme/themeSchema.ts
import { RGBA, parseColor, rgbToHex } from "@opentui/core";
function isVariantObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isHexColor(value) {
  return /^#[0-9a-fA-F]{6}$/.test(value) || /^#[0-9a-fA-F]{8}$/.test(value);
}
function ansiIndexToHex(index) {
  const clamped = Math.max(0, Math.min(255, Math.floor(index)));
  const ansi16 = [
    [0, 0, 0],
    [205, 0, 0],
    [0, 205, 0],
    [205, 205, 0],
    [0, 0, 238],
    [205, 0, 205],
    [0, 205, 205],
    [229, 229, 229],
    [127, 127, 127],
    [255, 0, 0],
    [0, 255, 0],
    [255, 255, 0],
    [92, 92, 255],
    [255, 0, 255],
    [0, 255, 255],
    [255, 255, 255]
  ];
  if (clamped < 16) {
    const [r, g, b] = ansi16[clamped] ?? [255, 255, 255];
    return rgbToHex(RGBA.fromInts(r, g, b));
  }
  if (clamped >= 16 && clamped <= 231) {
    const idx = clamped - 16;
    const r = Math.floor(idx / 36);
    const g = Math.floor(idx % 36 / 6);
    const b = idx % 6;
    const steps = [0, 95, 135, 175, 215, 255];
    return rgbToHex(RGBA.fromInts(steps[r], steps[g], steps[b]));
  }
  const gray = 8 + (clamped - 232) * 10;
  return rgbToHex(RGBA.fromInts(gray, gray, gray));
}
function resolveThemeColor(raw, options) {
  if (raw === undefined)
    return;
  if (typeof raw === "number") {
    return ansiIndexToHex(raw);
  }
  if (typeof raw === "string") {
    if (raw === "none")
      return;
    if (raw === "transparent")
      return "transparent";
    if (isHexColor(raw))
      return raw;
    const defValue = options.defs[raw];
    if (defValue !== undefined) {
      const stack = options.stack ?? [];
      if (stack.includes(raw)) {
        return;
      }
      return resolveThemeColor(defValue, { ...options, stack: [...stack, raw] });
    }
    try {
      return rgbToHex(parseColor(raw));
    } catch {
      return raw;
    }
  }
  if (isVariantObject(raw)) {
    const variant = options.mode === "light" ? raw.light : raw.dark;
    return resolveThemeColor(variant ?? raw.dark ?? raw.light, options);
  }
  return;
}
function resolveThemeFile(id, themeFile, mode) {
  const defs = themeFile.defs ?? {};
  const tokens = {};
  for (const [key, value] of Object.entries(themeFile.theme ?? {})) {
    tokens[key] = resolveThemeColor(value, { mode, defs });
  }
  return { id, tokens };
}
var init_themeSchema = () => {};

// src/ui/theme/Theme.ts
import fs4 from "fs";
import path5 from "path";
import { SyntaxStyle, parseColor as parseColor2 } from "@opentui/core";
function detectSystemThemeMode() {
  try {
    if (process.platform === "darwin") {
      const proc2 = Bun.spawnSync({
        cmd: ["defaults", "read", "-g", "AppleInterfaceStyle"],
        stdout: "pipe",
        stderr: "pipe"
      });
      const out2 = proc2.stdout ? new TextDecoder().decode(proc2.stdout).trim() : "";
      return out2.toLowerCase().includes("dark") ? "dark" : "light";
    }
    if (process.platform === "win32") {
      const proc2 = Bun.spawnSync({
        cmd: [
          "reg",
          "query",
          "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize",
          "/v",
          "AppsUseLightTheme"
        ],
        stdout: "pipe",
        stderr: "pipe"
      });
      const out2 = proc2.stdout ? new TextDecoder().decode(proc2.stdout) : "";
      return out2.includes("0x0") ? "dark" : "light";
    }
    const proc = Bun.spawnSync({
      cmd: ["gsettings", "get", "org.gnome.desktop.interface", "color-scheme"],
      stdout: "pipe",
      stderr: "pipe"
    });
    const out = proc.stdout ? new TextDecoder().decode(proc.stdout).toLowerCase() : "";
    return out.includes("dark") ? "dark" : "light";
  } catch {
    return "dark";
  }
}
function slugToTitle(slug) {
  return slug.split(/[-_]/g).filter(Boolean).map((word) => word[0]?.toUpperCase() + word.slice(1)).join(" ");
}
function tryReadJson(filePath) {
  try {
    const raw = fs4.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function isThemeFile(value) {
  return typeof value === "object" && value !== null && "theme" in value && typeof value.theme === "object" && value.theme !== null;
}
function listThemeFiles(dir) {
  if (!fs4.existsSync(dir))
    return [];
  const entries = [];
  for (const fileName of fs4.readdirSync(dir)) {
    if (!fileName.endsWith(".json"))
      continue;
    const filePath = path5.join(dir, fileName);
    const parsed = tryReadJson(filePath);
    if (!isThemeFile(parsed))
      continue;
    const id = path5.basename(fileName, ".json");
    entries.push({
      info: { id, displayName: slugToTitle(id), source: "user" },
      file: parsed
    });
  }
  return entries;
}
function themeDirsForCwd(cwd) {
  const detection = new ProjectDetection().detectAndroidProject(cwd);
  const dirs = [];
  dirs.push({ source: "user", dir: path5.join(getConfigDir(), "themes") });
  if (detection.projectRoot) {
    dirs.push({ source: "project", dir: path5.join(detection.projectRoot, ".droidforge", "themes") });
  }
  dirs.push({ source: "cwd", dir: path5.join(cwd, ".droidforge", "themes") });
  return dirs;
}

class ThemeManager {
  currentThemeId;
  currentTheme;
  currentMode;
  modePreference;
  listeners = new Set;
  themeRegistry = new Map;
  constructor() {
    this.currentThemeId = "opencode";
    this.currentTheme = this.buildFallbackTheme();
    this.currentMode = "dark";
    this.modePreference = "dark";
    for (const theme of BUILTIN_THEMES) {
      this.themeRegistry.set(theme.id, {
        info: { id: theme.id, displayName: theme.displayName, source: theme.source },
        file: theme.file,
        modeOverride: theme.mode
      });
    }
  }
  buildFallbackTheme() {
    return {
      id: "fallback",
      displayName: "Fallback",
      backgroundColor: "transparent",
      panelBackgroundColor: "transparent",
      elementBackgroundColor: "transparent",
      textColor: "#E2E8F0",
      mutedTextColor: "#64748B",
      borderColor: "#475569",
      borderActiveColor: "#94A3B8",
      primaryColor: "#3b82f6",
      secondaryColor: "#1e40af",
      accentColor: "#38BDF8",
      selectedBackgroundColor: "#1E3A5F",
      selectedTextColor: "#38BDF8",
      descriptionColor: "#64748B",
      selectedDescriptionColor: "#94A3B8",
      footerBackgroundColor: "#1e40af",
      footerBorderColor: "#1d4ed8",
      footerTextColor: "#dbeafe"
    };
  }
  onThemeChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  emitThemeChange() {
    for (const listener of this.listeners) {
      listener();
    }
  }
  async reloadThemes() {
    this.themeRegistry.clear();
    for (const theme of BUILTIN_THEMES) {
      this.themeRegistry.set(theme.id, {
        info: { id: theme.id, displayName: theme.displayName, source: theme.source },
        file: theme.file,
        modeOverride: theme.mode
      });
    }
    const cwd = process.cwd();
    const dirs = themeDirsForCwd(cwd);
    for (const { source, dir } of dirs) {
      const themes = listThemeFiles(dir);
      for (const entry of themes) {
        entry.info.source = source;
        this.themeRegistry.set(entry.info.id, entry);
      }
    }
    await this.loadSelectedTheme();
  }
  listThemes() {
    return [...this.themeRegistry.values()].map((entry) => entry.info).sort((a, b) => a.displayName.localeCompare(b.displayName));
  }
  getTheme() {
    return { ...this.currentTheme };
  }
  getThemeId() {
    return this.currentThemeId;
  }
  getThemeModePreference() {
    return this.modePreference;
  }
  getEffectiveThemeMode() {
    return this.currentMode;
  }
  async setTheme(themeId) {
    if (!this.themeRegistry.has(themeId))
      return;
    const config = await ensureConfigFileExists();
    const prefMode = config.preferences.themeMode ?? "dark";
    if (prefMode === "system") {
      const key = this.currentMode === "dark" ? "themeIdDark" : "themeIdLight";
      await updateConfig({ preferences: { [key]: themeId } });
    } else {
      await updateConfig({ preferences: { themeId } });
    }
    await this.loadSelectedTheme();
  }
  async setThemeForMode(themeId, mode) {
    if (!this.themeRegistry.has(themeId))
      return;
    const key = mode === "dark" ? "themeIdDark" : "themeIdLight";
    await updateConfig({ preferences: { [key]: themeId } });
    if (this.modePreference === "system" && this.currentMode === mode) {
      await this.loadSelectedTheme();
    }
  }
  async setThemeModePreference(mode) {
    await updateConfig({ preferences: { themeMode: mode } });
    await this.loadSelectedTheme();
  }
  async loadSelectedTheme() {
    try {
      const config = await ensureConfigFileExists();
      const prefMode = config.preferences.themeMode ?? "dark";
      this.modePreference = prefMode;
      this.currentMode = prefMode === "system" ? detectSystemThemeMode() : prefMode;
      const fallbackId = config.preferences.themeId ?? "opencode";
      let desiredId = fallbackId;
      if (prefMode === "system") {
        desiredId = this.currentMode === "dark" ? config.preferences.themeIdDark ?? fallbackId : config.preferences.themeIdLight ?? fallbackId;
      }
      if (this.themeRegistry.has(desiredId)) {
        this.currentThemeId = desiredId;
      } else if (this.themeRegistry.has(fallbackId)) {
        this.currentThemeId = fallbackId;
      } else {
        this.currentThemeId = "opencode";
      }
    } catch {}
    const next = this.resolveUiTheme(this.currentThemeId);
    this.currentTheme = next;
    this.emitThemeChange();
  }
  resolveUiTheme(themeId) {
    const entry = this.themeRegistry.get(themeId);
    if (!entry)
      return this.buildFallbackTheme();
    const mode = entry.modeOverride ?? this.currentMode;
    const resolved = resolveThemeFile(themeId, entry.file, mode);
    const t = resolved.tokens;
    const background = t.background ?? "transparent";
    const panelBackground = t.backgroundPanel ?? background;
    const elementBackground = t.backgroundElement ?? panelBackground;
    const border = t.border;
    const borderActive = t.borderActive ?? border;
    const primary = t.primary;
    const secondary = t.secondary;
    const accent = t.accent ?? primary;
    const text = t.text;
    const textMuted = t.textMuted;
    const selectedBg = elementBackground;
    const selectedText = primary ?? accent;
    const description = textMuted;
    const selectedDescription = textMuted;
    const footerBg = secondary ?? panelBackground;
    const footerBorder = primary ?? border;
    return {
      id: entry.info.id,
      displayName: entry.info.displayName,
      backgroundColor: background,
      panelBackgroundColor: panelBackground,
      elementBackgroundColor: elementBackground,
      textColor: text,
      mutedTextColor: textMuted,
      borderColor: border,
      borderActiveColor: borderActive,
      primaryColor: primary,
      secondaryColor: secondary,
      accentColor: accent,
      selectedBackgroundColor: selectedBg,
      selectedTextColor: selectedText,
      descriptionColor: description,
      selectedDescriptionColor: selectedDescription,
      footerBackgroundColor: footerBg,
      footerBorderColor: footerBorder,
      footerTextColor: text
    };
  }
  getAnsiPalette() {
    const theme = this.currentTheme;
    const bg = theme.backgroundColor;
    const fg = theme.textColor;
    return [
      { name: "black", color: bg },
      { name: "red", color: theme.accentColor ?? theme.primaryColor },
      { name: "green", color: theme.primaryColor },
      { name: "yellow", color: theme.secondaryColor },
      { name: "blue", color: theme.primaryColor },
      { name: "magenta", color: theme.secondaryColor },
      { name: "cyan", color: theme.accentColor },
      { name: "white", color: fg },
      { name: "brightBlack", color: theme.borderColor },
      { name: "brightRed", color: theme.accentColor },
      { name: "brightGreen", color: theme.primaryColor },
      { name: "brightYellow", color: theme.secondaryColor },
      { name: "brightBlue", color: theme.primaryColor },
      { name: "brightMagenta", color: theme.secondaryColor },
      { name: "brightCyan", color: theme.accentColor },
      { name: "brightWhite", color: fg }
    ];
  }
  getAnsiPaletteMap() {
    const mapping = {};
    for (const { name, color } of this.getAnsiPalette()) {
      if (!color)
        continue;
      try {
        mapping[name] = parseColor2(color);
      } catch {}
    }
    return mapping;
  }
  getSyntaxStyle() {
    const entry = this.themeRegistry.get(this.currentThemeId);
    if (!entry) {
      return SyntaxStyle.create();
    }
    const mode = entry.modeOverride ?? this.currentMode;
    const resolved = resolveThemeFile(this.currentThemeId, entry.file, mode);
    const t = resolved.tokens;
    const styles = {
      default: {
        fg: t.text,
        bg: t.background
      },
      comment: {
        fg: t.syntaxComment ?? t.textMuted,
        italic: true
      },
      keyword: {
        fg: t.syntaxKeyword ?? t.secondary ?? t.primary,
        bold: true
      },
      function: {
        fg: t.syntaxFunction ?? t.primary
      },
      variable: {
        fg: t.syntaxVariable ?? t.text
      },
      string: {
        fg: t.syntaxString ?? t.accent ?? t.primary
      },
      number: {
        fg: t.syntaxNumber ?? t.accent ?? t.secondary
      },
      type: {
        fg: t.syntaxType ?? t.secondary
      },
      operator: {
        fg: t.syntaxOperator ?? t.textMuted
      },
      punctuation: {
        fg: t.syntaxPunctuation ?? t.text
      }
    };
    return SyntaxStyle.fromStyles(styles);
  }
  async ensureUserThemesDir() {
    const dir = path5.join(getConfigDir(), "themes");
    await fs4.promises.mkdir(dir, { recursive: true });
    return dir;
  }
}
var init_Theme = __esm(() => {
  init_config();
  init_paths();
  init_builtinThemes();
  init_themeSchema();
});

// src/ui/theme/index.ts
var exports_theme = {};
__export(exports_theme, {
  ThemeManager: () => ThemeManager
});
var init_theme = __esm(() => {
  init_Theme();
});

// src/viewmodels/MainMenuViewModel.ts
class MainMenuViewModel {
  forgeMenuOptions = [
    {
      name: "Project Ledger",
      description: "Find, open, and switch Android projects",
      value: "projects"
    },
    {
      name: "Smithy (Devices)",
      description: "Manage emulators and connected devices",
      value: "devices"
    },
    {
      name: "Command Tongs (ADB)",
      description: "Quick ADB actions without the finger burns",
      value: "adb"
    },
    {
      name: "Maker\u2019s Mark",
      description: "About Droidforge, version, links",
      value: "about"
    }
  ];
  anvilMenuOptions = [
    {
      name: "Strike (Run)",
      description: "Build \u2192 install \u2192 launch \u2192 open Logcat",
      value: "actionoutputview:installDebug"
    },
    {
      name: "Temper (Build)",
      description: "Build the project without deploying",
      value: "actionoutputview:assembleDebug"
    },
    {
      name: "Kiln View (App Logs)",
      description: "App-focused Logcat (package/PID filtered)",
      value: "kiln-view"
    },
    {
      name: "Foundry Logs (Device Logs)",
      description: "Full device Logcat with filters",
      value: "foundry-logs"
    },
    {
      name: "Looking Glass (Mirror)",
      description: "Mirror a physical device display",
      value: "looking-glass"
    },
    {
      name: "Hammer List (Pinned Tasks)",
      description: "Your most-used Gradle tasks",
      value: "hammer-list"
    },
    {
      name: "Blueprints (All Tasks)",
      description: "Browse/search every Gradle task in the project",
      value: "blueprints"
    }
  ];
  getMenuOptions(mode) {
    return mode === "anvil" ? [...this.anvilMenuOptions] : [...this.forgeMenuOptions];
  }
  onMenuItemSelected(_index, option) {
    return option.value;
  }
}

// src/viewmodels/DashboardViewModel.ts
class DashboardViewModel {
  getQuickStats() {
    return {
      projects: 12,
      active: 3,
      completed: 9,
      templates: 25
    };
  }
  getRecentProjects() {
    return [
      "My Awesome App",
      "Web Scraper Tool",
      "API Client",
      "Data Visualizer"
    ];
  }
}

// src/viewmodels/ProjectsViewModel.ts
class ProjectsViewModel {
  projectRepo;
  projects = [];
  mode = "normal";
  removalTarget = null;
  lastSelectedIndex = 0;
  onMenuUpdate = null;
  constructor(projectRepo) {
    this.projectRepo = projectRepo;
    this.refresh();
  }
  setMenuUpdateCallback(callback) {
    this.onMenuUpdate = callback;
    this.onMenuUpdate?.();
  }
  notifyMenuUpdate() {
    this.onMenuUpdate?.();
  }
  isConfirmingRemoval() {
    return this.mode === "confirm-remove" && this.removalTarget !== null;
  }
  getRemovalTarget() {
    return this.removalTarget;
  }
  async refresh() {
    try {
      this.projects = await this.projectRepo.getAllProjects();
    } catch {
      this.projects = [];
    }
    this.notifyMenuUpdate();
  }
  async requestRemoveProjectById(projectId, selectedIndex) {
    const target = this.projects.find((project) => project.id === projectId) ?? null;
    if (!target)
      return;
    this.lastSelectedIndex = selectedIndex;
    this.mode = "confirm-remove";
    this.removalTarget = target;
    this.notifyMenuUpdate();
  }
  async confirmRemove() {
    if (!this.removalTarget)
      return;
    await this.projectRepo.deleteProject(this.removalTarget.id);
    this.mode = "normal";
    this.removalTarget = null;
    await this.refresh();
  }
  cancelRemove() {
    this.mode = "normal";
    this.removalTarget = null;
    this.notifyMenuUpdate();
  }
  getInitialSelectedIndex() {
    return this.isConfirmingRemoval() ? 0 : this.lastSelectedIndex;
  }
  getFooterText() {
    if (this.isConfirmingRemoval()) {
      const name = this.removalTarget?.name ?? "this project";
      return `Remove "${name}"? ENTER/Y: Confirm | N/ESC: Cancel`;
    }
    return "ESC: Back to Menu | \u2191\u2193: Navigate | ENTER: Open | R: Remove";
  }
  getProjects() {
    if (this.projects.length === 0) {
      return [
        {
          name: "No projects yet",
          description: "Run Droidforge inside an Android project to add it",
          value: "noop"
        }
      ];
    }
    return this.projects.map((project) => ({
      name: project.name,
      description: project.path,
      value: `open-project-${project.id}`
    }));
  }
  getAllMenuOptions() {
    if (this.isConfirmingRemoval()) {
      const name = this.removalTarget?.name ?? "this project";
      const id = this.removalTarget?.id ?? "";
      return [
        {
          name: `Remove: ${name}`,
          description: "Permanently remove from the list",
          value: `confirm-remove:${id}`
        },
        {
          name: "Cancel",
          description: "Keep it in the list",
          value: "cancel-remove"
        }
      ];
    }
    return [...this.getProjects()];
  }
  onMenuItemSelected(_index, option) {
    return option.value;
  }
}

// src/viewmodels/ToolsViewModel.ts
class ToolsViewModel {
  getCodeGenerators() {
    return [
      "API Client Generator",
      "Database Schema Tool",
      "Component Builder",
      "Test Case Generator"
    ];
  }
  getUtilities() {
    return [
      "Code Formatter",
      "Dependency Checker",
      "Performance Analyzer",
      "Documentation Tool"
    ];
  }
}

// src/viewmodels/SettingsViewModel.ts
class SettingsViewModel {
  themeManager;
  constructor(themeManager) {
    this.themeManager = themeManager;
  }
  listThemes() {
    return this.themeManager.listThemes();
  }
  getSelectedThemeId() {
    return this.themeManager.getThemeId();
  }
  getThemeModePreference() {
    return this.themeManager.getThemeModePreference();
  }
  getEffectiveThemeMode() {
    return this.themeManager.getEffectiveThemeMode();
  }
  async selectTheme(themeId) {
    await this.themeManager.setTheme(themeId);
  }
  async selectThemeForMode(themeId, mode) {
    await this.themeManager.setThemeForMode(themeId, mode);
  }
  async setThemeModePreference(mode) {
    await this.themeManager.setThemeModePreference(mode);
  }
  async reloadThemes() {
    await this.themeManager.reloadThemes();
  }
}

// src/viewmodels/AboutViewModel.ts
class AboutViewModel {
  getAppInfo() {
    return {
      name: "Droid Forge",
      version: "1.0.0",
      description: "A powerful development toolkit for building amazing applications with ease.",
      builtWith: "Built with OpenTUI - Terminal UI Framework",
      tagline: "Created for developers, by developers"
    };
  }
  getFeatures() {
    return [
      "Interactive project management",
      "Code generation tools",
      "Built-in utilities",
      "Extensible plugin system"
    ];
  }
}

// src/viewmodels/ActionsViewModel.ts
import fs5 from "fs";

class ActionsViewModel {
  _menuMessage = null;
  _onMenuUpdate = null;
  _state = "idle";
  _output = { lines: [], scrollOffset: 0, exitCode: null };
  _outputWindowSize = 20;
  _currentProcess = null;
  _onOutputUpdate = null;
  get state() {
    return this._state;
  }
  get output() {
    return this._output;
  }
  get inlineMessage() {
    return this._menuMessage;
  }
  setMenuUpdateCallback(callback) {
    this._onMenuUpdate = callback;
    this._onMenuUpdate?.();
  }
  setOutputUpdateCallback(callback) {
    this._onOutputUpdate = callback;
  }
  setOutputWindowSize(size) {
    const clamped = Math.max(1, Math.floor(size));
    if (this._outputWindowSize !== clamped) {
      this._outputWindowSize = clamped;
      this._onOutputUpdate?.();
    }
  }
  handleMenuSelection(value) {
    if (value === NO_GRADLE_VALUE || value.startsWith("__")) {
      return { action: "none" };
    }
    return { action: "navigate", command: value };
  }
  getMenuOptions() {
    if (!this.isGradleProject()) {
      return [{
        name: "No Gradle project detected",
        description: "Launch Droid Forge inside an Android Gradle project",
        value: NO_GRADLE_VALUE
      }];
    }
    return CURATED_ACTIONS.map((action) => ({
      name: action.label,
      description: action.description,
      value: action.command
    }));
  }
  async runGradleCommand(command) {
    this._state = "running";
    this._output = { lines: [], scrollOffset: 0, exitCode: null };
    this._onOutputUpdate?.();
    const cwd = process.cwd();
    const detection = new ProjectDetection().detectAndroidProject(cwd);
    if (!detection.isAndroidProject || !fs5.existsSync("gradlew")) {
      this._output.lines.push(`No Android Gradle project detected.
` + "Launch Droid Forge from your project root, or pass a path: droidforge /path/to/android/project");
      this._output.exitCode = 1;
      this._state = "error";
      this._currentProcess = null;
      this._onOutputUpdate?.();
      return;
    }
    try {
      const proc = Bun.spawn(["./gradlew", command, "--console=rich"], {
        cwd,
        stdout: "pipe",
        stderr: "pipe",
        env: {
          ...process.env,
          TERM: process.env.TERM ?? "xterm-256color"
        }
      });
      this._currentProcess = proc;
      this.streamOutput(proc.stdout);
      this.streamOutput(proc.stderr);
      const exitCode = await proc.exited;
      this._output.exitCode = exitCode;
      this._state = exitCode === 0 ? "completed" : "error";
      this._currentProcess = null;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this._output.lines.push(`Error: ${message}`);
      this._state = "error";
      this._currentProcess = null;
    }
    this._onOutputUpdate?.();
  }
  cancelTask() {
    if (this._currentProcess && this._state === "running") {
      this._currentProcess.kill();
      this._output.lines.push(`
--- Task cancelled ---`);
      this._state = "error";
      this._currentProcess = null;
      this._onOutputUpdate?.();
      return true;
    }
    return false;
  }
  scrollUp(lines = 1) {
    this._output.scrollOffset = Math.max(0, this._output.scrollOffset - lines);
    this._onOutputUpdate?.();
  }
  scrollDown(lines = 1) {
    const maxOffset = Math.max(0, this._output.lines.length - this._outputWindowSize);
    this._output.scrollOffset = Math.min(maxOffset, this._output.scrollOffset + lines);
    this._onOutputUpdate?.();
  }
  getOutputText() {
    return this._output.lines.join(`
`);
  }
  reset() {
    this._state = "idle";
    this._output = { lines: [], scrollOffset: 0, exitCode: null };
    this._currentProcess = null;
  }
  isGradleProject() {
    const cwd = process.cwd();
    const detection = new ProjectDetection().detectAndroidProject(cwd);
    const hasGradleWrapper = fs5.existsSync("gradlew");
    if (!detection.isAndroidProject || !hasGradleWrapper) {
      this._menuMessage = `No Android Gradle project detected. Launch Droid Forge from your project root,
` + "or pass a path: droidforge /path/to/android/project";
      return false;
    }
    this._menuMessage = null;
    return true;
  }
  async streamOutput(stream) {
    const reader = stream.getReader();
    const decoder = new TextDecoder;
    let pending = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done)
        break;
      pending += decoder.decode(value, { stream: true });
      pending = pending.replace(/\r\n/g, `
`).replace(/\r/g, `
`);
      const parts = pending.split(`
`);
      pending = parts.pop();
      for (const line of parts) {
        if (line.trim()) {
          this._output.lines.push(line);
        }
      }
      this._output.scrollOffset = Math.max(0, this._output.lines.length - this._outputWindowSize);
      this._onOutputUpdate?.();
    }
    if (pending.trim()) {
      this._output.lines.push(pending);
      this._onOutputUpdate?.();
    }
  }
}
var NO_GRADLE_VALUE = "__no-gradle__", CURATED_ACTIONS;
var init_ActionsViewModel = __esm(() => {
  CURATED_ACTIONS = [
    { label: "Test", description: "Runs unit tests", command: "test" },
    { label: "Clean", description: "Cleans build outputs", command: "clean" },
    { label: "Build", description: "Builds the project", command: "build" }
  ];
});

// src/viewmodels/GradleViewModel.ts
import fs6 from "fs";
var SHOW_ALL_TASKS_VALUE = "__show-all-tasks__", SHOW_CURATED_TASKS_VALUE = "__show-curated-tasks__", RETRY_TASK_DISCOVERY_VALUE = "__retry-task-discovery__", NO_GRADLE_VALUE2 = "__no-gradle__", CURATED_TASKS, CURATED_TASK_LABELS, GradleViewModel;
var init_GradleViewModel = __esm(() => {
  CURATED_TASKS = [
    "assembleDebug",
    "installDebug",
    "test",
    "connectedAndroidTest",
    "lint",
    "check",
    "build",
    "clean",
    "assembleRelease"
  ];
  CURATED_TASK_LABELS = {
    assembleDebug: { label: "Assemble Debug", fallbackDescription: "Builds the debug APK/AAB" },
    installDebug: { label: "Install Debug", fallbackDescription: "Installs the debug build on a connected device" },
    test: { label: "Unit Tests", fallbackDescription: "Runs JVM unit tests" },
    connectedAndroidTest: { label: "Instrumented Tests", fallbackDescription: "Runs connected Android tests" },
    lint: { label: "Lint", fallbackDescription: "Runs Android lint checks" },
    check: { label: "Check", fallbackDescription: "Runs verification tasks (tests, lint, etc.)" },
    build: { label: "Build", fallbackDescription: "Builds the project" },
    clean: { label: "Clean", fallbackDescription: "Cleans build outputs" },
    assembleRelease: { label: "Assemble Release", fallbackDescription: "Builds the release APK/AAB" }
  };
  GradleViewModel = class GradleViewModel {
    static taskCache = new Map;
    _menuState = "loading";
    _menuMessage = null;
    _tasks = [];
    _showAllTasks = false;
    _showToggle = true;
    _tasksLoadPromise = null;
    _onMenuUpdate = null;
    constructor(options = {}) {
      this._showAllTasks = options.mode === "all";
      this._showToggle = options.showToggle ?? true;
      this.loadGradleTasks();
    }
    get inlineMessage() {
      return this._menuMessage;
    }
    setMenuUpdateCallback(callback) {
      this._onMenuUpdate = callback;
      this._onMenuUpdate?.();
    }
    handleMenuSelection(value) {
      switch (value) {
        case SHOW_ALL_TASKS_VALUE:
          this._showAllTasks = true;
          this.notifyMenuUpdate();
          return { action: "none" };
        case SHOW_CURATED_TASKS_VALUE:
          this._showAllTasks = false;
          this.notifyMenuUpdate();
          return { action: "none" };
        case RETRY_TASK_DISCOVERY_VALUE:
          this._tasksLoadPromise = null;
          this.loadGradleTasks();
          return { action: "none" };
        case NO_GRADLE_VALUE2:
          return { action: "none" };
        default:
          if (value.startsWith("__")) {
            return { action: "none" };
          }
          return { action: "navigate", command: value };
      }
    }
    getMenuOptions() {
      switch (this._menuState) {
        case "loading":
          return [{
            name: "Loading Gradle tasks\u2026",
            description: "Please wait",
            value: "__loading__"
          }];
        case "not-gradle":
          return [{
            name: "No Gradle project detected",
            description: "Launch Droid Forge inside an Android Gradle project",
            value: NO_GRADLE_VALUE2
          }];
        case "error":
          return [{
            name: "Failed to load Gradle tasks",
            description: "Select to retry task discovery",
            value: RETRY_TASK_DISCOVERY_VALUE
          }];
        case "ready": {
          const taskOptions = this._showAllTasks ? this.buildAllTaskOptions() : this.buildCuratedTaskOptions();
          const options = [...taskOptions];
          if (this._showToggle) {
            const toggleOption = this._showAllTasks ? {
              name: "Show curated tasks",
              description: "Return to the recommended shortlist",
              value: SHOW_CURATED_TASKS_VALUE
            } : {
              name: "Show all tasks",
              description: "List every task from `./gradlew tasks --all`",
              value: SHOW_ALL_TASKS_VALUE
            };
            options.push(toggleOption);
          }
          return options;
        }
      }
    }
    async loadGradleTasks() {
      if (this._tasksLoadPromise)
        return this._tasksLoadPromise;
      this._tasksLoadPromise = (async () => {
        this._menuState = "loading";
        this._menuMessage = null;
        this.notifyMenuUpdate();
        const cwd = process.cwd();
        const cachedTasks = GradleViewModel.taskCache.get(cwd);
        if (cachedTasks) {
          this._tasks = cachedTasks;
          this._menuState = "ready";
          this._menuMessage = null;
          this.notifyMenuUpdate();
          return;
        }
        const detection = new ProjectDetection().detectAndroidProject(cwd);
        const hasGradleWrapper = fs6.existsSync("gradlew");
        if (!detection.isAndroidProject || !hasGradleWrapper) {
          this._menuState = "not-gradle";
          this._menuMessage = `No Android Gradle project detected. Launch Droid Forge from your project root,
` + "or pass a path: droidforge /path/to/android/project";
          this._tasks = [];
          this.notifyMenuUpdate();
          return;
        }
        const proc = Bun.spawn(["./gradlew", "tasks", "--all", "--console=plain"], {
          cwd,
          stdout: "pipe",
          stderr: "pipe"
        });
        const stdoutPromise = new Response(proc.stdout).text();
        const stderrPromise = new Response(proc.stderr).text();
        const exitCode = await proc.exited;
        const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);
        if (exitCode !== 0) {
          this._menuState = "error";
          this._menuMessage = (stderr || stdout).trim() || "Gradle task discovery failed.";
          this._tasks = [];
          this.notifyMenuUpdate();
          return;
        }
        const tasks = this.parseGradleTasks(stdout);
        this._tasks = tasks;
        GradleViewModel.taskCache.set(cwd, tasks);
        this._menuState = "ready";
        this._menuMessage = null;
        this.notifyMenuUpdate();
      })();
      return this._tasksLoadPromise;
    }
    notifyMenuUpdate() {
      this._onMenuUpdate?.();
    }
    buildTaskIndex() {
      return new Map(this._tasks.map((t) => [t.name, t]));
    }
    buildCuratedTaskOptions() {
      const index = this.buildTaskIndex();
      const available = new Set(index.keys());
      const options = [];
      for (const baseTask of CURATED_TASKS) {
        const resolved = this.resolvePreferredTaskName(baseTask, available);
        if (!resolved)
          continue;
        const task = index.get(resolved);
        const meta = CURATED_TASK_LABELS[baseTask];
        const resolvedDescription = task?.description?.trim();
        const suffix = resolvedDescription ? ` \u2014 ${resolvedDescription}` : ` \u2014 ${meta.fallbackDescription}`;
        options.push({
          name: meta.label,
          description: `${resolved}${suffix}`,
          value: resolved
        });
      }
      if (options.length === 0) {
        options.push({
          name: "No common tasks found",
          description: "Select \u201CShow all tasks\u201D to browse everything",
          value: "__no-curated__"
        });
      }
      return options;
    }
    buildAllTaskOptions() {
      const index = this.buildTaskIndex();
      return [...index.values()].sort((a, b) => a.name.localeCompare(b.name)).map((task) => ({
        name: task.name,
        description: task.description,
        value: task.name
      }));
    }
    resolvePreferredTaskName(baseTask, available) {
      const appTask = `:app:${baseTask}`;
      if (available.has(appTask))
        return appTask;
      const legacyAppTask = `app:${baseTask}`;
      if (available.has(legacyAppTask))
        return legacyAppTask;
      if (available.has(baseTask))
        return baseTask;
      return null;
    }
    normalizeGradleTaskName(name) {
      const trimmed = name.trim();
      if (!trimmed)
        return "";
      if (trimmed.includes(":") && !trimmed.startsWith(":")) {
        return `:${trimmed}`;
      }
      return trimmed;
    }
    parseGradleTasks(output2) {
      const tasksByName = new Map;
      for (const rawLine of output2.split(`
`)) {
        const line = rawLine.trim();
        if (!line || line.startsWith(">"))
          continue;
        const match = line.match(/^([A-Za-z0-9:_-]+)\s+-\s+(.+)$/);
        if (!match)
          continue;
        const rawName = match[1] ?? "";
        const description = match[2] ?? "";
        const name = this.normalizeGradleTaskName(rawName);
        if (!name || tasksByName.has(name))
          continue;
        tasksByName.set(name, {
          name,
          description: description.trim()
        });
      }
      return [...tasksByName.values()];
    }
  };
});

// src/viewmodels/index.ts
var exports_viewmodels = {};
__export(exports_viewmodels, {
  ToolsViewModel: () => ToolsViewModel,
  SettingsViewModel: () => SettingsViewModel,
  ProjectsViewModel: () => ProjectsViewModel,
  MainMenuViewModel: () => MainMenuViewModel,
  GradleViewModel: () => GradleViewModel,
  DashboardViewModel: () => DashboardViewModel,
  ActionsViewModel: () => ActionsViewModel,
  AboutViewModel: () => AboutViewModel
});
var init_viewmodels = __esm(() => {
  init_ActionsViewModel();
  init_GradleViewModel();
});

// src/di/container.ts
class DIContainer {
  singletons = new Map;
  factories = new Map;
  single(key, factory) {
    this.singletons.set(key, { instance: null, factory });
  }
  factory(key, factory) {
    this.factories.set(key, factory);
  }
  get(key) {
    const singleton = this.singletons.get(key);
    if (singleton) {
      if (!singleton.instance) {
        singleton.instance = singleton.factory();
      }
      return singleton.instance;
    }
    const factory = this.factories.get(key);
    if (factory) {
      return factory();
    }
    throw new Error(`No registration found for key: ${key}`);
  }
}
async function setupDIModules() {
  const { Database: Database2, ProjectRepository: ProjectRepository2 } = await Promise.resolve().then(() => (init_repositories(), exports_repositories));
  const { ThemeManager: ThemeManager2 } = await Promise.resolve().then(() => (init_theme(), exports_theme));
  const {
    MainMenuViewModel: MainMenuViewModel2,
    DashboardViewModel: DashboardViewModel2,
    ProjectsViewModel: ProjectsViewModel2,
    ToolsViewModel: ToolsViewModel2,
    SettingsViewModel: SettingsViewModel2,
    AboutViewModel: AboutViewModel2,
    ActionsViewModel: ActionsViewModel2,
    GradleViewModel: GradleViewModel2
  } = await Promise.resolve().then(() => (init_viewmodels(), exports_viewmodels));
  diContainer.single("Database", () => new Database2);
  diContainer.single("ProjectRepository", () => new ProjectRepository2(diContainer.get("Database")));
  diContainer.single("ThemeManager", () => new ThemeManager2);
  diContainer.factory("MainMenuViewModel", () => new MainMenuViewModel2);
  diContainer.factory("DashboardViewModel", () => new DashboardViewModel2);
  diContainer.single("ProjectsViewModel", () => new ProjectsViewModel2(diContainer.get("ProjectRepository")));
  diContainer.factory("ToolsViewModel", () => new ToolsViewModel2);
  diContainer.factory("SettingsViewModel", () => new SettingsViewModel2(diContainer.get("ThemeManager")));
  diContainer.factory("AboutViewModel", () => new AboutViewModel2);
  diContainer.factory("ActionsViewModel", () => new ActionsViewModel2);
  diContainer.factory("GradleViewModel", () => new GradleViewModel2);
  diContainer.factory("HammerListViewModel", () => new GradleViewModel2({ mode: "curated", showToggle: false }));
  diContainer.factory("BlueprintsViewModel", () => new GradleViewModel2({ mode: "all", showToggle: false }));
}
var diContainer;
var init_container = __esm(() => {
  diContainer = new DIContainer;
});

// src/di/index.ts
var init_di = __esm(() => {
  init_container();
});

// src/utilities/renderer.ts
function removeRenderableFromParentOrRoot(renderer, renderable) {
  const id = renderable?.id;
  if (!id)
    return;
  const parent = renderable?.parent;
  if (parent && typeof parent.remove === "function") {
    try {
      parent.remove(id);
      return;
    } catch {}
  }
  try {
    renderer.root.remove(id);
  } catch {}
}
function clearCurrentView(renderer, currentViewElements, menuSelect) {
  for (const element of currentViewElements) {
    if (!element || typeof element !== "object")
      continue;
    try {
      element.__dispose?.();
    } catch {}
    if (typeof element.destroyRecursively === "function") {
      try {
        element.destroyRecursively();
      } catch {
        removeRenderableFromParentOrRoot(renderer, element);
      }
    } else {
      removeRenderableFromParentOrRoot(renderer, element);
    }
  }
  currentViewElements.length = 0;
  if (menuSelect) {
    if (typeof menuSelect.__dispose === "function") {
      try {
        menuSelect.__dispose();
      } catch {}
    }
    if (typeof menuSelect.destroyRecursively === "function") {
      try {
        menuSelect.destroyRecursively();
      } catch {
        removeRenderableFromParentOrRoot(renderer, menuSelect);
      }
    } else if (typeof menuSelect.destroy === "function") {
      try {
        menuSelect.destroy();
      } catch {
        removeRenderableFromParentOrRoot(renderer, menuSelect);
      }
    } else {
      removeRenderableFromParentOrRoot(renderer, menuSelect);
    }
  }
}

// src/utilities/navigation.ts
class NavigationManager {
  currentView = "menu";
  viewStack = ["menu"];
  constructor() {
    const initialView = this.getInitialView();
    this.currentView = initialView;
    this.viewStack = [initialView];
  }
  getInitialView() {
    return "menu";
  }
  getCurrentView() {
    return this.currentView;
  }
  navigateTo(view) {
    this.currentView = view;
    this.viewStack.push(view);
  }
  goBack() {
    if (this.viewStack.length > 1) {
      this.viewStack.pop();
      this.currentView = this.viewStack[this.viewStack.length - 1] || "menu";
    } else {
      this.currentView = "menu";
    }
    return this.currentView;
  }
  canGoBack() {
    return this.viewStack.length > 1;
  }
}

// src/utilities/androidProjectName.ts
import fs7 from "fs";
import path6 from "path";
function getAndroidProjectName(projectRoot) {
  const settingsCandidates = ["settings.gradle.kts", "settings.gradle"];
  for (const settingsFile of settingsCandidates) {
    const filePath = path6.join(projectRoot, settingsFile);
    if (!fs7.existsSync(filePath))
      continue;
    try {
      const content = fs7.readFileSync(filePath, "utf8");
      const match = content.match(/rootProject\.name\s*=\s*['"]([^'"]+)['"]/);
      if (match?.[1]) {
        const name = match[1].trim();
        if (name.length > 0)
          return name;
      }
    } catch {}
  }
  return path6.basename(projectRoot);
}
var init_androidProjectName = () => {};

// src/utilities/projectMemory.ts
import crypto from "crypto";
import path7 from "path";
function normalizeProjectPath(projectPath) {
  return path7.resolve(projectPath);
}
function projectIdFromPath(projectPath) {
  const normalized = normalizeProjectPath(projectPath);
  return crypto.createHash("sha1").update(normalized).digest("hex");
}
var init_projectMemory = () => {};

// src/utilities/ansiToStyledText.ts
import { RGBA as RGBA3, StyledText, TextAttributes, parseColor as parseColor3 } from "@opentui/core";
function chunk(text, state) {
  const result = {
    __isChunk: true,
    text
  };
  if (state.fg)
    result.fg = state.fg;
  if (state.bg)
    result.bg = state.bg;
  if (state.attributes)
    result.attributes = state.attributes;
  return result;
}
function xterm256ToRgb(index) {
  const clamped = Math.max(0, Math.min(255, Math.floor(index)));
  const ansi16 = [
    [0, 0, 0],
    [205, 0, 0],
    [0, 205, 0],
    [205, 205, 0],
    [0, 0, 238],
    [205, 0, 205],
    [0, 205, 205],
    [229, 229, 229],
    [127, 127, 127],
    [255, 0, 0],
    [0, 255, 0],
    [255, 255, 0],
    [92, 92, 255],
    [255, 0, 255],
    [0, 255, 255],
    [255, 255, 255]
  ];
  if (clamped < 16) {
    const [r, g, b] = ansi16[clamped] ?? [255, 255, 255];
    return RGBA3.fromInts(r, g, b);
  }
  if (clamped >= 16 && clamped <= 231) {
    const idx = clamped - 16;
    const r = Math.floor(idx / 36);
    const g = Math.floor(idx % 36 / 6);
    const b = idx % 6;
    const steps = [0, 95, 135, 175, 215, 255];
    return RGBA3.fromInts(steps[r], steps[g], steps[b]);
  }
  const gray = 8 + (clamped - 232) * 10;
  return RGBA3.fromInts(gray, gray, gray);
}
function setColorFromCode(code, state, target, palette) {
  const mapping = BASIC_COLORS[code] ?? BRIGHT_COLORS[code];
  if (!mapping)
    return;
  const themed = palette?.[mapping];
  state[target] = themed ?? parseColor3(mapping);
}
function applySgr(paramsRaw, state, palette) {
  const params = paramsRaw.length ? paramsRaw.split(";").map((p) => Number.parseInt(p, 10)) : [0];
  for (let i = 0;i < params.length; i++) {
    const code = params[i] ?? 0;
    switch (code) {
      case 0:
        state.fg = undefined;
        state.bg = undefined;
        state.attributes = 0;
        break;
      case 1:
        state.attributes |= TextAttributes.BOLD;
        break;
      case 2:
        state.attributes |= TextAttributes.DIM;
        break;
      case 3:
        state.attributes |= TextAttributes.ITALIC;
        break;
      case 4:
        state.attributes |= TextAttributes.UNDERLINE;
        break;
      case 5:
        state.attributes |= TextAttributes.BLINK;
        break;
      case 7:
        state.attributes |= TextAttributes.INVERSE;
        break;
      case 9:
        state.attributes |= TextAttributes.STRIKETHROUGH;
        break;
      case 22:
        state.attributes &= ~(TextAttributes.BOLD | TextAttributes.DIM);
        break;
      case 23:
        state.attributes &= ~TextAttributes.ITALIC;
        break;
      case 24:
        state.attributes &= ~TextAttributes.UNDERLINE;
        break;
      case 25:
        state.attributes &= ~TextAttributes.BLINK;
        break;
      case 27:
        state.attributes &= ~TextAttributes.INVERSE;
        break;
      case 29:
        state.attributes &= ~TextAttributes.STRIKETHROUGH;
        break;
      case 39:
        state.fg = undefined;
        break;
      case 49:
        state.bg = undefined;
        break;
      default:
        break;
    }
    if (code >= 30 && code <= 37) {
      setColorFromCode(code, state, "fg", palette);
      continue;
    }
    if (code >= 90 && code <= 97) {
      setColorFromCode(code, state, "fg", palette);
      continue;
    }
    if (code >= 40 && code <= 47) {
      setColorFromCode(code - 10, state, "bg", palette);
      continue;
    }
    if (code >= 100 && code <= 107) {
      setColorFromCode(code - 10, state, "bg", palette);
      continue;
    }
    if (code === 38 || code === 48) {
      const target = code === 38 ? "fg" : "bg";
      const mode = params[i + 1];
      if (mode === 2) {
        const r = params[i + 2];
        const g = params[i + 3];
        const b = params[i + 4];
        if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
          state[target] = RGBA3.fromInts(r, g, b);
          i += 4;
        }
        continue;
      }
      if (mode === 5) {
        const idx = params[i + 2];
        if (Number.isFinite(idx)) {
          state[target] = xterm256ToRgb(idx);
          i += 2;
        }
        continue;
      }
    }
  }
}
function stripUnsupportedEscapes(input2, startIndex) {
  const esc = input2[startIndex];
  if (esc !== "\x1B") {
    return { endIndex: startIndex + 1, sequence: "" };
  }
  const next = input2[startIndex + 1];
  if (!next) {
    return { endIndex: startIndex + 1, sequence: "" };
  }
  if (next === "[") {
    for (let i = startIndex + 2;i < input2.length; i++) {
      const code = input2.charCodeAt(i);
      if (code >= 64 && code <= 126) {
        return { endIndex: i + 1, sequence: input2.slice(startIndex, i + 1) };
      }
    }
    return { endIndex: input2.length, sequence: input2.slice(startIndex) };
  }
  if (next === "]") {
    for (let i = startIndex + 2;i < input2.length; i++) {
      const ch = input2[i];
      if (ch === "\x07") {
        return { endIndex: i + 1, sequence: input2.slice(startIndex, i + 1) };
      }
      if (ch === "\x1B" && input2[i + 1] === "\\") {
        return { endIndex: i + 2, sequence: input2.slice(startIndex, i + 2) };
      }
    }
    return { endIndex: input2.length, sequence: input2.slice(startIndex) };
  }
  return { endIndex: startIndex + 2, sequence: input2.slice(startIndex, startIndex + 2) };
}
function ansiToStyledText(input2, options = {}) {
  const chunks = [];
  const state = { attributes: 0 };
  let buffer = "";
  function flush() {
    if (!buffer)
      return;
    chunks.push(chunk(buffer, state));
    buffer = "";
  }
  for (let i = 0;i < input2.length; ) {
    const ch = input2[i];
    if (ch !== "\x1B") {
      buffer += ch;
      i += 1;
      continue;
    }
    flush();
    const { endIndex, sequence } = stripUnsupportedEscapes(input2, i);
    if (sequence.startsWith("\x1B[") && sequence.endsWith("m")) {
      const params = sequence.slice(2, -1);
      applySgr(params, state, options.palette);
    }
    i = endIndex;
  }
  flush();
  return new StyledText(chunks);
}
var BASIC_COLORS, BRIGHT_COLORS;
var init_ansiToStyledText = __esm(() => {
  BASIC_COLORS = {
    30: "black",
    31: "red",
    32: "green",
    33: "yellow",
    34: "blue",
    35: "magenta",
    36: "cyan",
    37: "white"
  };
  BRIGHT_COLORS = {
    90: "brightBlack",
    91: "brightRed",
    92: "brightGreen",
    93: "brightYellow",
    94: "brightBlue",
    95: "brightMagenta",
    96: "brightCyan",
    97: "brightWhite"
  };
});

// src/utilities/index.ts
var init_utilities = __esm(() => {
  init_androidProjectName();
  init_projectMemory();
  init_ansiToStyledText();
});

// src/ui/components/Header.ts
import { ASCIIFont, BoxRenderable, Text, TextAttributes as TextAttributes2 } from "@opentui/core";
function MainHeader(renderer, title, subtitle, theme) {
  const headerBox = new BoxRenderable(renderer, {
    id: "main-header-box",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
    backgroundColor: theme?.backgroundColor ?? "transparent"
  });
  const asciiElement = ASCIIFont({
    font: "tiny",
    text: title,
    color: theme?.primaryColor ?? theme?.textColor ?? "#FFFFFF",
    backgroundColor: theme?.backgroundColor ?? "transparent",
    selectable: false
  });
  headerBox.add(asciiElement);
  if (subtitle) {
    const textElement = Text({
      content: subtitle,
      attributes: TextAttributes2.DIM,
      fg: theme?.mutedTextColor ?? theme?.textColor
    });
    headerBox.add(textElement);
  }
  return headerBox;
}
function Header(renderer, title, subtitle, theme) {
  const headerBox = new BoxRenderable(renderer, {
    id: "header-box",
    justifyContent: "center",
    alignItems: "flex-start",
    marginLeft: 4,
    marginBottom: 1,
    backgroundColor: theme?.backgroundColor ?? "transparent"
  });
  const titleText = Text({
    content: title,
    attributes: TextAttributes2.BOLD,
    fg: theme?.textColor
  });
  headerBox.add(titleText);
  if (subtitle) {
    const subtitleText = Text({
      content: subtitle,
      attributes: TextAttributes2.NONE,
      fg: theme?.mutedTextColor ?? theme?.textColor
    });
    headerBox.add(subtitleText);
  }
  return headerBox;
}
var init_Header = () => {};

// src/ui/components/Footer.ts
import { Text as Text2, BoxRenderable as BoxRenderable2 } from "@opentui/core";
var init_Footer = () => {};

// src/ui/components/Panel.ts
import { BoxRenderable as BoxRenderable3 } from "@opentui/core";
function Panel(renderer, props) {
  const panel = new BoxRenderable3(renderer, {
    id: props.id,
    width: props.width,
    height: props.height,
    flexGrow: props.flexGrow,
    border: props.border !== false,
    borderStyle: "single",
    borderColor: props.theme?.borderColor ?? "#475569",
    backgroundColor: props.theme?.panelBackgroundColor ?? "transparent",
    margin: props.margin || 1,
    title: props.title,
    titleAlignment: props.titleAlignment || "left"
  });
  return panel;
}
var init_Panel = () => {};

// src/ui/components/SelectMenu.ts
import { SelectRenderable, SelectRenderableEvents } from "@opentui/core";
function SelectMenu(renderer, props) {
  const select = new SelectRenderable(renderer, {
    id: props.id,
    height: props.height,
    flexGrow: props.flexGrow ?? (props.height ? undefined : 1),
    options: props.options,
    selectedIndex: props.selectedIndex ?? 0,
    backgroundColor: props.theme?.panelBackgroundColor ?? props.theme?.backgroundColor ?? "transparent",
    focusedBackgroundColor: props.theme?.panelBackgroundColor ?? props.theme?.backgroundColor ?? "transparent",
    selectedBackgroundColor: props.theme?.selectedBackgroundColor ?? "#1E3A5F",
    textColor: props.theme?.textColor ?? "#E2E8F0",
    focusedTextColor: props.theme?.textColor ?? "#E2E8F0",
    selectedTextColor: props.theme?.selectedTextColor ?? props.theme?.primaryColor ?? "#38BDF8",
    descriptionColor: props.theme?.descriptionColor ?? props.theme?.mutedTextColor ?? "#64748B",
    selectedDescriptionColor: props.theme?.selectedDescriptionColor ?? props.theme?.mutedTextColor ?? "#94A3B8",
    showScrollIndicator: true,
    wrapSelection: true,
    showDescription: props.showDescription ?? true,
    itemSpacing: props.itemSpacing
  });
  if (props.onSelect) {
    select.on(SelectRenderableEvents.ITEM_SELECTED, props.onSelect);
  }
  if (props.autoFocus !== false) {
    select.focus();
  }
  return select;
}
var init_SelectMenu = () => {};

// src/ui/components/index.ts
var init_components = __esm(() => {
  init_Header();
  init_Footer();
  init_Panel();
  init_SelectMenu();
});

// src/ui/layout.ts
import { BoxRenderable as BoxRenderable4 } from "@opentui/core";
function menuHeaderSectionOptions() {
  return {
    width: MENU_PANEL_WIDTH,
    maxWidth: MENU_PANEL_MAX_WIDTH,
    minWidth: MENU_PANEL_MIN_WIDTH,
    alignItems: "flex-start",
    justifyContent: "flex-start",
    flexShrink: 0
  };
}
function menuPanelOptions(id, theme, overrides = {}) {
  return {
    id,
    width: MENU_PANEL_WIDTH,
    maxWidth: MENU_PANEL_MAX_WIDTH,
    minWidth: MENU_PANEL_MIN_WIDTH,
    flexGrow: 1,
    maxHeight: MENU_PANEL_MAX_HEIGHT,
    minHeight: MENU_PANEL_MIN_HEIGHT,
    border: true,
    borderStyle: "single",
    borderColor: theme.borderColor ?? "#475569",
    backgroundColor: theme.panelBackgroundColor ?? "transparent",
    margin: 2,
    ...overrides
  };
}
function applyCompactMenuLayout(options) {
  const width = options.panel?.width ?? 0;
  const compact = options.force ?? (width > 0 && width < COMPACT_WIDTH_THRESHOLD);
  if (options.select && typeof options.select.showDescription !== "undefined") {
    options.select.showDescription = !compact;
  }
  if (options.panel) {
    options.panel.margin = compact ? 1 : 2;
  }
  if (options.select && typeof options.select.itemSpacing !== "undefined") {
    options.select.itemSpacing = compact ? 0 : 1;
  }
}
function wireCompactMenuLayout(panel, select) {
  const update = function() {
    applyCompactMenuLayout({ panel: this, select });
  };
  panel.onSizeChange = update;
  queueMicrotask(() => {
    try {
      applyCompactMenuLayout({ panel, select });
    } catch {}
  });
}
var MENU_PANEL_MAX_WIDTH = 96, MENU_PANEL_MIN_WIDTH = 40, MENU_PANEL_WIDTH = "85%", MENU_PANEL_MAX_HEIGHT = 20, MENU_PANEL_MIN_HEIGHT = 8, COMPACT_WIDTH_THRESHOLD = 70;
var init_layout = () => {};

// src/ui/view/MainMenuView.ts
import { BoxRenderable as BoxRenderable5 } from "@opentui/core";
function MainMenuView(renderer, viewModel, theme, onNavigate) {
  const detector = new ProjectDetection;
  const detection = detector.detectAndroidProject(process.cwd());
  const mode = detection.isAndroidProject ? "anvil" : "forge";
  const screenTitle = mode === "anvil" ? "The Anvil" : "Forge";
  const subtitle = mode === "anvil" ? "Project menu" : "Main menu";
  const menuContainer = new BoxRenderable5(renderer, {
    id: "menu-container",
    alignItems: "center",
    justifyContent: "center",
    flexGrow: 1,
    backgroundColor: theme.backgroundColor ?? "transparent"
  });
  const header = MainHeader(renderer, screenTitle, subtitle, theme);
  menuContainer.add(header);
  const selectContainer = new BoxRenderable5(renderer, menuPanelOptions("main-menu-panel", theme));
  const menuOptions = viewModel.getMenuOptions(mode);
  const selectMenu = SelectMenu(renderer, {
    id: "main-menu-select",
    options: menuOptions,
    autoFocus: true,
    theme,
    onSelect: (index, option) => {
      const view = viewModel.onMenuItemSelected(index, option);
      onNavigate(view);
    }
  });
  wireCompactMenuLayout(selectContainer, selectMenu);
  selectContainer.add(selectMenu);
  menuContainer.add(selectContainer);
  return menuContainer;
}
var init_MainMenuView = __esm(() => {
  init_components();
  init_layout();
});

// src/ui/view/DashboardView.ts
import { Text as Text3, BoxRenderable as BoxRenderable6 } from "@opentui/core";
function DashboardView(renderer, viewModel, theme) {
  const dashboardContainer = new BoxRenderable6(renderer, {
    id: "dashboard-container",
    flexDirection: "column",
    flexGrow: 1,
    backgroundColor: theme.backgroundColor ?? "transparent"
  });
  const header = Header(renderer, "\uD83C\uDFE0 Dashboard - Quick Actions", undefined, theme);
  dashboardContainer.add(header);
  const contentBox = new BoxRenderable6(renderer, {
    id: "dashboard-content",
    flexDirection: "row",
    flexGrow: 1
  });
  const leftPanel = Panel(renderer, {
    id: "projects-panel",
    title: "\uD83D\uDCC1 Recent Projects",
    flexGrow: 1,
    theme
  });
  viewModel.getRecentProjects().forEach((project) => {
    leftPanel.add(Text3({ content: `\u2022 ${project}`, margin: 1 }));
  });
  const rightPanel = Panel(renderer, {
    id: "stats-panel",
    title: "\uD83D\uDCCA Quick Stats",
    flexGrow: 1,
    theme
  });
  const stats = viewModel.getQuickStats();
  rightPanel.add(Text3({ content: `Projects: ${stats.projects}`, margin: 1 }));
  rightPanel.add(Text3({ content: `Active: ${stats.active}`, margin: 1 }));
  rightPanel.add(Text3({ content: `Completed: ${stats.completed}`, margin: 1 }));
  rightPanel.add(Text3({ content: `Templates: ${stats.templates}`, margin: 1 }));
  contentBox.add(leftPanel);
  contentBox.add(rightPanel);
  dashboardContainer.add(contentBox);
  return dashboardContainer;
}
var init_DashboardView = __esm(() => {
  init_components();
});

// src/ui/view/ProjectsView.ts
import { BoxRenderable as BoxRenderable7 } from "@opentui/core";
function ProjectsView(renderer, viewModel, theme, onNavigate, onSelectCreated, onStatusText) {
  const projectsContainer = new BoxRenderable7(renderer, {
    id: "projects-container",
    alignItems: "center",
    justifyContent: "center",
    flexGrow: 1,
    backgroundColor: theme.backgroundColor ?? "transparent"
  });
  const header = Header(renderer, "Project Ledger", "Projects", theme);
  projectsContainer.add(header);
  const selectContainer = new BoxRenderable7(renderer, menuPanelOptions("projects-panel", theme));
  const selectMenu = SelectMenu(renderer, {
    id: "projects-select",
    options: viewModel.getAllMenuOptions(),
    autoFocus: true,
    theme,
    selectedIndex: viewModel.getInitialSelectedIndex(),
    onSelect: (index, option) => {
      const action = viewModel.onMenuItemSelected(index, option);
      if (onNavigate) {
        onNavigate(action);
      }
    }
  });
  wireCompactMenuLayout(selectContainer, selectMenu);
  onSelectCreated?.(selectMenu);
  function refreshMenu() {
    selectMenu.options = viewModel.getAllMenuOptions();
    selectMenu.setSelectedIndex(viewModel.getInitialSelectedIndex());
    onStatusText?.(viewModel.getFooterText());
    selectMenu.focus();
  }
  viewModel.setMenuUpdateCallback(refreshMenu);
  selectContainer.add(selectMenu);
  projectsContainer.add(selectContainer);
  onStatusText?.(viewModel.getFooterText());
  return projectsContainer;
}
var init_ProjectsView = __esm(() => {
  init_components();
  init_layout();
});

// src/ui/view/ToolsView.ts
import { Text as Text4, BoxRenderable as BoxRenderable8 } from "@opentui/core";
function ToolsView(renderer, viewModel, theme) {
  const toolsContainer = new BoxRenderable8(renderer, {
    id: "tools-container",
    flexDirection: "column",
    flexGrow: 1,
    backgroundColor: theme.backgroundColor ?? "transparent"
  });
  const header = Header(renderer, "\uD83D\uDD27 Tools - Development Utilities", undefined, theme);
  toolsContainer.add(header);
  const contentBox = new BoxRenderable8(renderer, {
    id: "tools-content",
    flexDirection: "row",
    flexGrow: 1
  });
  const leftPanel = Panel(renderer, {
    id: "tools-categories",
    title: "Code Generators",
    flexGrow: 1,
    theme
  });
  viewModel.getCodeGenerators().forEach((generator) => {
    leftPanel.add(Text4({ content: `\u2022 ${generator}`, margin: 1 }));
  });
  const rightPanel = Panel(renderer, {
    id: "tools-utilities",
    title: "Utilities",
    flexGrow: 1,
    theme
  });
  viewModel.getUtilities().forEach((utility) => {
    rightPanel.add(Text4({ content: `\u2022 ${utility}`, margin: 1 }));
  });
  contentBox.add(leftPanel);
  contentBox.add(rightPanel);
  toolsContainer.add(contentBox);
  return toolsContainer;
}
var init_ToolsView = __esm(() => {
  init_components();
});

// src/ui/view/ThemePickerView.ts
import { BoxRenderable as BoxRenderable9 } from "@opentui/core";
function ThemePickerView(renderer, viewModel, theme, onBack, onSelectCreated) {
  const container = new BoxRenderable9(renderer, {
    id: "theme-picker-container",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    flexGrow: 1,
    backgroundColor: theme.backgroundColor ?? "transparent"
  });
  const headerSection = new BoxRenderable9(renderer, menuHeaderSectionOptions());
  const modePref = viewModel.getThemeModePreference();
  const effectiveMode = viewModel.getEffectiveThemeMode();
  headerSection.add(Header(renderer, "Themes", `Mode: ${modePref} (${effectiveMode}) \u2022 Current: ${viewModel.getSelectedThemeId()}`, theme));
  container.add(headerSection);
  const panel = new BoxRenderable9(renderer, menuPanelOptions("theme-menu-panel", theme));
  const themes = viewModel.listThemes();
  const selectedId = viewModel.getSelectedThemeId();
  const options = themes.map((entry) => ({
    name: entry.displayName,
    description: `${entry.id} (${entry.source})`,
    value: entry.id
  }));
  const initialIndex = Math.max(0, options.findIndex((opt) => opt.value === selectedId));
  const selectMenu = SelectMenu(renderer, {
    id: "theme-select",
    options,
    selectedIndex: initialIndex,
    theme,
    autoFocus: true,
    onSelect: (_idx, option) => {
      const themeId = typeof option.value === "string" ? option.value : "";
      viewModel.selectTheme(themeId);
    }
  });
  wireCompactMenuLayout(panel, selectMenu);
  panel.add(selectMenu);
  container.add(panel);
  onSelectCreated?.(selectMenu);
  return container;
}
var init_ThemePickerView = __esm(() => {
  init_layout();
  init_components();
});

// src/ui/view/SettingsView.ts
function SettingsView(renderer, viewModel, theme, onBack) {
  return ThemePickerView(renderer, viewModel, theme, onBack);
}
var init_SettingsView = __esm(() => {
  init_ThemePickerView();
});

// src/ui/view/AboutView.ts
import { Text as Text5, BoxRenderable as BoxRenderable10, ASCIIFont as ASCIIFont2 } from "@opentui/core";
function AboutView(renderer, viewModel, theme) {
  const aboutContainer = new BoxRenderable10(renderer, {
    id: "about-container",
    flexDirection: "column",
    flexGrow: 1,
    backgroundColor: theme.backgroundColor ?? "transparent"
  });
  const header = Header(renderer, "Maker\u2019s Mark", undefined, theme);
  aboutContainer.add(header);
  const contentBox = new BoxRenderable10(renderer, {
    id: "about-content",
    alignItems: "center",
    justifyContent: "center",
    flexGrow: 1
  });
  const infoBox = new BoxRenderable10(renderer, {
    id: "info-box",
    flexDirection: "column",
    alignItems: "center",
    maxWidth: 60
  });
  const info = viewModel.getAppInfo();
  infoBox.add(ASCIIFont2({ font: "tiny", text: info.name, color: theme.primaryColor ?? theme.textColor, backgroundColor: theme.backgroundColor ?? "transparent", selectable: false }));
  infoBox.add(Text5({ content: `Version ${info.version}`, fg: theme.textColor, margin: 1 }));
  infoBox.add(Text5({ content: info.description, fg: theme.textColor, margin: 1 }));
  infoBox.add(Text5({ content: "", margin: 1 }));
  infoBox.add(Text5({ content: info.builtWith, fg: theme.textColor, margin: 1 }));
  infoBox.add(Text5({ content: info.tagline, fg: theme.textColor, margin: 1 }));
  infoBox.add(Text5({ content: "", margin: 1 }));
  infoBox.add(Text5({ content: "Features:", fg: theme.textColor, attributes: 1, margin: 1 }));
  viewModel.getFeatures().forEach((feature) => {
    infoBox.add(Text5({ content: `\u2022 ${feature}`, fg: theme.textColor, margin: 1 }));
  });
  contentBox.add(infoBox);
  aboutContainer.add(contentBox);
  return aboutContainer;
}
var init_AboutView = __esm(() => {
  init_components();
});

// src/ui/view/ActionsView.ts
import { BoxRenderable as BoxRenderable11, Text as Text6, TextAttributes as TextAttributes4 } from "@opentui/core";
function ActionsView(renderer, viewModel, theme, onNavigate) {
  const container = new BoxRenderable11(renderer, {
    id: "actions-container",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    flexGrow: 1,
    backgroundColor: theme.backgroundColor ?? "transparent"
  });
  const headerSection = new BoxRenderable11(renderer, menuHeaderSectionOptions());
  headerSection.add(Header(renderer, "Actions", "Commands", theme));
  container.add(headerSection);
  const menuPanel = new BoxRenderable11(renderer, menuPanelOptions("actions-panel", theme));
  const selectMenu = SelectMenu(renderer, {
    id: "actions-select",
    options: viewModel.getMenuOptions(),
    autoFocus: true,
    theme,
    onSelect: (_index, option) => {
      const value = typeof option.value === "string" ? option.value : "";
      const result = viewModel.handleMenuSelection(value);
      if (result.action === "navigate" && onNavigate) {
        onNavigate(`actionoutputview:${result.command}`);
      }
    }
  });
  wireCompactMenuLayout(menuPanel, selectMenu);
  function updateInlineMessage() {
    const message = viewModel.inlineMessage;
    headerSection.remove("actions-message");
    if (!message)
      return;
    headerSection.add(Text6({
      id: "actions-message",
      content: message,
      fg: theme.mutedTextColor ?? theme.textColor,
      attributes: TextAttributes4.DIM,
      margin: 1
    }));
  }
  function refreshMenu() {
    selectMenu.options = viewModel.getMenuOptions();
    updateInlineMessage();
  }
  viewModel.setMenuUpdateCallback(refreshMenu);
  const menuSection = new BoxRenderable11(renderer, {
    alignItems: "center",
    justifyContent: "center"
  });
  menuPanel.add(selectMenu);
  menuSection.add(menuPanel);
  container.add(menuSection);
  refreshMenu();
  return container;
}
var init_ActionsView = __esm(() => {
  init_components();
  init_layout();
});

// src/ui/view/GradleView.ts
import { BoxRenderable as BoxRenderable12, Text as Text7, TextAttributes as TextAttributes5 } from "@opentui/core";
function GradleView(renderer, viewModel, theme, onNavigate, titles = { headerTitle: "Gradle Tasks", panelTitle: "Gradle" }) {
  const container = new BoxRenderable12(renderer, {
    id: "gradle-container",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    flexGrow: 1,
    backgroundColor: theme.backgroundColor ?? "transparent"
  });
  const headerSection = new BoxRenderable12(renderer, menuHeaderSectionOptions());
  headerSection.add(Header(renderer, titles.headerTitle, titles.panelTitle, theme));
  container.add(headerSection);
  const menuPanel = new BoxRenderable12(renderer, menuPanelOptions("gradle-menu-panel", theme));
  const selectMenu = SelectMenu(renderer, {
    id: "gradle-select",
    options: viewModel.getMenuOptions(),
    autoFocus: true,
    theme,
    onSelect: (_index, option) => {
      const value = typeof option.value === "string" ? option.value : "";
      const result = viewModel.handleMenuSelection(value);
      if (result.action === "navigate" && onNavigate) {
        onNavigate(`actionoutputview:${result.command}`);
      }
    }
  });
  wireCompactMenuLayout(menuPanel, selectMenu);
  function updateInlineMessage() {
    const message = viewModel.inlineMessage;
    headerSection.remove("gradle-message");
    if (!message)
      return;
    headerSection.add(Text7({
      id: "gradle-message",
      content: message,
      fg: theme.mutedTextColor ?? theme.textColor,
      attributes: TextAttributes5.DIM,
      margin: 1
    }));
  }
  function refreshMenu() {
    selectMenu.options = viewModel.getMenuOptions();
    updateInlineMessage();
  }
  viewModel.setMenuUpdateCallback(refreshMenu);
  const menuSection = new BoxRenderable12(renderer, {
    alignItems: "center",
    justifyContent: "center"
  });
  menuPanel.add(selectMenu);
  menuSection.add(menuPanel);
  container.add(menuSection);
  refreshMenu();
  return container;
}
var init_GradleView = __esm(() => {
  init_components();
  init_layout();
});

// src/ui/view/ActionOutputView.ts
import { BoxRenderable as BoxRenderable13, Text as Text8, TextAttributes as TextAttributes6 } from "@opentui/core";
function stripAnsi(text) {
  return text.replace(/\u001b\[[0-9;?]*[@-~]/g, "").replace(/\u001b\][^\u0007]*(\u0007|\u001b\\)/g, "");
}
function ActionOutputView(renderer, viewModel, command, theme, ansiPalette, setStatusText, onBack) {
  const container = new BoxRenderable13(renderer, {
    id: "action-output-container",
    flexDirection: "column",
    flexGrow: 1,
    backgroundColor: theme.backgroundColor ?? "transparent"
  });
  const executionHeader = Text8({
    id: "execution-header",
    content: `Executing: ${command}`,
    fg: theme.mutedTextColor ?? theme.textColor,
    attributes: TextAttributes6.DIM,
    margin: 1,
    wrapMode: "word"
  });
  const outputPanel = new BoxRenderable13(renderer, {
    id: "output-panel",
    flexGrow: 1,
    border: true,
    borderStyle: "single",
    borderColor: theme.borderColor ?? "#475569",
    backgroundColor: theme.panelBackgroundColor ?? "transparent",
    margin: 1,
    onSizeChange: function() {
      viewModel.setOutputWindowSize(Math.max(1, this.height - 2));
    }
  });
  let outputText = Text8({
    id: "output-text",
    content: "",
    attributes: TextAttributes6.NONE,
    fg: theme.textColor,
    flexGrow: 1,
    wrapMode: "char"
  });
  outputPanel.add(outputText);
  container.add(executionHeader);
  container.add(outputPanel);
  function getVisibleLineCount() {
    return Math.max(1, outputPanel.height - 2);
  }
  let liveRequested = false;
  const ensureLive = () => {
    if (liveRequested)
      return;
    if (typeof renderer.requestLive === "function") {
      renderer.requestLive();
    }
    liveRequested = true;
  };
  const dropLive = () => {
    if (!liveRequested)
      return;
    if (typeof renderer.dropLive === "function") {
      renderer.dropLive();
    }
    liveRequested = false;
  };
  function updateOutput() {
    const output2 = viewModel.output;
    const visibleLineCount = getVisibleLineCount();
    if (viewModel.state === "running") {
      ensureLive();
    } else {
      dropLive();
    }
    viewModel.setOutputWindowSize(visibleLineCount);
    const visibleLines = output2.lines.slice(output2.scrollOffset, output2.scrollOffset + visibleLineCount);
    outputText = Text8({
      id: "output-text",
      content: ansiToStyledText(visibleLines.join(`
`), { palette: ansiPalette }),
      attributes: TextAttributes6.NONE,
      fg: theme.textColor,
      flexGrow: 1,
      wrapMode: "char"
    });
    outputPanel.remove("output-text");
    outputPanel.add(outputText);
    const stateIcons = {
      idle: "\u23F8",
      running: "\u23F3",
      completed: "\u2705",
      error: "\u274C"
    };
    const stateIcon = stateIcons[viewModel.state];
    const exitInfo = output2.exitCode !== null ? ` (exit: ${output2.exitCode})` : "";
    const scrollInfo = `[${output2.scrollOffset + 1}-${Math.min(output2.scrollOffset + visibleLineCount, output2.lines.length)}/${output2.lines.length}]`;
    setStatusText?.(`${stateIcon} ${viewModel.state}${exitInfo} ${scrollInfo} \u2022 j/k: scroll \u2022 c: copy \u2022 ESC: cancel/back`);
  }
  viewModel.setOutputUpdateCallback(updateOutput);
  const keyHandler = (key) => {
    switch (key.name) {
      case "j":
      case "down":
        if (viewModel.state !== "idle") {
          viewModel.scrollDown();
        }
        break;
      case "k":
      case "up":
        if (viewModel.state !== "idle") {
          viewModel.scrollUp();
        }
        break;
      case "c":
        if (viewModel.state === "completed" || viewModel.state === "error") {
          const text = stripAnsi(viewModel.getOutputText());
          try {
            Bun.spawn(["pbcopy"], {
              stdin: new Response(text).body
            });
            setStatusText?.("\uD83D\uDCCB Copied to clipboard!");
            setTimeout(updateOutput, 1500);
          } catch {}
        }
        break;
      case "escape":
        if (viewModel.state === "running") {
          viewModel.cancelTask();
        } else if (viewModel.state === "completed" || viewModel.state === "error") {
          viewModel.reset();
          if (onBack)
            onBack();
        }
        break;
    }
  };
  renderer.keyInput.on("keypress", keyHandler);
  container.__dispose = () => {
    dropLive();
    if (typeof renderer.keyInput.off === "function") {
      renderer.keyInput.off("keypress", keyHandler);
    } else if (typeof renderer.keyInput.removeListener === "function") {
      renderer.keyInput.removeListener("keypress", keyHandler);
    }
    viewModel.setOutputUpdateCallback(() => {
      return;
    });
  };
  ensureLive();
  setStatusText?.(`\u23F3 starting \u2022 j/k: scroll \u2022 c: copy \u2022 ESC: cancel/back`);
  viewModel.setOutputWindowSize(getVisibleLineCount());
  viewModel.runGradleCommand(command);
  return container;
}
var init_ActionOutputView = __esm(() => {
  init_utilities();
});

// src/ui/view/ComingSoonView.ts
import { BoxRenderable as BoxRenderable14, Text as Text9, TextAttributes as TextAttributes7 } from "@opentui/core";
function ComingSoonView(renderer, theme, title, description) {
  const container = new BoxRenderable14(renderer, {
    id: "coming-soon-container",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
    flexGrow: 1,
    backgroundColor: theme.backgroundColor ?? "transparent"
  });
  container.add(MainHeader(renderer, title, "Coming soon", theme));
  const body = new BoxRenderable14(renderer, {
    id: "coming-soon-body",
    width: MENU_PANEL_WIDTH,
    maxWidth: MENU_PANEL_MAX_WIDTH,
    minWidth: MENU_PANEL_MIN_WIDTH,
    flexGrow: 0,
    border: true,
    borderStyle: "single",
    borderColor: theme.borderColor ?? "#475569",
    backgroundColor: theme.panelBackgroundColor ?? "transparent",
    padding: 1,
    margin: 2
  });
  body.add(Text9({
    id: "coming-soon-description",
    content: description,
    attributes: TextAttributes7.NONE,
    fg: theme.textColor,
    wrapMode: "word"
  }));
  container.add(body);
  return container;
}
var init_ComingSoonView = __esm(() => {
  init_components();
  init_layout();
});

// src/ui/view/index.ts
var init_view = __esm(() => {
  init_MainMenuView();
  init_DashboardView();
  init_ProjectsView();
  init_ToolsView();
  init_SettingsView();
  init_AboutView();
  init_ActionsView();
  init_GradleView();
  init_ActionOutputView();
  init_ComingSoonView();
  init_ThemePickerView();
});

// src/index.ts
var exports_src = {};
import { createCliRenderer, Text as Text10, BoxRenderable as BoxRenderable15, TextAttributes as TextAttributes8 } from "@opentui/core";
import path8 from "path";
async function rememberCurrentAndroidProject() {
  const detection = projectDetection.detectAndroidProject(process.cwd());
  if (!detection.isAndroidProject || !detection.projectRoot)
    return;
  const root = normalizeProjectPath(detection.projectRoot);
  const projectRepo = diContainer.get("ProjectRepository");
  const projectId = projectIdFromPath(root);
  const now = new Date;
  const existing = await projectRepo.getProjectById(projectId);
  const createdAt = existing?.createdAt ?? now;
  await projectRepo.saveProject({
    id: projectId,
    name: getAndroidProjectName(root),
    path: root,
    status: "active",
    description: existing?.description,
    createdAt,
    updatedAt: now
  });
}
function setStatusLineText(content, theme) {
  const background = theme?.panelBackgroundColor ?? theme?.footerBackgroundColor ?? theme?.backgroundColor ?? "#111827";
  const textColor = theme?.textColor ?? theme?.footerTextColor ?? "#E5E7EB";
  statusLine.backgroundColor = background === "transparent" ? "#111827" : background;
  const resolvedFg = textColor === "transparent" ? "#E5E7EB" : textColor === statusLine.backgroundColor ? theme?.accentColor ?? theme?.primaryColor ?? "#FFFFFF" : textColor;
  statusLine.remove("status-line-text");
  statusLine.add(Text10({
    id: "status-line-text",
    content,
    fg: resolvedFg,
    attributes: TextAttributes8.BOLD,
    wrapMode: "char"
  }));
}
function statusTextForView(view) {
  if (view.startsWith("actionoutputview:")) {
    return "j/k: scroll \u2022 c: copy \u2022 ESC: cancel/back";
  }
  switch (view) {
    case "menu":
      return "\u2191\u2193: navigate \u2022 ENTER: select \u2022 CTRL+C: quit";
    case "projects": {
      const vm = diContainer.get("ProjectsViewModel");
      return vm.getFooterText?.() ?? "ESC: back";
    }
    case "settings":
      return "ESC: back \u2022 M: mode \u2022 D/L: set dark/light \u2022 R: reload";
    case "about":
      return "ESC: back \u2022 T: themes";
    case "dashboard":
      return "ESC: back \u2022 TAB: navigate \u2022 ENTER: select";
    case "tools":
      return "ESC: back";
    case "actions":
    case "hammer-list":
    case "blueprints":
      return "\u2191\u2193: navigate \u2022 ENTER: select \u2022 ESC: back";
    default:
      return "ESC: back";
  }
}
function renderCurrentView() {
  clearCurrentView(renderer, currentViewElements, currentSelectElement);
  currentSelectElement = null;
  const currentView = navigation.getCurrentView();
  const theme = themeManager.getTheme();
  const ansiPalette = themeManager.getAnsiPaletteMap();
  setStatusLineText(statusTextForView(currentView), theme);
  if (currentView.startsWith("actionoutputview:")) {
    const prefix = "actionoutputview:";
    const command = currentView.slice(prefix.length);
    const viewModel = diContainer.get("ActionsViewModel");
    const view = ActionOutputView(renderer, viewModel, command, theme, ansiPalette, (text) => {
      setStatusLineText(text, themeManager.getTheme());
    }, () => {
      navigation.goBack();
      renderCurrentView();
    });
    contentHost.add(view);
    currentViewElements.push(view);
    return;
  }
  switch (currentView) {
    case "menu": {
      const viewModel = diContainer.get("MainMenuViewModel");
      const view = MainMenuView(renderer, viewModel, theme, (nextView) => {
        navigation.navigateTo(nextView);
        renderCurrentView();
      });
      contentHost.add(view);
      currentViewElements.push(view);
      break;
    }
    case "dashboard": {
      const viewModel = diContainer.get("DashboardViewModel");
      const view = DashboardView(renderer, viewModel, theme);
      contentHost.add(view);
      currentViewElements.push(view);
      break;
    }
    case "projects": {
      const viewModel = diContainer.get("ProjectsViewModel");
      const view = ProjectsView(renderer, viewModel, theme, (action) => {
        if (action === "noop")
          return;
        if (action.startsWith("open-project-")) {
          const id = action.slice("open-project-".length);
          (async () => {
            try {
              const projectRepo = diContainer.get("ProjectRepository");
              const project = await projectRepo.getProjectById(id);
              if (!project?.path)
                return;
              process.chdir(project.path);
              await projectRepo.saveProject({
                ...project,
                updatedAt: new Date
              });
              navigation.navigateTo("actions");
              renderCurrentView();
            } catch (error) {
              console.error("Failed to open project:", error);
            }
          })();
          return;
        }
        if (action.startsWith("confirm-remove:")) {
          viewModel.confirmRemove();
          return;
        }
        if (action === "cancel-remove") {
          viewModel.cancelRemove();
          return;
        }
      }, (select) => {
        currentSelectElement = select;
      }, (text) => {
        setStatusLineText(text, themeManager.getTheme());
      });
      contentHost.add(view);
      currentViewElements.push(view);
      break;
    }
    case "tools": {
      const viewModel = diContainer.get("ToolsViewModel");
      const view = ToolsView(renderer, viewModel, theme);
      contentHost.add(view);
      currentViewElements.push(view);
      break;
    }
    case "actions": {
      const viewModel = diContainer.get("ActionsViewModel");
      const view = ActionsView(renderer, viewModel, theme, (action) => {
        if (action === "back") {
          navigation.navigateTo("menu");
        } else {
          navigation.navigateTo(action);
        }
        renderCurrentView();
      });
      contentHost.add(view);
      currentViewElements.push(view);
      break;
    }
    case "settings": {
      const viewModel = diContainer.get("SettingsViewModel");
      const view = SettingsView(renderer, viewModel, theme, () => {
        navigation.goBack();
        renderCurrentView();
      });
      contentHost.add(view);
      currentViewElements.push(view);
      break;
    }
    case "about": {
      const viewModel = diContainer.get("AboutViewModel");
      const view = AboutView(renderer, viewModel, theme);
      contentHost.add(view);
      currentViewElements.push(view);
      break;
    }
    case "hammer-list": {
      const viewModel = diContainer.get("HammerListViewModel");
      const view = GradleView(renderer, viewModel, theme, (action) => {
        navigation.navigateTo(action);
        renderCurrentView();
      }, { headerTitle: "Hammer List", panelTitle: "Pinned Gradle Tasks" });
      contentHost.add(view);
      currentViewElements.push(view);
      break;
    }
    case "blueprints": {
      const viewModel = diContainer.get("BlueprintsViewModel");
      const view = GradleView(renderer, viewModel, theme, (action) => {
        navigation.navigateTo(action);
        renderCurrentView();
      }, { headerTitle: "Blueprints", panelTitle: "All Gradle Tasks" });
      contentHost.add(view);
      currentViewElements.push(view);
      break;
    }
    case "devices": {
      const view = ComingSoonView(renderer, theme, "Smithy", "Device and emulator management is coming soon.");
      contentHost.add(view);
      currentViewElements.push(view);
      break;
    }
    case "adb": {
      const view = ComingSoonView(renderer, theme, "Command Tongs", "ADB shortcuts are coming soon.");
      contentHost.add(view);
      currentViewElements.push(view);
      break;
    }
    case "kiln-view": {
      const view = ComingSoonView(renderer, theme, "Kiln View", "App-focused Logcat is coming soon.");
      contentHost.add(view);
      currentViewElements.push(view);
      break;
    }
    case "foundry-logs": {
      const view = ComingSoonView(renderer, theme, "Foundry Logs", "Full device Logcat browsing is coming soon.");
      contentHost.add(view);
      currentViewElements.push(view);
      break;
    }
    case "looking-glass": {
      const view = ComingSoonView(renderer, theme, "Looking Glass", "Device mirroring is coming soon.");
      contentHost.add(view);
      currentViewElements.push(view);
      break;
    }
    default: {
      const view = ComingSoonView(renderer, theme, "Coming soon", `No UI exists yet for: ${currentView}`);
      contentHost.add(view);
      currentViewElements.push(view);
      break;
    }
  }
}
var targetDir, projectDetection, detectedRoot, themeManager, renderer, navigation, currentViewElements, currentSelectElement = null, appShell, contentHost, statusLine;
var init_src = __esm(async () => {
  init_bootstrap();
  init_di();
  init_utilities();
  init_view();
  targetDir = process.argv[2];
  if (targetDir) {
    const resolvedPath = path8.resolve(targetDir);
    process.chdir(resolvedPath);
  }
  projectDetection = new ProjectDetection;
  detectedRoot = projectDetection.findAndroidProjectRoot(process.cwd());
  if (detectedRoot) {
    process.chdir(detectedRoot);
  }
  await bootstrap();
  await setupDIModules();
  themeManager = diContainer.get("ThemeManager");
  await themeManager.reloadThemes();
  themeManager.onThemeChange?.(() => {
    renderCurrentView();
  });
  await rememberCurrentAndroidProject();
  renderer = await createCliRenderer({ exitOnCtrlC: true });
  navigation = new NavigationManager;
  currentViewElements = [];
  appShell = new BoxRenderable15(renderer, {
    id: "app-shell",
    flexDirection: "column",
    flexGrow: 1,
    width: "100%",
    height: "100%",
    alignItems: "stretch",
    justifyContent: "flex-start"
  });
  contentHost = new BoxRenderable15(renderer, {
    id: "content-host",
    flexDirection: "column",
    flexGrow: 1,
    width: "100%",
    alignItems: "stretch",
    justifyContent: "flex-start"
  });
  statusLine = new BoxRenderable15(renderer, {
    id: "status-line",
    height: 1,
    width: "100%",
    alignSelf: "stretch",
    justifyContent: "flex-start",
    alignItems: "flex-start",
    paddingLeft: 1
  });
  appShell.add(contentHost);
  appShell.add(statusLine);
  renderer.root.add(appShell);
  renderer.keyInput.on("keypress", (key) => {
    const currentView = navigation.getCurrentView();
    const keyName = (key.name || "").toLowerCase();
    if (currentView.startsWith("actionoutputview:")) {
      return;
    }
    if (currentView === "about" && keyName === "t") {
      navigation.navigateTo("settings");
      renderCurrentView();
      return;
    }
    if (currentView === "settings") {
      const settingsViewModel = diContainer.get("SettingsViewModel");
      if (keyName === "r") {
        settingsViewModel.reloadThemes().then(renderCurrentView);
        return;
      }
      if (keyName === "m") {
        const current = themeManager.getThemeModePreference();
        const next = current === "dark" ? "light" : current === "light" ? "system" : "dark";
        settingsViewModel.setThemeModePreference(next).then(renderCurrentView);
        return;
      }
      if (keyName === "d") {
        settingsViewModel.selectThemeForMode(themeManager.getThemeId(), "dark").then(renderCurrentView);
        return;
      }
      if (keyName === "l") {
        settingsViewModel.selectThemeForMode(themeManager.getThemeId(), "light").then(renderCurrentView);
        return;
      }
    }
    if (key.name === "escape") {
      if (currentView === "projects") {
        const projectsViewModel = diContainer.get("ProjectsViewModel");
        if (projectsViewModel.isConfirmingRemoval()) {
          projectsViewModel.cancelRemove();
          return;
        }
      }
      if (currentView !== "menu") {
        navigation.goBack();
        renderCurrentView();
      }
      return;
    }
    if (currentView === "projects") {
      const projectsViewModel = diContainer.get("ProjectsViewModel");
      if (projectsViewModel.isConfirmingRemoval()) {
        if (keyName === "y") {
          projectsViewModel.confirmRemove();
        }
        if (keyName === "n") {
          projectsViewModel.cancelRemove();
        }
        return;
      }
      if (keyName === "r") {
        const select = currentSelectElement;
        const selectedOption = select?.getSelectedOption?.();
        const selectedValue = typeof selectedOption?.value === "string" ? selectedOption.value : "";
        if (selectedValue.startsWith("open-project-")) {
          const id = selectedValue.slice("open-project-".length);
          const selectedIndex = select?.getSelectedIndex?.() ?? 0;
          projectsViewModel.requestRemoveProjectById(id, selectedIndex);
        }
      }
    }
  });
  renderCurrentView();
});

// src/commands/update.ts
import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";
var REPO = "peytonmscott/droidforge";
function buildGitHubHeaders() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  return {
    accept: "application/vnd.github+json",
    "user-agent": "droidforge",
    ...token ? { authorization: `Bearer ${token}` } : {}
  };
}
function isAbortError(error) {
  return Boolean(error) && typeof error === "object" && error.name === "AbortError";
}
async function fetchJsonWithRetry(url, timeoutMs = 8000, retries = 2) {
  let lastErr;
  for (let attempt = 0;attempt <= retries; attempt++) {
    const controller = new AbortController;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        headers: buildGitHubHeaders(),
        signal: controller.signal
      });
      if (!response.ok) {
        const message = `GitHub API request failed: ${response.status} ${response.statusText}`;
        throw Object.assign(new Error(message), { status: response.status });
      }
      return await response.json();
    } catch (err) {
      if (isAbortError(err)) {
        throw new Error(`Request timed out after ${timeoutMs}ms`);
      }
      lastErr = err;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
        continue;
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}
async function getLatestRef() {
  try {
    const payload = await fetchJsonWithRetry(`https://api.github.com/repos/${REPO}/releases/latest`);
    const tag = String(payload?.tag_name ?? "").trim();
    if (!tag)
      throw new Error("Latest release response missing tag_name");
    return { ref: tag, source: "release" };
  } catch (error) {
    const status = Number(error?.status ?? 0);
    if (status !== 404)
      throw error;
  }
  try {
    const tags = await fetchJsonWithRetry(`https://api.github.com/repos/${REPO}/tags?per_page=1`);
    const tag = String(tags?.[0]?.name ?? "").trim();
    if (tag)
      return { ref: tag, source: "tag" };
  } catch {}
  return { ref: "main", source: "default" };
}
async function confirmUpdate(command) {
  const rl = readline.createInterface({ input, output });
  try {
    const answer = (await rl.question(`${command}
Proceed? [y/N] `)).trim().toLowerCase();
    return answer === "y" || answer === "yes";
  } finally {
    rl.close();
  }
}
async function runCommand(command, args) {
  const proc = Bun.spawn([command, ...args], {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit"
  });
  return await proc.exited;
}
async function runUpdate(args) {
  const checkOnly = args.includes("--check");
  const autoYes = args.includes("--yes") || args.includes("-y");
  const latest = await getLatestRef();
  const spec = `github:${REPO}#${latest.ref}`;
  if (checkOnly) {
    console.log(latest.ref);
    return;
  }
  const hasBun = Boolean(Bun.which("bun"));
  const hasNpm = Boolean(Bun.which("npm"));
  if (!hasBun && !hasNpm) {
    throw new Error("Neither bun nor npm is available on PATH.");
  }
  if (hasBun) {
    const uninstallCommand = "bun remove -g droidforge";
    const installCommand = `bun add -g ${spec}`;
    if (!autoYes) {
      const confirmed = await confirmUpdate(`${uninstallCommand}
${installCommand}`);
      if (!confirmed) {
        console.log("Cancelled.");
        return;
      }
    } else {
      console.log(uninstallCommand);
      console.log(installCommand);
    }
    await runCommand("bun", ["remove", "-g", "droidforge"]);
    const exitCode2 = await runCommand("bun", ["add", "-g", spec]);
    if (exitCode2 !== 0) {
      throw new Error(`Update command failed with exit code ${exitCode2}`);
    }
    console.log(`Updated to ${latest.ref}. Restart droidforge.`);
    return;
  }
  const npmCommand = `npm i -g ${spec}`;
  if (!autoYes) {
    const confirmed = await confirmUpdate(npmCommand);
    if (!confirmed) {
      console.log("Cancelled.");
      return;
    }
  } else {
    console.log(npmCommand);
  }
  const exitCode = await runCommand("npm", ["i", "-g", spec]);
  if (exitCode !== 0) {
    throw new Error(`Update command failed with exit code ${exitCode}`);
  }
  console.log(`Updated to ${latest.ref}. Restart droidforge.`);
}

// src/cli.ts
var [command, ...rest] = process.argv.slice(2);
if (command === "update") {
  try {
    await runUpdate(rest);
  } catch (error) {
    console.error("Update failed:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
} else {
  await init_src().then(() => exports_src);
}
