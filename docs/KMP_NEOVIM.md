# KMP Neovim with Droidforge

Droidforge is a **Neovim distribution** for Kotlin Multiplatform and mobile app development. It ships a complete `nvim/` config with JetBrains Kotlin LSP, Java and Swift LSP, menu-driven Gradle/run/device/log workflows, and readable copy-pasteable log buffers.

## Install

```bash
git clone https://github.com/peytonmscott/droidforge.git
ln -sf /path/to/droidforge/nvim ~/.config/nvim
```

Requires Neovim 0.12+ and Homebrew `kotlin-lsp` on macOS.

## Forge menu

`:Forge` (or `<leader>f`) is the main entry point:

- **Run** — web, Android, iOS, JVM (source-set aware)
- **Gradle** — curated tasks + full `./gradlew tasks --all` browser
- **Devices** — Android AVDs, iOS simulators
- **Logs** — app logcat (package filtered) or device-wide logcat
- **Kotlin** — all kotlin.nvim actions via picker
- **Debug** — nvim-dap + KotlinDebug
- **Doctor** — toolchain health

## LSP stack

| Language | Server |
|---|---|
| Kotlin | JetBrains kotlin-lsp via kotlin.nvim |
| Java | jdtls |
| Swift | sourcekit-lsp (Xcode, macOS) |
| Plus | lua, ts, python, yaml, terraform, json, roslyn, copilot |

## Smart run

`<leader>r` detects context from the current buffer:

- `androidMain` → `installDebug` + app logcat
- `iosMain` / Swift in iosApp → xcodebuild
- `wasmJs` / `jsMain` → web dev Gradle task
- `jvmMain` → `./gradlew run`
- Ambiguous → Run menu

## Migration from the TUI

The Bun/OpenTUI companion is deprecated. Gradle, logcat, and emulator logic now lives in `nvim/lua/forge/`. See [MIGRATION_FROM_TUI.md](MIGRATION_FROM_TUI.md).

## Related

- [KMP_DEV_FLOWS.md](KMP_DEV_FLOWS.md) — end-to-end developer journey
- [nvim/README.md](../nvim/README.md) — config layout
