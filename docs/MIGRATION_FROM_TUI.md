# Migration from the Droidforge TUI

Droidforge was originally a Bun/OpenTUI terminal companion for Android development. It is now a **Neovim distribution** — the `nvim/` directory is the primary product.

## What changed

| TUI feature | Neovim equivalent |
|---|---|
| Anvil Gradle menu | `:ForgeGradle` |
| Run App / Build | `<leader>r` or `:ForgeRun` |
| App / device logs | `:ForgeLogs` |
| Emulator management | `:ForgeDevices` → Android |
| Kotlin LSP (planned) | kotlin.nvim (built-in) |
| Project ledger | Future: `:Forge` → Projects |

## What to install now

```bash
ln -sf ~/Developer/droidforge/nvim ~/.config/nvim
```

The `droidforge` Bun CLI and TUI in `src/` remain in the repo for now but are **deprecated** and will be removed in a future release.

## Logic porting

TypeScript ViewModels were ported to Lua:

| TypeScript | Lua |
|---|---|
| `GradleViewModel.ts` | `lua/forge/gradle.lua` |
| `LogcatViewModel.ts` | `lua/forge/logs.lua` |
| `EmulatorService.ts` | `lua/forge/android.lua` |
| `MainMenuViewModel.ts` | `lua/forge/menu.lua` |

## Config location

- Old TUI config: `~/.config/droidforge/`
- Neovim config: `~/.config/nvim` → symlink to `droidforge/nvim`
