# Dashboard Baseline

This document records the current shipped browser dashboard so completed milestones do not have to remain in [plans/NEXT.md](../plans/NEXT.md).

## Current Status

- Complete: the original web debug tool is implemented and validated in Docker.
- Complete: the runtime serves the dashboard over HTTP and streams logs, state, and screen over WebSocket.
- Complete: browser inputs and runtime speed changes are accepted after the scripted boot flow reaches `OVERWORLD`.
- Complete: held movement uses an authoritative client/server input-state model rather than tap injection.
- Complete: pytest coverage exists for memory helpers, bot scheduling, server helpers, and recent dashboard-state extensions.

## Backend Runtime Baseline

- `src/bot.py`: true one-frame `step()` runtime, queued scripted/manual input scheduling, `get_state_snapshot()`, and screen capture.
- `src/server.py`: async emulation loop, static file serving, WebSocket protocol, log fan-out, runtime speed control, and no-cache asset responses.
- `src/main.py`: async runtime entrypoint with `--speed` and `--port` arguments.
- `src/memory.py`: richer state payload including overworld, party, combat, inventory, Pokédex progress, and save-related data.
- `src/logger.py`: in-memory ring buffer plus live log callback.

## Frontend Baseline

The current plain-JS dashboard provides these user-facing capabilities:

- Play surface with live Game Boy screen and authoritative held controls.
- Kanto map view with player marker.
- Party detail tab.
- Items tab with live bag decoding.
- Saves tab backed by native PyBoy `.state` snapshots.
- Pokédex browser with search and filters.
- Runtime log stream.
- Live battle telemetry with desktop and mobile presentation.
- Theme toggle.
- Runtime speed controls.
- Quick save action near the game controls.

## Completed Milestones

### Continuous Input, Theme, Party Detail, Pokédex

- Complete: backend input-state authority in `src/server.py`.
- Complete: held manual input sync in `src/bot.py`.
- Complete: richer party and Pokédex progress payloads in `src/memory.py`.
- Complete: generated static Pokémon catalog in `src/web/pokemon_catalog.json` from `ref/pokered`.
- Complete: frontend tabs, theme toggle, continuous on-screen controls, and Pokédex/party views in `src/web/`.

### Responsive Mobile Dashboard

- Complete: header controls to switch between Auto, Desktop, and Mobile layout modes.
- Complete: client-side mobile detection using viewport width, coarse pointer, touch support, and user agent hints.
- Complete: mobile-specific responsive behavior for overview panels, controls, stats, logs, and tabs.
- Complete: split the old overview into `Play` and `Map` tabs so mobile portrait keeps only the game surface and controls in the primary tab.
- Complete: restricted automatic mobile mode to portrait orientation and added a warning for unsupported mobile landscape.

### Screen Aspect Ratio Fix

- Complete: wrapped the live screen image in a dedicated viewport and switched the image to fill that viewport without vertical compression.
- Complete: replaced percentage-height image sizing with intrinsic `height: auto` scaling after confirming the server still streams a full `160x144` PNG.
- Complete: disabled browser caching for dashboard static assets in `src/server.py` so layout fixes are visible immediately after redeploy.

### Battle Telemetry Module

- Complete: added battle-memory reads for the active player battler, active enemy battler, opposing trainer roster, and sent-out party index.
- Complete: extended the state payload with a `combat` object containing party highlights, enemy highlights, and battle kind.
- Complete: added a live desktop combat panel in the Play view plus a dedicated mobile `Battle` tab.
- Complete: added test coverage for the combat payload.

### Inventory Items Tab

- Complete: added bag memory reads for `wNumBagItems` and `wBagItems` in the backend state payload.
- Complete: added inventory decoding tests, including early termination at the `0xFF` bag sentinel.
- Complete: added an `Items` tab with slot usage, free-space summary, and per-item cards.

### Native Save-State Explorer

- Complete: verified PyBoy native `save_state()` and `load_state()` support in Docker.
- Complete: added backend snapshot save/load support with flat `.state` files under `state/saves/`.
- Complete: bundled bot runtime metadata into each snapshot so load restores emulator and controller state coherently.
- Complete: added a `Saves` tab with explorer listing, refresh, quick save, prompt-based named save, and load actions.

## Validation Baseline

Use this baseline verification flow before and after dashboard work:

1. `docker compose build`
2. `docker compose run --rm pokemon-headless python -m pytest`
3. `docker compose up -d`
4. Smoke-test `http://localhost:8765`
5. Smoke-test `ws://localhost:8765/ws`

The frontend replatform initiative should preserve this behavior while replacing the implementation approach.