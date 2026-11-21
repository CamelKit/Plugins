# CamelKit Loot Tracker (`camelkit-loot-tracker`)

Official **Loot Tracker** plugin for CamelKit (Desktop & Mobile).

## Features
- **Combat & Death Correlation**: Tracks engaged monsters across melee, ranged, and magic combat, correlating NPC death events and spatial/temporal ground item spawns.
- **Session Loot Aggregation**: Groups kills and item drops per monster with real-time GP valuation and drop-rate calculations.
- **EvilQuest Wiki Telemetry**: Optionally batches and submits anonymous drop observations to the EvilQuest Wiki crowdsourcing API (`https://api.camelkit.dev/telemetry/drops`).

## Module Layout
- `src/index.ts` — Package entry point
- `src/LootTrackerPlugin.ts` — Main `Plugin` class, settings, and hook wiring
- `src/types.ts` — Shared TypeScript interfaces (`DropItem`, `PendingKill`, `EngagedTarget`, `SessionData`, `TelemetryEvent`)
- `src/utils/gameAccessors.ts` — Game engine (`GameManager`/`EntityManager`), coordinate, and item icon helpers
- `src/engine/CombatTracker.ts` — Active combat target tracking, kill detection, and ground-item correlation
- `src/services/SessionStore.ts` — Persistent session state and monster drop aggregation
- `src/services/WikiTelemetry.ts` — Batched telemetry queue and Wiki sync status management
- `src/ui/LootTrackerPanel.ts` — Sidebar UI rendering, collapsible monster cards, and item drop grids

