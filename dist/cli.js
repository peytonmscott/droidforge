#!/usr/bin/env bun
// @bun
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __moduleCache = /* @__PURE__ */ new WeakMap;
var __toCommonJS = (from) => {
  var entry = __moduleCache.get(from), desc;
  if (entry)
    return entry;
  entry = __defProp({}, "__esModule", { value: true });
  if (from && typeof from === "object" || typeof from === "function")
    __getOwnPropNames(from).map((key) => !__hasOwnProp.call(entry, key) && __defProp(entry, key, {
      get: () => from[key],
      enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
    }));
  __moduleCache.set(from, entry);
  return entry;
};
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
      themeMode: "dark",
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
    this.db.serialize(() => {
      this.db.all("PRAGMA table_info(projects)", (err, rows) => {
        if (err)
          return;
        const hasPath = Array.isArray(rows) && rows.some((row) => row?.name === "path");
        if (!hasPath) {
          this.db.run("ALTER TABLE projects ADD COLUMN path TEXT");
        }
        this.db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_path ON projects(path) WHERE path IS NOT NULL");
      });
    });
    this.db.run(`
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY DEFAULT 1,
                theme TEXT,
                preferences TEXT
            )
        `);
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
      const sql = `
                INSERT OR REPLACE INTO projects (id, name, path, status, description, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
      const params = [
        project.id,
        project.name,
        project.path,
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

// src/ui/theme/Theme.ts
class ThemeManager {
  currentTheme;
  constructor() {
    this.currentTheme = this.getDefaultTheme();
    this.loadTheme();
  }
  getDefaultTheme() {
    return {
      primaryColor: "#3b82f6",
      secondaryColor: "#1e40af",
      backgroundColor: "transparent",
      textColor: "#E2E8F0",
      borderColor: "#475569"
    };
  }
  async loadTheme() {
    try {
      const config = await ensureConfigFileExists();
      this.currentTheme = config.theme;
    } catch {
      console.warn("Failed to load theme, using defaults");
    }
  }
  getCurrentTheme() {
    return { ...this.currentTheme };
  }
  async updateTheme(newTheme) {
    this.currentTheme = { ...this.currentTheme, ...newTheme };
    try {
      await updateConfig({ theme: this.currentTheme });
    } catch {
      console.warn("Failed to save theme");
    }
  }
  getDarkTheme() {
    return {
      primaryColor: "#3b82f6",
      secondaryColor: "#1e40af",
      backgroundColor: "transparent",
      textColor: "#E2E8F0",
      borderColor: "#475569"
    };
  }
  getLightTheme() {
    return {
      primaryColor: "#2563eb",
      secondaryColor: "#1d4ed8",
      backgroundColor: "#ffffff",
      textColor: "#1f2937",
      borderColor: "#d1d5db"
    };
  }
}
var init_Theme = __esm(() => {
  init_config();
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
  menuOptions = [
    {
      name: "Actions",
      description: "will write something creative later",
      value: "actions"
    },
    {
      name: "Projects",
      description: "Manage and create new projects with interactive tools",
      value: "projects"
    },
    {
      name: "Gradle",
      description: "Development utilities and code generators",
      value: "tools"
    },
    {
      name: "Settings",
      description: "Configure application preferences and options",
      value: "settings"
    },
    {
      name: "About",
      description: "Learn about Droid Forge and get help",
      value: "about"
    }
  ];
  getMenuOptions() {
    return [...this.menuOptions];
  }
  onMenuItemSelected(index, option) {
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
  getPreferences() {
    return {
      theme: "Dark Mode",
      language: "English",
      autoSave: "Enabled",
      notifications: "On"
    };
  }
  getAdvancedOptions() {
    return {
      cache: "Clear cache",
      data: "Export settings",
      debug: "Enable logging",
      reset: "Factory defaults"
    };
  }
  getCurrentTheme() {
    return this.themeManager.getCurrentTheme();
  }
  async switchToDarkTheme() {
    await this.themeManager.updateTheme(this.themeManager.getDarkTheme());
  }
  async switchToLightTheme() {
    await this.themeManager.updateTheme(this.themeManager.getLightTheme());
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

// src/viewmodels/ActionsViewModel.ts
import fs4 from "fs";
var SHOW_ALL_TASKS_VALUE = "__show-all-tasks__", SHOW_CURATED_TASKS_VALUE = "__show-curated-tasks__", RETRY_TASK_DISCOVERY_VALUE = "__retry-task-discovery__", NO_GRADLE_VALUE = "__no-gradle__", CURATED_TASKS, CURATED_TASK_LABELS, ActionsViewModel;
var init_ActionsViewModel = __esm(() => {
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
  ActionsViewModel = class ActionsViewModel {
    static taskCache = new Map;
    _menuState = "loading";
    _menuMessage = null;
    _tasks = [];
    _showAllTasks = false;
    _tasksLoadPromise = null;
    _onMenuUpdate = null;
    _state = "idle";
    _output = { lines: [], scrollOffset: 0, exitCode: null };
    _outputWindowSize = 20;
    _currentProcess = null;
    _onOutputUpdate = null;
    constructor() {
      this.loadGradleTasks();
    }
    get state() {
      return this._state;
    }
    get output() {
      return this._output;
    }
    get menuState() {
      return this._menuState;
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
        case NO_GRADLE_VALUE:
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
            value: NO_GRADLE_VALUE
          }];
        case "error":
          return [{
            name: "Failed to load Gradle tasks",
            description: "Select to retry task discovery",
            value: RETRY_TASK_DISCOVERY_VALUE
          }];
        case "ready": {
          const taskOptions = this._showAllTasks ? this.buildAllTaskOptions() : this.buildCuratedTaskOptions();
          const toggleOption = this._showAllTasks ? {
            name: "Show curated tasks",
            description: "Return to the recommended shortlist",
            value: SHOW_CURATED_TASKS_VALUE
          } : {
            name: "Show all tasks",
            description: "List every task from `./gradlew tasks --all`",
            value: SHOW_ALL_TASKS_VALUE
          };
          return [...taskOptions, toggleOption];
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
        const cachedTasks = ActionsViewModel.taskCache.get(cwd);
        if (cachedTasks) {
          this._tasks = cachedTasks;
          this._menuState = "ready";
          this._menuMessage = null;
          this.notifyMenuUpdate();
          return;
        }
        const detection = new ProjectDetection().detectAndroidProject(cwd);
        const hasGradleWrapper = fs4.existsSync("gradlew");
        if (!detection.isAndroidProject || !hasGradleWrapper) {
          this._menuState = "not-gradle";
          this._menuMessage = `No Android Gradle project detected. Launch Droid Forge from your project root,
