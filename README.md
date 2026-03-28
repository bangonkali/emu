# Pokémon Headless Automaton

A Python state machine that runs Pokémon Blue autonomously in a headless environment. It leverages [PyBoy](https://github.com/Baekalfen/PyBoy) to read the Game Boy's WRAM directly, enabling precise game state detection rather than relying on frame-counting macros or OCR.

The runtime is now driven by an async single-frame loop so the emulator can stay alive after boot, stream state over WebSocket, and accept browser input. The container workflow remains the supported way to run it on this machine.

## Quickstart

### 1. Clone the Repository

```bash
git clone --recursive https://github.com/<your-username>/poke.git
cd poke
```

If you already cloned without `--recursive`, initialize the submodules manually:

```bash
git submodule update --init --recursive
```

### 2. Supply the ROM and Save File

Place your own legally obtained files into the `state/` directory:

| File | Expected Path | Notes |
|------|---------------|-------|
| Pokémon Blue ROM | `state/Pokémon - Blue.gb` | Required. Not included in the repo (Nintendo-licensed). |
| Battery save | `state/Pokémon - Blue.sav` | Optional but recommended. Without it, the main menu shows NEW GAME instead of CONTINUE. Any standard emulator save (mGBA, VBA-M, etc.) works. |

### 3. Run the Bot

Docker provides a fully isolated environment with no local dependency management:

```bash
docker compose up --build
```

View the logs:

```bash
docker logs poke-pokemon-headless-1
```

Open the debug dashboard in a browser:

```text
http://localhost:8765
```

The runtime accepts two useful flags:

```bash
docker compose run --rm pokemon-headless python src/main.py --speed 1x --port 8765
```

- `--speed`: one of `1x`, `2x`, `4x`, `8x`, `10x`, `max`
- `--port`: combined HTTP/WebSocket port for the debug server

### 4. Check Outputs

Regardless of how you run it, outputs appear in:
- `state/logs/` — Timestamped English log of every state transition
- `state/snapshots/` — A PNG screenshot captured at each state transition
- `state/saves/` — Native emulator save states created from the dashboard save explorer

The browser dashboard provides:

- A live Game Boy screen updated from the WebSocket state stream
- A native-aspect-ratio Game Boy viewport that scales from the image's real 160:144 frame without CSS height clipping
- Continuous on-screen and keyboard controls for Game Boy inputs
- Auto-detected mobile layout with a manual Auto/Desktop/Mobile switch in the header
- Portrait-first mobile play mode where the main play tab only shows the game screen and controls
- Live combat telemetry for active battles, including your full party, the enemy roster, and the clearly marked current enemy Pokémon
- Runtime speed controls (`1x`, `2x`, `4x`, `8x`, `10x`, `MAX`)
- A Kanto map with the current player position highlighted
- Light and dark dashboard themes
- Party detail cards with HP, status, types, and stats
- An Items tab that shows the live bag inventory, slot order, and TM/HM identifiers
- A Saves tab that creates and loads native emulator `.state` snapshots independent of the in-game save menu
- A searchable, filterable Pokédex view with seen and owned progress
- A capped live log stream sourced from the bot logger ring buffer

## Project Structure

```
poke/
├── .gitignore                  # Python, IDE, OS ignores
├── .gitmodules                 # Submodule definitions
├── README.md                   # This file
├── Dockerfile                  # Container image definition
├── docker-compose.yml          # Service orchestration
├── docs/
│   ├── memory_map.md           # WRAM addresses and caveats
│   ├── state_machine.md        # State flow, timing, and extension guide
│   └── docker_setup.md         # Container architecture and save translation
├── ref/
│   ├── pokered/                # 📦 Submodule: pret/pokered (disassembly)
│   └── PokemonRedExperiments/  # 📦 Submodule: PWhiddy/PokemonRedExperiments (RL)
├── src/
│   ├── main.py                 # Entrypoint — ROM loading, PyBoy init, async server launch
│   ├── bot.py                  # GameState Enum and single-frame runtime loop
│   ├── memory.py               # JSON-driven memory reader (label → hex → byte)
│   ├── logger.py               # Timestamped logging with synchronized screenshots
│   ├── server.py               # Async emulation loop + HTTP/WebSocket server
│   └── web/                    # Static debug dashboard assets
└── state/
    ├── .gitignore              # Excludes ROMs, saves, logs, snapshots
    ├── memory_map.json         # Address definitions loaded by memory.py (committed)
    ├── Pokémon - Blue.gb       # ⛔ ROM file (user-supplied, gitignored)
    ├── Pokémon - Blue.sav      # ⛔ Battery save (user-supplied, gitignored)
    ├── logs/                   # ⛔ Generated per-run log files (gitignored)
    └── snapshots/              # ⛔ Generated per-state PNG screenshots (gitignored)
```

## Documentation

| Document | Description |
|----------|-------------|
| [Memory Mapping](docs/memory_map.md) | WRAM addresses used, their purposes, the overworld detection logic, and the `wPartyCount` false-positive caveat. |
| [State Machine](docs/state_machine.md) | The `GameState` Enum flow from BOOTING → OVERWORLD, deterministic frame delays, and how to add new states. |
| [Docker Setup](docs/docker_setup.md) | Container architecture, volume bindings, `.sav` → `.gb.ram` translation, and run commands. |

## How It Works

The boot state machine still progresses through six deterministic states:

1. **BOOTING** — Waits 240 frames for the intro animation to play.
2. **TITLE_SCREEN** — Presses START to reach the main menu.
3. **MAIN_MENU** — Reads `wCurrentMenuItem` to confirm CONTINUE is selected, presses A.
4. **SAVE_FILE_STATS** — Waits for the stats screen to render, presses A.
5. **TRANSITION_TO_OVERWORLD** — Waits 350 frames for the visual fade to complete, then confirms via `is_in_overworld()`.
6. **OVERWORLD** — Stops scripted navigation and keeps the emulator running for external control.

Each state transition logs a descriptive message and captures a synchronized screenshot. Once `OVERWORLD` is reached, the new runtime keeps ticking so the server can stream state and accept user input.

## Browser Controls

- Arrow keys or on-screen d-pad: hold for continuous movement
- `Z`: `A`
- `X`: `B`
- `Enter`: `Start`
- `Shift`: `Select`

The dashboard only applies interactive inputs after the scripted boot flow reaches `OVERWORLD`. Use the theme toggle in the header to switch between light and dark mode.
On phones and narrow touch devices, the dashboard can switch into a compressed mobile layout automatically. The header also exposes an explicit Auto/Desktop/Mobile layout toggle when you want to override device detection. In mobile portrait, the `Play` tab is intentionally reduced to just the live screen and controls, while map and telemetry move into separate tabs. Mobile landscape is not supported yet and falls back out of the compact mobile mode. During active battles, desktop Play now includes an inline combat telemetry module, and mobile exposes the same data in a dedicated `Battle` tab. The Items tab and the save explorer remain available in both layouts for quick bag checks and snapshot management.

## Native Save States

The dashboard now supports emulator-native save states that are separate from the game's own save menu.

- Click `Saves` in the dashboard and use `Save Snapshot` to write a `.state` file under `state/saves/`.
- Files use a flat naming convention based on the active ROM name and timestamp, with an optional user label appended.
- Loading a snapshot restores the emulator memory state and the bot runtime state together, so returning to a prior point does not depend on the game's battery save.

## Validation

Run the in-container test suite:

```bash
docker compose run --rm pokemon-headless python -m pytest
```

The implementation has been validated against Docker on this branch with:

- `docker compose build`
- `docker compose run --rm pokemon-headless python -m pytest`
- `docker compose up -d --build`
- HTTP smoke test against `http://localhost:8765`
- WebSocket smoke test confirming live `state` messages after startup

## Current Dashboard Scope

The current dashboard now includes the original live debug view plus:

- A dedicated screen viewport that now sizes from the image width with `height: auto`, avoiding half-height clipping in the live render
- Dashboard static assets are served with no-cache headers so CSS and JS fixes take effect immediately after a restart
- Auto-detected mobile responsiveness with a manual layout override for phones, tablets, and desktop browsers
- Portrait-first mobile tab flow that keeps only the live screen and controls in the main play surface
- Live combat telemetry module with current enemy focus, party highlights, and enemy roster tracking during battle
- An authoritative held-input pipeline for smoother movement controls
- Theme switching between light and dark modes
- Party inspection with current stats and battle-state details
- Live bag inventory with slot order, quantities, and TM/HM labeling
- Native `.state` snapshot save/load support in a flat save explorer under `state/saves/`
- A searchable Pokédex tab with type and ownership filters

## Reference Submodules

The `ref/` directory contains git submodules pinned to third-party repositories used as research references for WRAM addresses and RL patterns:

| Submodule | Source | Purpose |
|-----------|--------|---------|
| `ref/pokered` | [pret/pokered](https://github.com/pret/pokered) | The authoritative Pokémon Red/Blue disassembly. Variable names in `memory_map.json` (e.g. `wPartyCount`) come from `ram/wram.asm` in this repo. |
| `ref/PokemonRedExperiments` | [PWhiddy/PokemonRedExperiments](https://github.com/PWhiddy/PokemonRedExperiments) | Peter Whidden's RL project. Validated practical usage of memory addresses with PyBoy. |

These are **not** runtime dependencies — the bot never imports from them. They exist so anyone working on the project can grep the disassembly source locally to research new memory addresses.

## Additional References

- [Data Crystal RAM Map](https://datacrystal.tcrf.net/wiki/Pok%C3%A9mon_Red/Blue:RAM_map) — Community hex address reference
- [PyBoy](https://github.com/Baekalfen/PyBoy) — Game Boy emulator with Python API
