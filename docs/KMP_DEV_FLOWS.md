# KMP Developer Flows

This document maps real Kotlin Multiplatform work to Forge menus and commands.

## 1. Open a KMP project

```bash
cd ~/Developer/MyKmpApp
nvim .
```

Forge auto-detects:

- Gradle root (`settings.gradle.kts`, `gradlew`)
- `kotlin("multiplatform")` plugin
- Android (`com.android.application`)
- iOS (`ios()`, `iosApp/`, CocoaPods)
- Web (`wasmJs`, `js` targets)

Run `:ForgeDoctor` to verify toolchains.

## 2. Edit with LSP

- **Kotlin** — kotlin.nvim + JetBrains kotlin-lsp (inlay hints, folding, Gradle import)
- **Java** — jdtls in `javaMain` / Android Java sources
- **Swift** — sourcekit-lsp in `iosApp/` and `appleMain` (macOS)

Kotlin actions: `:Forge` → **Kotlin…** (format, organize imports, symbols, code actions, debug).

## 3. Run web target

`:Forge` → **Run…** → **Web**

Runs the first available task among `wasmJsBrowserDevelopmentRun`, `jsBrowserDevelopmentRun`, etc.

Output opens in a Forge log buffer (copy with `c`, scroll with `j`/`k`).

## 4. Run Android

`:Forge` → **Run…** → **Android**

Or `<leader>r` from an `androidMain` buffer.

Flow:

1. `./gradlew :app:installDebug` (or resolved install task)
2. Ensure emulator/device via adb
3. Install APK if needed
4. Open **app logcat** filtered by `applicationId`

## 5. Run iOS (macOS)

`:Forge` → **Run…** → **iOS**

Or `<leader>r` from `iosMain` / Swift in `iosApp`.

Flow:

1. List/boot simulator if needed
2. `xcodebuild` with iosApp scheme
3. Build output in Forge log buffer

## 6. Gradle tasks

`:Forge` → **Gradle…**

Curated: assemble, install, test, lint, check, build, clean, plus KMP tasks (web dev, pod install, embed framework).

Select **Show all tasks…** to fuzzy-search every Gradle task.

## 7. Devices

`:Forge` → **Devices…**

- **Android** — list/start AVDs, show `adb devices`
- **iOS** — boot simulators, run iosApp

## 8. Logs

`:Forge` → **Logs…**

| Mode | Description |
|---|---|
| App logs | `adb logcat` filtered to your app package |
| Device logs | Full device logcat |

Log buffer keys: `p` pause, `f` filter, `c` copy all, `Y` copy line, `q` close.

## 9. Debug

`:Forge` → **Debug…** — breakpoints, step, KotlinDebug attach via nvim-dap.

## 10. Release builds

`:Forge` → **Gradle…** → Assemble Release / Check / connected tests as needed.