` + "or pass a path: bun dev /path/to/android/project";
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
        ActionsViewModel.taskCache.set(cwd, tasks);
        this._menuState = "ready";
        this._menuMessage = null;
        this.notifyMenuUpdate();
      })();
      return this._tasksLoadPromise;
    }
    async runGradleCommand(command) {
      this._state = "running";
      this._output = { lines: [], scrollOffset: 0, exitCode: null };
      this._onOutputUpdate?.();
      const cwd = process.cwd();
      const detection = new ProjectDetection().detectAndroidProject(cwd);
      if (!detection.isAndroidProject || !fs4.existsSync("gradlew")) {
        this._output.lines.push(`No Android Gradle project detected.
` + "Launch Droid Forge from your project root, or pass a path: bun dev /path/to/android/project");
        this._output.exitCode = 1;
        this._state = "error";
        this._currentProcess = null;
        this._onOutputUpdate?.();
        return;
      }
      try {
        const proc = Bun.spawn(["./gradlew", command], {
          cwd,
          stdout: "pipe",
          stderr: "pipe"
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
    parseGradleTasks(output) {
      const tasksByName = new Map;
      for (const rawLine of output.split(`
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
    async streamOutput(stream) {
      const reader = stream.getReader();
      const decoder = new TextDecoder;
      let pending = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done)
          break;
        pending += decoder.decode(value, { stream: true });
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
  };
});

