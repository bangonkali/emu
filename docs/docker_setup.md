# Docker Setup

The project runs entirely inside a Docker container, eliminating the need for a display server (X11, Wayland) or platform-specific emulator builds.

## Base Image

```dockerfile
FROM python:3.10-slim
```

The slim variant keeps the image small (~120MB) while providing the CPython runtime needed for PyBoy.

## Dependencies

```dockerfile
RUN pip install --no-cache-dir pyboy Pillow
```

| Package | Purpose |
|---------|---------|
| `pyboy` | Game Boy emulator with Python API. Runs in headless mode via `window="null"`. |
| `Pillow` | Image library used by PyBoy's `screen.image` to produce PNG snapshots. |

## Volume Binding

```yaml
volumes:
  - ./state:/app/state
```

The `state/` directory on the host is mounted into the container at `/app/state`. This serves two purposes:

1. **Input:** The ROM (`.gb`), save file (`.sav`), and memory map (`.json`) are read from here.
2. **Output:** Logs (`state/logs/`) and screenshots (`state/snapshots/`) are written back instantly — visible on the host filesystem in real time.

## Battery Save Translation

PyBoy 2.x expects SRAM files to have the naming pattern `<rom_filename>.ram` (e.g. `Pokémon - Blue.gb.ram`), not the `.sav` extension used by other emulators like mGBA.

The `src/main.py` entrypoint handles this automatically:

```python
ram_path = rom_path + ".ram"        # e.g. "Pokémon - Blue.gb.ram"
shutil.copy2(sav_path, ram_path)    # Non-destructive copy
```

The original `.sav` file is never modified — only a copy is created for PyBoy.

## Working Directory and Imports

The Dockerfile sets `WORKDIR /app` and runs `CMD ["python", "src/main.py"]`. Because Python adds the script's directory to `sys.path` by default, the sibling modules (`memory.py`, `logger.py`, `bot.py`) inside `src/` are importable without any `PYTHONPATH` manipulation.

## Running

```bash
# Build and run (foreground, logs visible)
docker compose up --build

# Build and run (detached)
docker compose up -d --build

# View logs of the last run
docker logs poke-pokemon-headless-1
```
