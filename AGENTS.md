# AGENTS.md (repo guidance for coding agents)
This repo is a Bun + TypeScript (ESM) CLI/TUI app built on `@opentui/core`.
Entry point: `src/index.ts`.
Agent goals: keep diffs small, follow existing structure (views/components + viewmodels + repositories), and prefer type-safety over `any`.

## Cursor/Copilot rules
- No Cursor rules found (`.cursorrules` or `.cursor/rules/`).
- No Copilot instructions found (`.github/copilot-instructions.md`).
If these appear later, treat them as authoritative and mirror them here.

## Commands
### Install
```bash
bun install
```
### Run
```bash
bun dev                 # watch mode (maps to: bun run --watch src/index.ts)
bun run src/index.ts     # run once
bun src/index.ts         # equivalent shorthand
```
The app optionally accepts a directory argument and will `chdir` into it:
```bash
bun dev /path/to/android/project
```
### Typecheck (recommended)
No script is configured; use:
```bash
bunx tsc -p tsconfig.json
```
Notes: `tsconfig.json` has `strict: true` and `noEmit: true`.
### Build (optional)
No production build script exists; if needed:
```bash
bun build src/index.ts --outdir dist --target bun
```
### Lint / Format
No ESLint/Prettier config exists. Don’t introduce new tooling unless asked; match the file’s existing style.
### Tests
No tests exist yet and no `test` script is configured.
If/when tests are added, prefer Bun’s runner:
```bash
bun test
bun test --watch
bun test src/foo.test.ts
bun test -t "ProjectDetection"   # name/pattern
```
Conventions to follow once tests exist:
- Place tests as `*.test.ts` / `*.spec.ts` near the code, or under `tests/`.
- Keep tests hermetic (don’t depend on a developer’s local `~/.droidforge` DB).

## Android/Gradle commands (invoked by the app)
The Actions UI runs `./gradlew <task>` in the current working directory.
```bash
./gradlew build
./gradlew test
./gradlew assembleDebug
```
Single Gradle test class/method (JUnit):
```bash
./gradlew test --tests "com.example.MyTest"
./gradlew test --tests "com.example.MyTest.someMethod"
```

## Layout
- `src/index.ts`: app bootstrap + view switching.
- `src/ui/`: OpenTUI views/components/theme.
- `src/viewmodels/`: state + actions; UI should be mostly dumb.
- `src/data/`: SQLite repositories + schema types.
- `src/di/`: simple DI container + registrations.
- `src/utilities/`: navigation, renderer helpers, project detection.
Preferred feature path: update/add ViewModel → update/add View → add data/utilities only when necessary.

## Architecture notes
- Views in `src/ui/view/` should be mostly presentational; put logic/state in `src/viewmodels/`.
- Use `NavigationManager` (`src/utilities/navigation.ts`) for view switching; avoid ad-hoc global state.
- Renderer/view cleanup happens via `clearCurrentView` (`src/utilities/renderer.ts`); keep it in sync with any new view patterns.
- SQLite data lives at `~/.droidforge/data.db`; don’t bake local paths/data into tests or docs.

## Adding features (typical flow)
- Add/extend a ViewModel in `src/viewmodels/` and export it from `src/viewmodels/index.ts`.
- Register it in `src/di/container.ts` (factory vs singleton depends on lifecycle).
- Add/extend a View in `src/ui/view/` and export it from `src/ui/view/index.ts`.
- Wire navigation in `src/index.ts` and keep `clearCurrentView` usage consistent.
- Prefer updating existing screens over adding new global state.

## Code style
### TypeScript / ESM
- ESM repo (`"type": "module"` in `package.json`); prefer `import` over `require()`.
- `require()` is used in a few places to avoid circular deps (`src/di/container.ts`) or for runtime-only builtins; keep refactors small.
### Imports
- Use `import type { … }` for type-only imports.
- Import groups (blank line between): Node builtins → external deps → internal modules.
- Prefer barrel exports where available: `src/ui/components/index.ts`, `src/ui/view/index.ts`, `src/viewmodels/index.ts`, `src/data/schemas/index.ts`.
### Formatting
- Indentation: 4 spaces; K&R braces.
- Prefer semicolons in new/modified code.
- Prefer trailing commas in multiline objects/arrays.
- Strings: prefer single quotes; use double quotes when it matches surrounding code or avoids escaping.
### UI patterns
- Views/components are functions returning `BoxRenderable`/OpenTUI renderables.
- Always set stable `id` values; use kebab-case IDs.
- When re-rendering, remove/replace elements by `id` to avoid duplicates/leaks.
- Keep keyboard handlers scoped; avoid global stateful listeners when possible.
### Naming
- Files: `PascalCase.ts` for views/components/viewmodels (matches current tree).
- Classes: `PascalCase`; functions/methods: `camelCase`.
- Constants: `UPPER_SNAKE_CASE` only for true constants.
- UI element IDs: `kebab-case` strings (e.g., `"menu-container"`).
### Types & safety
- Avoid introducing new `any`; prefer `unknown` + narrowing, and OpenTUI types where available.
- Keep `strict` TS compatibility; add explicit return types for non-trivial public methods.
- Prefer narrowing checks like `if (err instanceof Error)` before reading `err.message`.
- SQLite boundary: convert raw rows into typed schema objects inside repositories.
- Avoid widening types at boundaries (e.g., don’t return `Record<string, any>` from repositories).
### Error handling
- Only catch when you can add context or provide a fallback.
- Throw `Error` with actionable messages; don’t swallow errors unless explicitly non-fatal (clipboard is acceptable).
- Avoid noisy `console.log` in core flows; prefer UI feedback or a single `console.warn`.
- When rethrowing, keep stack/cause when possible (`throw new Error(msg, { cause })`).
### Async/process usage (Bun)
- Prefer `async/await`.
- Don’t fire-and-forget Promises from viewmodels unless explicitly intended.
- For subprocesses (`Bun.spawn`): stream `stdout`/`stderr`, await exit code (`await proc.exited`), and support cancellation (`proc.kill()`).
### Data layer (SQLite)
- Keep raw `sqlite3` rows inside repositories; return schema types from `src/data/schemas/`.
- Prefer parameterized queries (`?` + params array); never string-concatenate user input into SQL.
- Parse/serialize JSON fields carefully and handle null/empty strings defensively.
- Avoid leaking `sqlite3.Database` outside the `Database` wrapper.
### DI container
- DI keys are string-based (e.g., `'Database'`, `'ActionsViewModel'`); keep keys consistent between registration and `diContainer.get()` call sites.

## Git hygiene
- Never commit `node_modules/`, `dist/`, or local SQLite state under `~/.droidforge/`.
- Treat `.env*` and credentials as secrets; don’t commit them.
- Avoid adding new generated artifacts unless requested.

## Validation
- Run `bunx tsc -p tsconfig.json` before handoff.
- Smoke-run the app with `bun run src/index.ts` when practical.
- If changing Android/Gradle integrations, test against a real Android project directory.

## Agent workflow
- Don’t add dependencies or new tooling unless asked.
- Prefer minimal, localized refactors.
- Before handing off, run `bunx tsc -p tsconfig.json`.
- If you add tests later, also run `bun test` and note how to run a single relevant test.
