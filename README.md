# droidforge

## Local development

```bash
bun install
bun run dev
```

## Install (from GitHub)

```bash
# Bun
bun add -g github:peytonmscott/droidforge

# npm
npm i -g github:peytonmscott/droidforge
```

This installs a `droidforge` binary on your `PATH`.

## Config + persistence

On first run, Droidforge creates:

- `~/.config/droidforge/droidforge.json` (theme + preferences)
- `~/.config/droidforge/droidforge.db` (projects database)

For tests/dev, override the config dir with `DROIDFORGE_CONFIG_DIR`.
