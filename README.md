# Droidforge

Droidforge is a terminal UI (TUI) companion for Android development. Point it at an Android/Gradle project and it becomes a fast dashboard for common Gradle tasks, project switching, and more.

## Modes

Droidforge changes its root menu depending on where you launch it:

- **Forge mode**: general tools (project switching, settings, about).
- **Anvil mode**: enabled when Droidforge detects an Android/Gradle project; focuses on running and browsing Gradle tasks.

## Features

**Available today**

- **Project Ledger**: remembers Android projects you’ve opened and lets you quickly switch between them.
- **Gradle task runner**: run common tasks (build/test/lint/install) and view output in-app.
- **Task browser**: browse a curated shortlist or list **all** tasks from `./gradlew tasks --all`.
- **Themes + preferences**: persisted across runs.

**Coming soon (and contributions welcome!)**

- Emulator / device management
- ADB “quick actions”
- App/device log views
- Device mirroring

If any of these sound fun to build, open a PR or start a discussion — help is welcome.

## Install

```bash
bun add -g github:peytonmscott/droidforge
```

This installs a `droidforge` binary on your `PATH`.

## Requirements

- **Runtime**: Bun (the CLI entrypoint is `#!/usr/bin/env bun`).
- **For Anvil mode (Gradle tooling)**:
  - An Android project with the Gradle wrapper at the project root (`./gradlew`).
  - A working Java/JDK + Android toolchain as required by your project’s Gradle tasks.

## Usage

Launch inside a project directory:

```bash
droidforge
```

Or pass a path (handy from anywhere):

```bash
droidforge /path/to/android/project
```

Notes:

- If you launch from a subdirectory, Droidforge walks up to the Android project root when it can.
- Some views require the Gradle wrapper (`./gradlew`) to be present at the project root.

## Keybindings

Droidforge is keyboard-first; the footer shows context-specific shortcuts.

Common controls:

- `↑`/`↓`: navigate
- `ENTER`: select
- `ESC`: back
- `CTRL+C`: quit

When viewing command output:

- `j`/`k`: scroll
- `c`: copy
- `ESC`: cancel/back

## Commands

### `droidforge update`

Updates your global installation to the latest GitHub version.

```bash
droidforge update
```

Flags:

- `--check`: print the latest ref (tag) and exit
- `--yes` / `-y`: skip the confirmation prompt

**How it chooses what to install**

1. Latest GitHub Release tag (preferred)
2. Most recent git tag
3. Default branch (`main`)

## Config + persistence

On first run, Droidforge creates:

- `droidforge.json` (theme + preferences)
- `droidforge.db` (projects database)

Default locations:

- macOS/Linux: `~/.config/droidforge` (or `$XDG_CONFIG_HOME/droidforge`)
- Windows: `%APPDATA%\\droidforge`

For tests/dev, override the config dir with `DROIDFORGE_CONFIG_DIR`.

## Local development

```bash
bun install
bun run dev
```

Useful scripts:

```bash
bun run test
bun run build
```

Tip: during development, consider setting `DROIDFORGE_CONFIG_DIR` to a temp directory to avoid touching your real config.
