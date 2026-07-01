# Droidforge

**A Kotlin Multiplatform Neovim distribution** — editing, JetBrains Kotlin LSP, Java/Swift LSP, menu-driven Gradle/run/device workflows, and readable copy-pasteable logs for web, Android, and iOS development.

```bash
git clone https://github.com/peytonmscott/droidforge.git
ln -sf /path/to/droidforge/nvim ~/.config/nvim
```

Requires **Neovim 0.12+**. See [nvim/README.md](nvim/README.md) for toolchain setup.

## Forge menu (daily driver)

| Command | Action |
|---|---|
| `:Forge` or `<leader>f` | Main hub — Run, Gradle, Devices, Logs, Kotlin, Debug, Doctor |
| `<leader>r` | Smart run (web / Android / iOS / JVM by buffer context) |
| `:ForgeKotlin` | All Kotlin LSP actions via menu |
| `:ForgeGradle` | Curated + all Gradle tasks |
| `:ForgeLogs` | App or device logcat (copy-pasteable buffers) |
| `:ForgeDevices` | Android emulators + iOS simulators |
| `:ForgeDoctor` | Toolchain health check |

## Features

- **Menu-first UX** — Kotlin actions, Gradle tasks, run targets, and devices via Telescope pickers, not keybind sprawl
- **KMP-aware run** — detects `androidMain`, `iosMain`, `wasmJs`, `jvmMain` from buffer path
- **JetBrains kotlin-lsp** via [kotlin.nvim](https://github.com/AlexandrosAlexiou/kotlin.nvim)
- **Java LSP** (`jdtls`) and **Swift LSP** (`sourcekit-lsp` on macOS)
- **Readable logs** — pause, filter, yank line, copy all (`Y`, `c`, `p`, `f`)
- **Migrated from dotfiles** — based on [peytonmscott/dotfiles](https://github.com/peytonmscott/dotfiles) with Telescope, Copilot, Sidekick, treesitter

## Docs

- [docs/KMP_NEOVIM.md](docs/KMP_NEOVIM.md) — overview and install
- [docs/KMP_DEV_FLOWS.md](docs/KMP_DEV_FLOWS.md) — web / Android / iOS developer journey
- [docs/MIGRATION_FROM_TUI.md](docs/MIGRATION_FROM_TUI.md) — TUI deprecation notes

## Deprecated: Bun TUI

The OpenTUI companion in `src/` is deprecated. Use the Neovim distribution above. The TUI may still run via `bun run dev` but is no longer the focus of this project.

## Local development (legacy TUI)

```bash
bun install
bun run dev
```

## License

MIT
