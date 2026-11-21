# CamelKit Official Plugins Monorepo

Official built-in and Hub-published plugins for the **CamelKit** client (Desktop & Mobile).

## Architecture

Each plugin lives under `packages/<plugin-slug>/` as a multi-file TypeScript workspace package:
- **Multi-file modular source (`src/`)**: Develop complex plugins cleanly across multiple TypeScript modules, UI components, services, and styles.
- **Single-file ESM bundle (`dist/plugin.js`)**: Compiled via `esbuild` with `@camelkit/core` and `@babylonjs/*` externalized for the runtime import map.
- **Hybrid Distribution**:
  1. **Built-in Default**: Compiled bundles are synced into `CamelKit/Client` (`packages/client/src/renderer/client/plugins/`) so both the Electron desktop client and Capacitor Android mobile client ship with official plugins out of the box offline.
  2. **Plugin Hub Updates**: Individual packages in this monorepo can be published and updated through the CamelKit Plugin Hub (`CamelKit/Plugin-Builder` -> R2 CDN), allowing both Desktop and Mobile clients to pull newer plugin versions over the air without waiting for a full client release.

## Packages

| Package | Plugin Name | Description |
| :--- | :--- | :--- |
| [`packages/loot-tracker`](./packages/loot-tracker) | **Loot Tracker** | Tracks monster kills, aggregates session drops & GP value, and crowdsources drop rates to the EvilQuest Wiki. |

## Development

```bash
# Install workspace dependencies
pnpm install

# Typecheck all plugins
pnpm typecheck

# Build all plugins into packages/*/dist/plugin.js
pnpm build

# Build and sync bundles into ../Client/packages/client/src/renderer/client/plugins/
pnpm sync
```

