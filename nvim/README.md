# Droidforge Neovim Distribution

World-class Kotlin Multiplatform Neovim config — editing, LSP, Gradle, run targets, devices, and logs in one menu-driven setup.

## Requirements

- **Neovim 0.12+** (uses native `vim.pack.add()`)
- **macOS** recommended for full iOS/Swift support
- **Homebrew** kotlin-lsp: `brew install kotlin-lsp`
- **Android**: `ANDROID_HOME`, `adb`, emulator
- **iOS** (macOS): Xcode, `sourcekit-lsp`
- **Java**: `jdtls` on PATH for Java interop

## Install

```bash
git clone https://github.com/peytonmscott/droidforge.git ~/Developer/droidforge
ln -sf ~/Developer/droidforge/nvim ~/.config/nvim
nvim
```

On first launch, Neovim downloads plugins via `vim.pack`.

With [macbook-setup](https://github.com/peytonmscott/macbook-setup), point your dotfiles nvim symlink at `droidforge/nvim` instead of a separate dotfiles tree.

## Quick start

Open a KMP project, then:

| Key / Command | Action |
|---|---|
| `<leader>f` or `:Forge` | Main menu — Run, Gradle, Devices, Logs, Kotlin, Debug, Doctor |
| `<leader>r` | Smart run (web / Android / iOS / JVM by context) |
| `:ForgeKotlin` | All Kotlin LSP actions (format, imports, symbols, debug…) |
| `:ForgeGradle` | Curated Gradle tasks + browse all tasks |
| `:ForgeLogs` | App logcat or full device logs |
| `:ForgeDevices` | Android emulators + iOS simulators |
| `:ForgeDoctor` | Toolchain health check |

## Menu-first Kotlin actions

Use `:Forge` → **Kotlin…** instead of memorizing keybinds. Every kotlin.nvim action is listed with a description.

## Logs

Forge log buffers support:

- `j` / `k` — scroll
- `Y` — copy current line to clipboard
- `c` — copy entire buffer
- `p` — pause / resume stream
- `f` — filter by tag or text
- `x` — clear
- `q` — close

## Structure

```
nvim/
├── init.lua
├── nvim-pack-lock.json
└── lua/forge/
    ├── menu.lua      # :Forge hub
    ├── kotlin.lua    # kotlin.nvim
    ├── gradle.lua    # Gradle task menus
    ├── runner.lua    # <leader>r
    ├── logs.lua      # logcat + build output
    ├── android.lua   # emulators
    ├── ios.lua       # simulators + xcodebuild
    ├── web.lua       # wasm/js dev server
    ├── lsp.lua       # LSP stack
    └── doctor.lua    # :ForgeDoctor
```

See [docs/KMP_NEOVIM.md](../docs/KMP_NEOVIM.md) and [docs/KMP_DEV_FLOWS.md](../docs/KMP_DEV_FLOWS.md).