// src/viewmodels/index.ts
var exports_viewmodels = {};
__export(exports_viewmodels, {
  ToolsViewModel: () => ToolsViewModel,
  SettingsViewModel: () => SettingsViewModel,
  ProjectsViewModel: () => ProjectsViewModel,
  MainMenuViewModel: () => MainMenuViewModel,
  DashboardViewModel: () => DashboardViewModel,
  ActionsViewModel: () => ActionsViewModel,
  AboutViewModel: () => AboutViewModel
});
var init_viewmodels = __esm(() => {
  init_ActionsViewModel();
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
function setupDIModules() {
  const { Database: Database2, ProjectRepository: ProjectRepository2 } = (init_repositories(), __toCommonJS(exports_repositories));
  const { ThemeManager: ThemeManager2 } = (init_theme(), __toCommonJS(exports_theme));
  const {
    MainMenuViewModel: MainMenuViewModel2,
    DashboardViewModel: DashboardViewModel2,
    ProjectsViewModel: ProjectsViewModel2,
    ToolsViewModel: ToolsViewModel2,
    SettingsViewModel: SettingsViewModel2,
    AboutViewModel: AboutViewModel2,
    ActionsViewModel: ActionsViewModel2
  } = (init_viewmodels(), __toCommonJS(exports_viewmodels));
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
function clearCurrentView(renderer, currentViewElements, menuSelect) {
  currentViewElements.forEach((element) => {
    if (element && typeof element === "object" && element.id) {
      renderer.root.remove(element.id);
    }
  });
  currentViewElements.length = 0;
  if (menuSelect) {
    menuSelect.destroy();
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
    const projectDetection = new ProjectDetection;
    const project = projectDetection.detectAndroidProject(process.cwd());
    if (project.isAndroidProject) {
      return "actions";
    }
    return "projects";
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
var init_navigation = () => {};

// src/utilities/androidProjectName.ts
import fs5 from "fs";
import path5 from "path";
function getAndroidProjectName(projectRoot) {
  const settingsCandidates = ["settings.gradle.kts", "settings.gradle"];
  for (const settingsFile of settingsCandidates) {
    const filePath = path5.join(projectRoot, settingsFile);
    if (!fs5.existsSync(filePath))
      continue;
    try {
      const content = fs5.readFileSync(filePath, "utf8");
      const match = content.match(/rootProject\.name\s*=\s*['"]([^'"]+)['"]/);
      if (match?.[1]) {
        const name = match[1].trim();
        if (name.length > 0)
          return name;
      }
    } catch {}
  }
  return path5.basename(projectRoot);
}
var init_androidProjectName = () => {};

// src/utilities/projectMemory.ts
import crypto from "crypto";
import path6 from "path";
function normalizeProjectPath(projectPath) {
  return path6.resolve(projectPath);
}
function projectIdFromPath(projectPath) {
  const normalized = normalizeProjectPath(projectPath);
  return crypto.createHash("sha1").update(normalized).digest("hex");
}
var init_projectMemory = () => {};

// src/utilities/index.ts
var init_utilities = __esm(() => {
  init_navigation();
  init_androidProjectName();
  init_projectMemory();
});

// src/ui/components/Header.ts
import { ASCIIFont, Text, TextAttributes, BoxRenderable } from "@opentui/core";
function MainHeader(renderer, title, subtitle) {
  const headerBox = new BoxRenderable(renderer, {
    id: "main-header-box",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2
  });
  const asciiElement = ASCIIFont({ font: "tiny", text: title });
  headerBox.add(asciiElement);
  if (subtitle) {
    const textElement = Text({ content: subtitle, attributes: TextAttributes.DIM });
    headerBox.add(textElement);
  }
  return headerBox;
}
function Header(renderer, title, subtitle) {
  const headerBox = new BoxRenderable(renderer, {
    id: "header-box",
    justifyContent: "center",
    alignItems: "flex-start",
    marginLeft: 4,
    marginBottom: 1
  });
  const titleText = Text({ content: title, attributes: TextAttributes.BOLD });
  headerBox.add(titleText);
  if (subtitle) {
    const subtitleText = Text({ content: subtitle, attributes: TextAttributes.NONE });
    headerBox.add(subtitleText);
  }
  return headerBox;
}
var init_Header = () => {};

// src/ui/components/Footer.ts
import { Text as Text2, BoxRenderable as BoxRenderable2 } from "@opentui/core";
function Footer(renderer, content, theme) {
  const footerBox = new BoxRenderable2(renderer, {
    id: "footer-box",
    height: 2,
    backgroundColor: theme?.secondaryColor || "#1e40af",
    border: true,
    borderStyle: "single",
    borderColor: theme?.primaryColor || "#1d4ed8"
  });
  footerBox.add(Text2({
    content,
    fg: "#dbeafe",
    margin: 1
  }));
  return footerBox;
}
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
    borderColor: "#475569",
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
    height: props.height || 12,
    options: props.options,
    selectedIndex: props.selectedIndex ?? 0,
    backgroundColor: "transparent",
    focusedBackgroundColor: "transparent",
    selectedBackgroundColor: "#1E3A5F",
    textColor: "#E2E8F0",
    selectedTextColor: "#38BDF8",
    descriptionColor: "#64748B",
    selectedDescriptionColor: "#94A3B8",
    showScrollIndicator: true,
    wrapSelection: true,
    showDescription: true
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

// src/ui/view/MainMenuView.ts
import { BoxRenderable as BoxRenderable4 } from "@opentui/core";
function MainMenuView(renderer, viewModel, onNavigate) {
  const detector = new ProjectDetection;
  const isAndroid = detector.detectAndroidProject(process.cwd());
  const menuContainer = new BoxRenderable4(renderer, {
    id: "menu-container",
    alignItems: "center",
    justifyContent: "center",
    flexGrow: 1
  });
  const header = MainHeader(renderer, "Droid Forge", isAndroid.isAndroidProject.toString() + process.cwd());
  menuContainer.add(header);
  const selectContainer = new BoxRenderable4(renderer, {
    id: "select-container",
    width: 100,
    height: 15,
    border: true,
    borderStyle: "single",
    borderColor: "#475569",
    backgroundColor: "transparent",
    title: "Main Menu",
    titleAlignment: "center",
    margin: 2
  });
  const menuOptions = viewModel.getMenuOptions();
  const selectMenu = SelectMenu(renderer, {
    id: "main-menu-select",
    options: menuOptions,
    autoFocus: true,
    onSelect: (index, option) => {
      const view = viewModel.onMenuItemSelected(index, option);
      onNavigate(view);
    }
  });
  selectContainer.add(selectMenu);
  menuContainer.add(selectContainer);
  return menuContainer;
}
var init_MainMenuView = __esm(() => {
  init_components();
});

// src/ui/view/DashboardView.ts
import { Text as Text4, BoxRenderable as BoxRenderable5 } from "@opentui/core";
function DashboardView(renderer, viewModel) {
  const dashboardContainer = new BoxRenderable5(renderer, {
    id: "dashboard-container",
    flexDirection: "column",
    flexGrow: 1
  });
  const header = Header(renderer, "\uD83C\uDFE0 Dashboard - Quick Actions");
  dashboardContainer.add(header);
  const contentBox = new BoxRenderable5(renderer, {
    id: "dashboard-content",
    flexDirection: "row",
    flexGrow: 1
  });
  const leftPanel = Panel(renderer, {
    id: "projects-panel",
    title: "\uD83D\uDCC1 Recent Projects",
    flexGrow: 1
  });
  viewModel.getRecentProjects().forEach((project) => {
    leftPanel.add(Text4({ content: `\u2022 ${project}`, margin: 1 }));
  });
  const rightPanel = Panel(renderer, {
    id: "stats-panel",
    title: "\uD83D\uDCCA Quick Stats",
    flexGrow: 1
  });
  const stats = viewModel.getQuickStats();
  rightPanel.add(Text4({ content: `Projects: ${stats.projects}`, margin: 1 }));
  rightPanel.add(Text4({ content: `Active: ${stats.active}`, margin: 1 }));
  rightPanel.add(Text4({ content: `Completed: ${stats.completed}`, margin: 1 }));
  rightPanel.add(Text4({ content: `Templates: ${stats.templates}`, margin: 1 }));
  contentBox.add(leftPanel);
  contentBox.add(rightPanel);
  dashboardContainer.add(contentBox);
  const footer = Footer(renderer, "ESC: Back to Menu | TAB: Navigate | ENTER: Select");
  dashboardContainer.add(footer);
  return dashboardContainer;
}
var init_DashboardView = __esm(() => {
  init_components();
});

// src/ui/view/ProjectsView.ts
import { BoxRenderable as BoxRenderable6 } from "@opentui/core";
function ProjectsView(renderer, viewModel, onNavigate, onSelectCreated) {
  const projectsContainer = new BoxRenderable6(renderer, {
    id: "projects-container",
    alignItems: "center",
    justifyContent: "center",
    flexGrow: 1
  });
  const header = Header(renderer, "\uD83D\uDCC2 Projects - Create & Manage");
  projectsContainer.add(header);
  const selectContainer = new BoxRenderable6(renderer, {
    id: "select-container",
    width: 120,
    height: 20,
    border: true,
    borderStyle: "single",
    borderColor: "#475569",
    backgroundColor: "transparent",
    title: "Projects & Actions",
    titleAlignment: "center",
    margin: 2
  });
  const selectMenu = SelectMenu(renderer, {
    id: "projects-select",
    options: viewModel.getAllMenuOptions(),
    height: 18,
    autoFocus: true,
    selectedIndex: viewModel.getInitialSelectedIndex(),
    onSelect: (index, option) => {
      const action = viewModel.onMenuItemSelected(index, option);
      if (onNavigate) {
        onNavigate(action);
      }
    }
  });
  onSelectCreated?.(selectMenu);
  function refreshMenu() {
    selectMenu.options = viewModel.getAllMenuOptions();
    selectMenu.setSelectedIndex(viewModel.getInitialSelectedIndex());
    projectsContainer.remove("footer-box");
    const footer2 = Footer(renderer, viewModel.getFooterText());
    projectsContainer.add(footer2);
    selectMenu.focus();
  }
  viewModel.setMenuUpdateCallback(refreshMenu);
  selectContainer.add(selectMenu);
  projectsContainer.add(selectContainer);
  const footer = Footer(renderer, viewModel.getFooterText());
  projectsContainer.add(footer);
  return projectsContainer;
}
var init_ProjectsView = __esm(() => {
  init_components();
});

// src/ui/view/ToolsView.ts
import { Text as Text5, BoxRenderable as BoxRenderable7 } from "@opentui/core";
function ToolsView(renderer, viewModel) {
  const toolsContainer = new BoxRenderable7(renderer, {
    id: "tools-container",
    flexDirection: "column",
    flexGrow: 1
  });
  const header = Header(renderer, "\uD83D\uDD27 Tools - Development Utilities");
  toolsContainer.add(header);
  const contentBox = new BoxRenderable7(renderer, {
    id: "tools-content",
    flexDirection: "row",
    flexGrow: 1
  });
  const leftPanel = Panel(renderer, {
    id: "tools-categories",
    title: "Code Generators",
    flexGrow: 1
  });
  viewModel.getCodeGenerators().forEach((generator) => {
    leftPanel.add(Text5({ content: `\u2022 ${generator}`, margin: 1 }));
  });
  const rightPanel = Panel(renderer, {
    id: "tools-utilities",
    title: "Utilities",
    flexGrow: 1
  });
  viewModel.getUtilities().forEach((utility) => {
    rightPanel.add(Text5({ content: `\u2022 ${utility}`, margin: 1 }));
  });
  contentBox.add(leftPanel);
  contentBox.add(rightPanel);
  toolsContainer.add(contentBox);
  const footer = Footer(renderer, "ESC: Back to Menu | Click tools to use them");
  toolsContainer.add(footer);
  return toolsContainer;
}
var init_ToolsView = __esm(() => {
  init_components();
});

// src/ui/view/SettingsView.ts
import { Text as Text6, BoxRenderable as BoxRenderable8 } from "@opentui/core";
function SettingsView(renderer, viewModel) {
  const settingsContainer = new BoxRenderable8(renderer, {
    id: "settings-container",
    flexDirection: "column",
    flexGrow: 1
  });
  const header = Header(renderer, "\u2699\uFE0F Settings - Configuration");
  settingsContainer.add(header);
  const contentBox = new BoxRenderable8(renderer, {
    id: "settings-content",
    flexDirection: "row",
    flexGrow: 1
  });
  const leftPanel = Panel(renderer, {
    id: "preferences-panel",
    title: "Preferences",
    flexGrow: 1
  });
  const prefs = viewModel.getPreferences();
  leftPanel.add(Text6({ content: `Theme: ${prefs.theme}`, margin: 1 }));
  leftPanel.add(Text6({ content: `Language: ${prefs.language}`, margin: 1 }));
  leftPanel.add(Text6({ content: `Auto-save: ${prefs.autoSave}`, margin: 1 }));
  leftPanel.add(Text6({ content: `Notifications: ${prefs.notifications}`, margin: 1 }));
  const rightPanel = Panel(renderer, {
    id: "advanced-panel",
    title: "Advanced",
    flexGrow: 1
  });
  const advanced = viewModel.getAdvancedOptions();
  rightPanel.add(Text6({ content: `Cache: ${advanced.cache}`, margin: 1 }));
  rightPanel.add(Text6({ content: `Data: ${advanced.data}`, margin: 1 }));
  rightPanel.add(Text6({ content: `Debug: ${advanced.debug}`, margin: 1 }));
  rightPanel.add(Text6({ content: `Reset: ${advanced.reset}`, margin: 1 }));
  contentBox.add(leftPanel);
  contentBox.add(rightPanel);
  settingsContainer.add(contentBox);
  const footer = Footer(renderer, "ESC: Back to Menu | SPACE: Toggle options");
  settingsContainer.add(footer);
  return settingsContainer;
}
var init_SettingsView = __esm(() => {
  init_components();
});

// src/ui/view/AboutView.ts
import { Text as Text7, BoxRenderable as BoxRenderable9, ASCIIFont as ASCIIFont2 } from "@opentui/core";
function AboutView(renderer, viewModel) {
  const aboutContainer = new BoxRenderable9(renderer, {
    id: "about-container",
    flexDirection: "column",
    flexGrow: 1
  });
  const header = Header(renderer, "\u2139\uFE0F About - Droid Forge");
  aboutContainer.add(header);
  const contentBox = new BoxRenderable9(renderer, {
    id: "about-content",
    alignItems: "center",
    justifyContent: "center",
    flexGrow: 1
  });
  const infoBox = new BoxRenderable9(renderer, {
    id: "info-box",
    flexDirection: "column",
    alignItems: "center",
    maxWidth: 60
  });
  const info = viewModel.getAppInfo();
  infoBox.add(ASCIIFont2({ font: "tiny", text: info.name }));
  infoBox.add(Text7({ content: `Version ${info.version}`, margin: 1 }));
  infoBox.add(Text7({ content: info.description, margin: 1 }));
  infoBox.add(Text7({ content: "", margin: 1 }));
  infoBox.add(Text7({ content: info.builtWith, margin: 1 }));
  infoBox.add(Text7({ content: info.tagline, margin: 1 }));
  infoBox.add(Text7({ content: "", margin: 1 }));
  infoBox.add(Text7({ content: "Features:", attributes: 1, margin: 1 }));
  viewModel.getFeatures().forEach((feature) => {
    infoBox.add(Text7({ content: `\u2022 ${feature}`, margin: 1 }));
  });
  contentBox.add(infoBox);
  aboutContainer.add(contentBox);
  const footer = Footer(renderer, "ESC: Back to Menu | Visit opentui.com for more info");
  aboutContainer.add(footer);
  return aboutContainer;
}
var init_AboutView = __esm(() => {
  init_components();
});

// src/ui/view/ActionsView.ts
import { BoxRenderable as BoxRenderable10, Text as Text8, TextAttributes as TextAttributes3 } from "@opentui/core";
function ActionsView(renderer, viewModel, onNavigate) {
  const container = new BoxRenderable10(renderer, {
    id: "actions-container",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    flexGrow: 1
  });
  const headerSection = new BoxRenderable10(renderer, {
    alignItems: "flex-start",
    justifyContent: "flex-start",
    width: 108
  });
  headerSection.add(Header(renderer, "\uD83D\uDC18 Gradle - Test, Build, Run and Deploy!"));
  container.add(headerSection);
  const menuPanel = new BoxRenderable10(renderer, {
    id: "menu-panel",
    width: 100,
    height: 20,
    border: true,
    borderStyle: "single",
    borderColor: "#475569",
    title: "Actions",
    titleAlignment: "center",
    margin: 2
  });
  const selectMenu = SelectMenu(renderer, {
    id: "actions-select",
    options: viewModel.getMenuOptions(),
    height: 18,
    autoFocus: true,
    onSelect: (_index, option) => {
      const value = typeof option.value === "string" ? option.value : "";
      const result = viewModel.handleMenuSelection(value);
      if (result.action === "navigate" && onNavigate) {
        onNavigate(`actionoutputview:${result.command}`);
      }
    }
  });
  function updateInlineMessage() {
    const message = viewModel.inlineMessage;
    headerSection.remove("actions-message");
    if (!message)
      return;
    headerSection.add(Text8({
      id: "actions-message",
      content: message,
      attributes: TextAttributes3.DIM,
      margin: 1
    }));
  }
  function refreshMenu() {
    selectMenu.options = viewModel.getMenuOptions();
    updateInlineMessage();
  }
  viewModel.setMenuUpdateCallback(refreshMenu);
  const menuSection = new BoxRenderable10(renderer, {
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
});

// src/ui/view/ActionOutputView.ts
import { BoxRenderable as BoxRenderable11, Text as Text9, TextAttributes as TextAttributes4 } from "@opentui/core";
function ActionOutputView(renderer, viewModel, command, onBack) {
  const container = new BoxRenderable11(renderer, {
    id: "action-output-container",
    flexDirection: "column",
    flexGrow: 1
  });
  const outputPanel = new BoxRenderable11(renderer, {
    id: "output-panel",
    flexGrow: 1,
    border: true,
    borderStyle: "single",
    borderColor: "#475569",
    title: `Executing: ${command} (j/k: scroll, c: copy, ESC: cancel/back)`,
    titleAlignment: "left",
    margin: 1,
    onSizeChange: function() {
      viewModel.setOutputWindowSize(Math.max(1, this.height - 2));
    }
  });
  let outputText = Text9({
    id: "output-text",
    content: "",
    attributes: TextAttributes4.NONE,
    flexGrow: 1,
    wrapMode: "char"
  });
  outputPanel.add(outputText);
  let statusBar = Text9({ id: "status-bar", content: "", attributes: TextAttributes4.DIM });
  container.add(outputPanel);
  container.add(statusBar);
  function getVisibleLineCount() {
    return Math.max(1, outputPanel.height - 2);
  }
  function updateOutput() {
    const output = viewModel.output;
    const visibleLineCount = getVisibleLineCount();
    viewModel.setOutputWindowSize(visibleLineCount);
    const visibleLines = output.lines.slice(output.scrollOffset, output.scrollOffset + visibleLineCount);
    outputText = Text9({
      id: "output-text",
      content: visibleLines.join(`
`),
      attributes: TextAttributes4.NONE,
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
    const exitInfo = output.exitCode !== null ? ` (exit: ${output.exitCode})` : "";
    const scrollInfo = `[${output.scrollOffset + 1}-${Math.min(output.scrollOffset + visibleLineCount, output.lines.length)}/${output.lines.length}]`;
    const statusColor = viewModel.state === "error" ? TextAttributes4.BOLD : viewModel.state === "completed" ? TextAttributes4.NONE : TextAttributes4.DIM;
    statusBar = Text9({
      id: "status-bar",
      content: `${stateIcon} ${viewModel.state}${exitInfo} ${scrollInfo}`,
      attributes: statusColor
    });
    container.remove("status-bar");
    container.add(statusBar);
  }
  viewModel.setOutputUpdateCallback(updateOutput);
  renderer.keyInput.on("keypress", (key) => {
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
          const text = viewModel.getOutputText();
          try {
            Bun.spawn(["pbcopy"], {
              stdin: new Response(text).body
            });
            statusBar = Text9({
              id: "status-bar",
              content: "\uD83D\uDCCB Copied to clipboard!",
              attributes: TextAttributes4.NONE
            });
            container.remove("status-bar");
            container.add(statusBar);
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
  });
  viewModel.setOutputWindowSize(getVisibleLineCount());
  viewModel.runGradleCommand(command);
  return container;
}
var init_ActionOutputView = () => {};

// src/ui/view/index.ts
var init_view = __esm(() => {
  init_MainMenuView();
  init_DashboardView();
  init_ProjectsView();
  init_ToolsView();
  init_SettingsView();
  init_AboutView();
  init_ActionsView();
  init_ActionOutputView();
});

// src/index.ts
var exports_src = {};
import { createCliRenderer } from "@opentui/core";
import path7 from "path";
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
function renderCurrentView() {
  clearCurrentView(renderer, currentViewElements, currentSelectElement);
  currentSelectElement = null;
  const currentView = navigation.getCurrentView();
  if (currentView.startsWith("actionoutputview:")) {
    const prefix = "actionoutputview:";
    const command = currentView.slice(prefix.length);
    const viewModel = diContainer.get("ActionsViewModel");
    const view = ActionOutputView(renderer, viewModel, command, () => {
      navigation.navigateTo("actions");
      renderCurrentView();
    });
    renderer.root.add(view);
    currentViewElements.push(view);
    return;
  }
  switch (currentView) {
    case "menu": {
      const viewModel = diContainer.get("MainMenuViewModel");
      const view = MainMenuView(renderer, viewModel, (view2) => {
        navigation.navigateTo(view2);
        renderCurrentView();
      });
      renderer.root.add(view);
      currentViewElements.push(view);
      break;
    }
    case "dashboard": {
      const viewModel = diContainer.get("DashboardViewModel");
      const view = DashboardView(renderer, viewModel);
      renderer.root.add(view);
      currentViewElements.push(view);
      break;
    }
    case "projects": {
      const viewModel = diContainer.get("ProjectsViewModel");
      const view = ProjectsView(renderer, viewModel, (action) => {
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
      });
      renderer.root.add(view);
      currentViewElements.push(view);
      break;
    }
    case "tools": {
      const viewModel = diContainer.get("ToolsViewModel");
      const view = ToolsView(renderer, viewModel);
      renderer.root.add(view);
      currentViewElements.push(view);
      break;
    }
    case "actions": {
      const viewModel = diContainer.get("ActionsViewModel");
      const view = ActionsView(renderer, viewModel, (action) => {
        if (action === "back") {
          navigation.navigateTo("menu");
        } else {
          navigation.navigateTo(action);
        }
        renderCurrentView();
      });
      renderer.root.add(view);
      currentViewElements.push(view);
      break;
    }
    case "settings": {
      const viewModel = diContainer.get("SettingsViewModel");
      const view = SettingsView(renderer, viewModel);
      renderer.root.add(view);
      currentViewElements.push(view);
      break;
    }
    case "about": {
      const viewModel = diContainer.get("AboutViewModel");
      const view = AboutView(renderer, viewModel);
      renderer.root.add(view);
      currentViewElements.push(view);
      break;
    }
  }
}
var targetDir, projectDetection, detectedRoot, renderer, navigation, currentViewElements, currentSelectElement = null;
var init_src = __esm(async () => {
  init_bootstrap();
  init_di();
  init_utilities();
  init_view();
  targetDir = process.argv[2];
  if (targetDir) {
    const resolvedPath = path7.resolve(targetDir);
    process.chdir(resolvedPath);
  }
  projectDetection = new ProjectDetection;
  detectedRoot = projectDetection.findAndroidProjectRoot(process.cwd());
  if (detectedRoot) {
    process.chdir(detectedRoot);
  }
  await bootstrap();
  setupDIModules();
  await rememberCurrentAndroidProject();
  renderer = await createCliRenderer({ exitOnCtrlC: true });
  navigation = new NavigationManager;
  currentViewElements = [];
  renderer.keyInput.on("keypress", (key) => {
    const currentView = navigation.getCurrentView();
    if (key.name === "escape") {
      if (currentView === "projects") {
        const projectsViewModel = diContainer.get("ProjectsViewModel");
        if (projectsViewModel.isConfirmingRemoval()) {
          projectsViewModel.cancelRemove();
          return;
        }
      }
      if (currentView !== "menu") {
        navigation.navigateTo("menu");
        renderCurrentView();
      }
      return;
    }
    if (currentView === "projects") {
      const projectsViewModel = diContainer.get("ProjectsViewModel");
      const keyName = (key.name || "").toLowerCase();
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

// src/cli.ts
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
async function runUpdate(args) {
  const checkOnly = args.includes("--check");
  const autoYes = args.includes("--yes") || args.includes("-y");
  const latest = await getLatestRef();
  const spec = `github:${REPO}#${latest.ref}`;
  if (checkOnly) {
    console.log(latest.ref);
    return;
  }
  let cmd;
  let cmdArgs;
  if (Bun.which("bun")) {
    cmd = "bun";
    cmdArgs = ["add", "-g", spec];
  } else if (Bun.which("npm")) {
    cmd = "npm";
    cmdArgs = ["i", "-g", spec];
  } else {
    throw new Error("Neither bun nor npm is available on PATH.");
  }
  const fullCommand = `${cmd} ${cmdArgs.join(" ")}`;
  if (!autoYes) {
    const confirmed = await confirmUpdate(fullCommand);
    if (!confirmed) {
      console.log("Cancelled.");
      return;
    }
  } else {
    console.log(fullCommand);
  }
  const proc = Bun.spawn([cmd, ...cmdArgs], {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit"
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`Update command failed with exit code ${exitCode}`);
  }
  console.log(`Updated to ${latest.ref}. Restart droidforge.`);
}
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
