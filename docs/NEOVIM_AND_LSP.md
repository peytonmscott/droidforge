# Droidforge and Neovim / Kotlin LSP

Droidforge is built to complement Neovim (and other editors) for Android development. This doc describes how it fits into that workflow and how we're preparing for the official Kotlin LSP.

## Role

- **Neovim**: primary editor; when the official Kotlin LSP is available, Neovim will use it for code intelligence (diagnostics, completion, go-to-definition, etc.).
- **Droidforge**: TUI companion for everything else—Gradle tasks, project ledger, (future) devices, ADB, logcat, etc. You run Droidforge in a separate terminal or split; it does not replace your editor.

## Shared workspace root

Droidforge uses a single **workspace** (current project root) for the session. That root is:

- Detected at startup (or when you pass a path: `droidforge /path/to/project`).
- Exposed as `WorkspaceService.getRoot()` and `WorkspaceService.getRootUri()` (file URI for LSP).

When you use Neovim and Droidforge on the same project, point both at the same directory (e.g. your Android project root). The same `rootUri` can be used by an LSP client in Neovim and by any future Droidforge integration.

## Kotlin LSP readiness

- **Today**: Droidforge has a `WorkspaceService` (single source of truth for project root and Android detection) and a `ToolingService` interface with a no-op implementation. When the official Kotlin LSP is available, a real implementation can spawn the LSP process and use `WorkspaceService.getRootUri()` for `initialize`.
- **Future**: We may surface diagnostics or symbols in the TUI (e.g. a small status line or panel). Neovim remains the primary place for editing and LSP-backed features; Droidforge would complement with build/run and optional tooling summaries.

## Summary

Use Neovim for code; use Droidforge for Gradle, projects, and (coming) devices/logs. Both can share the same workspace root, and Droidforge is structured so that adding Kotlin LSP integration later is straightforward.
