# Docker Setup

The project runs entirely inside a Docker container, eliminating the need for a display server (X11, Wayland) or platform-specific emulator builds.

Audio is also generated inside the container and streamed to the browser over the existing WebSocket connection. No host audio device passthrough, PulseAudio setup, or macOS loopback software is required for the dashboard audio feature.

## Base Image

```dockerfile
FROM python:3.10-slim
```

The slim variant keeps the image small (~120MB) while providing the CPython runtime needed for PyBoy.

## Dependencies

```dockerfile
RUN pip install --no-cache-dir pyboy Pillow websockets pytest
```

| Package | Purpose |
|---------|---------|
| `pyboy` | Game Boy emulator with Python API. Runs in headless mode via `window="null"`. |
| `Pillow` | Image library used by PyBoy's `screen.image` to produce PNG snapshots. |
| `websockets` | Async HTTP/WebSocket server used by the debug runtime. |

## Volume Binding

```yaml
volumes:
  - ./state:/app/state
```

The `state/` directory on the host is mounted into the container at `/app/state`. This serves two purposes:

1. **Input:** The ROM (`.gb`), save file (`.sav`), and memory map (`.json`) are read from here.
2. **Output:** Logs (`state/logs/`), screenshots (`state/snapshots/`), and native emulator save states (`state/saves/`) are written back instantly — visible on the host filesystem in real time.

## Battery Save Translation

PyBoy 2.x expects SRAM files to have the naming pattern `<rom_filename>.ram` (e.g. `Pokémon - Blue.gb.ram`), not the `.sav` extension used by other emulators like mGBA.

The `src/main.py` entrypoint handles this automatically:

```python
ram_path = rom_path + ".ram"        # e.g. "Pokémon - Blue.gb.ram"
shutil.copy2(sav_path, ram_path)    # Non-destructive copy
```

The original `.sav` file is never modified — only a copy is created for PyBoy.

## Working Directory and Imports

The Dockerfile sets `WORKDIR /app` and runs `CMD ["python", "src/main.py", "--speed", "1x", "--port", "8765"]`. Because Python adds the script's directory to `sys.path` by default, the sibling modules inside `src/` remain importable without any `PYTHONPATH` manipulation.

## Current Runtime Architecture

The container now launches an async server/runtime pair:

1. A single-frame emulation loop calls `bot.step()` continuously.
2. A WebSocket endpoint accepts button inputs and speed changes.
3. Static dashboard assets are served over the same port.

The browser dashboard is served from the same process on port `8765`, with the WebSocket endpoint mounted at `/ws`.

That same WebSocket now carries three classes of runtime data:

1. JSON state snapshots and control/status messages.
2. Log and save-state messages.
3. Binary PCM audio frames copied directly from PyBoy's sound buffer.

## Port Publishing

```yaml
ports:
  - "8765:8765"
```

This exposes the combined HTTP/WebSocket server so the dashboard is reachable at `http://localhost:8765`.

## Running

```bash
# Build and run (foreground, logs visible)
docker compose up --build

# Build and run (detached)
docker compose up -d --build

# View logs of the last run
docker logs poke-pokemon-headless-1
```

## Browser Workflow

1. Start the container with `docker compose up --build`.
2. Open `http://localhost:8765` in a browser.
3. Wait a few seconds for the emulator runtime to initialize and reach `OVERWORLD`.
4. Click `Enable Audio` in the `Play` panel if you want live sound in the browser. This requires a user gesture and currently targets desktop browsers.
5. Use the dashboard tabs to inspect the live overview, party details, bag items, Pokédex progress, and logs.
6. Use the held d-pad or keyboard controls to move continuously, and the header toggle to switch themes.
7. Audio playback is limited to runtime speed `1x`. Switching to `2x`, `4x`, `8x`, `10x`, or `max` mutes and flushes the browser audio queue until you return to `1x`.
8. On phones or narrow touch devices, the dashboard now auto-selects a mobile layout and touch-sized controls; use the header's Auto/Desktop/Mobile switch to override the detected layout.
9. In mobile portrait, use the `Play` tab for the game screen and controls only. Map, party, Pokédex, and logs are intentionally moved into separate tabs to keep the play surface compact. Mobile landscape is not supported yet.
10. During active battles, desktop `Play` also shows a live combat telemetry panel. On mobile, the same combat information moves to the dedicated `Battle` tab.
11. Use `Quick Save` near the game controls for an immediate timestamp-only snapshot, or use the `Saves` tab to create/load native emulator `.state` snapshots under `state/saves/` without relying on the in-game save menu.

The live screen panel now renders inside a dedicated 160:144 viewport so the Game Boy image keeps its native aspect ratio while scaling responsively.

## Native Save-State Notes

PyBoy exposes emulator-native snapshot APIs separate from SRAM battery saves:

- `pyboy.save_state(file_like_object)`
- `pyboy.load_state(file_like_object)`

This project wraps those APIs in a flat save explorer. Snapshot files are stored as `.state` files in `state/saves/` and include both the emulator state and the bot's own runtime metadata so loading a snapshot restores the automation/runtime state coherently.

The save explorer and quick-save controls use the same WebSocket connection as the rest of the live dashboard. There is no separate REST API for save operations.

## Test Workflow

```bash
docker compose build
docker compose run --rm pokemon-headless python -m pytest
```

This branch was validated with the Docker-only test flow above, followed by a runtime smoke test of the HTTP dashboard and WebSocket state stream.
