# Pokémon Headless Automaton

A Python state machine that runs Pokémon Blue autonomously in a headless environment. It leverages [PyBoy](https://github.com/Baekalfen/PyBoy) to read the Game Boy's WRAM directly, enabling precise game state detection rather than relying on frame-counting macros or OCR.

Can be run natively with Python or inside a Docker container.

## Quickstart

### Prerequisites

Place your ROM and save file in the `state/` directory:
- `state/Pokémon - Blue.gb`
- `state/Pokémon - Blue.sav`

### Option A: Run Natively

```bash
pip install pyboy Pillow
python src/main.py
```

By default the script looks for `state/` relative to the working directory. Set the `STATE_DIR` environment variable to override:

```bash
STATE_DIR=/path/to/state python src/main.py
```

### Option B: Run with Docker

```bash
docker compose up -d --build
```

### Outputs

Regardless of how you run it, outputs appear in:
- `state/logs/` — Timestamped English log of every state transition
- `state/snapshots/` — A PNG screenshot captured at each state transition

## Required Files (Not in Repository)

The following files are **required at runtime** but are excluded from version control because they contain Nintendo-licensed content:

| File | Location | Description |
|------|----------|-------------|
| Pokémon Blue ROM | `state/Pokémon - Blue.gb` | The Game Boy ROM image. You must supply your own legally obtained copy. |
| Battery save | `state/Pokémon - Blue.sav` | A save file from any standard emulator (mGBA, VBA-M, etc.). Without this, the main menu will show NEW GAME instead of CONTINUE. |

The `state/memory_map.json` file **is** committed — it contains the WRAM address definitions the bot needs and has no licensed content.

## Project Structure

```
poke/
├── .gitignore                  # Python, IDE, OS ignores
├── README.md                   # This file
├── Dockerfile                  # Container image definition
├── docker-compose.yml          # Service orchestration
├── docs/
│   ├── memory_map.md           # WRAM addresses and caveats
│   ├── state_machine.md        # State flow, timing, and extension guide
│   └── docker_setup.md         # Container architecture and save translation
├── src/
│   ├── main.py                 # Entrypoint — ROM loading, PyBoy init, bot launch
│   ├── bot.py                  # GameState Enum and state machine loop
│   ├── memory.py               # JSON-driven memory reader (label → hex → byte)
│   └── logger.py               # Timestamped logging with synchronized screenshots
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

The bot progresses through six deterministic states:

1. **BOOTING** — Waits 240 frames for the intro animation to play.
2. **TITLE_SCREEN** — Presses START to reach the main menu.
3. **MAIN_MENU** — Reads `wCurrentMenuItem` to confirm CONTINUE is selected, presses A.
4. **SAVE_FILE_STATS** — Waits for the stats screen to render, presses A.
5. **TRANSITION_TO_OVERWORLD** — Waits 350 frames for the visual fade to complete, then confirms via `is_in_overworld()`.
6. **OVERWORLD** — Takes the final screenshot and exits.

Each state transition logs a descriptive message and captures a synchronized screenshot.

## References

- [pret/pokered](https://github.com/pret/pokered) — Pokémon Red/Blue disassembly (source of WRAM variable names)
- [Data Crystal RAM Map](https://datacrystal.tcrf.net/wiki/Pok%C3%A9mon_Red/Blue:RAM_map) — Community hex address reference
- [PyBoy](https://github.com/Baekalfen/PyBoy) — Game Boy emulator with Python API
- [PokemonRedExperiments](https://github.com/PWhiddy/PokemonRedExperiments) — RL project validating memory addresses
