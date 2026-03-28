# NEXT: Web Debug Tool with WebSocket Game State Streaming

## Implementation Status

### Completed in current branch

- `state/memory_map.json` contains the expanded badge, party, HP, and money addresses.
- `src/memory.py` exposes `read_word()`, badge counting, BCD decoding, party inspection, and `get_full_state()`.
- `src/logger.py` maintains the in-memory ring buffer and live log callback.
- `src/bot.py` has been refactored to a true one-frame `step()` runtime with queued input scheduling, `inject_input()`, `get_state_snapshot()`, and screen capture.
- `src/server.py` now exists and runs the async emulation loop, static file server, WebSocket protocol, log fan-out, and runtime speed control.
- `src/main.py` now boots the async runtime with `--speed` and `--port` arguments.

### Remaining on this branch

- Finish and verify the browser dashboard under `src/web/`.
- Update Docker image / compose for the server dependencies and port mapping.
- Add container-run tests for the bot, memory helpers, and server helpers.
- Run end-to-end verification inside Docker and document the final workflow.

## Background Context

This project (`poke/`) is a Python state machine that runs Pokémon Blue autonomously in a headless Game Boy emulator ([PyBoy](https://github.com/Baekalfen/PyBoy)). It reads WRAM directly to detect game state (map ID, coordinates, battle status, party data) and progresses through a deterministic boot sequence: `BOOTING → TITLE_SCREEN → MAIN_MENU → SAVE_FILE_STATS → TRANSITION_TO_OVERWORLD → OVERWORLD`.

The goal now is to add a **web-based debug tool** that:
1. Streams game state + screen over WebSocket at 12 FPS
2. Accepts Game Boy button inputs from the browser
3. Shows the player's position on a Kanto world map
4. Streams logs in real-time
5. Allows changing emulation speed at runtime

---

## Current Project Structure

```
poke/
├── src/
│   ├── main.py          # Entrypoint — ROM loading, PyBoy init, bot launch
│   ├── bot.py           # GameState Enum and state machine loop
│   ├── memory.py        # JSON-driven memory reader (label → hex → byte)  [ALREADY UPDATED]
│   └── logger.py        # Timestamped logging with screenshots            [ALREADY UPDATED]
├── state/
│   ├── memory_map.json  # Address definitions loaded by memory.py         [ALREADY UPDATED]
│   ├── Pokémon - Blue.gb    # ⛔ ROM (user-supplied, gitignored)
│   ├── Pokémon - Blue.sav   # ⛔ Save (user-supplied, gitignored)
│   ├── logs/                # Generated log files
│   └── snapshots/           # Generated screenshots
├── ref/
│   ├── pokered/             # 📦 Submodule: pret/pokered (disassembly)
│   └── PokemonRedExperiments/  # 📦 Submodule: PWhiddy/PokemonRedExperiments (RL)
├── docs/
│   ├── memory_map.md
│   ├── state_machine.md
│   └── docker_setup.md
├── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## What Has Already Been Done

### 1. `state/memory_map.json` — UPDATED ✅

New addresses added beyond the original 7:
- `wBadgeFlags` (`0xD356`) — bitmask of earned badges
- `wPartyMon1Species` through `wPartyMon6Species` (`0xD164`–`0xD169`)
- `wPartyMon1Level` through `wPartyMon6Level` (`0xD18C`, `0xD1B8`, `0xD1E4`, `0xD210`, `0xD23C`, `0xD268`)
- `wPartyMon1HP` (`0xD16C`, 2-byte), `wPartyMon1MaxHP` (`0xD18D`, 2-byte)
- `wMoney1/2/3` (`0xD347`–`0xD349`, BCD-encoded)

### 2. `src/memory.py` — UPDATED ✅

New methods added:
- `read_word(label)` — reads 2-byte big-endian value
- `get_badges_count()` — bit-counts `wBadgeFlags`
- `read_bcd(val)` — decodes BCD byte
- `get_money()` — reads 3 BCD bytes into integer
- `get_party_info()` — returns list of `{slot, species_id, level}` for each party member
- `get_full_state()` — returns a complete dict of all game state for WebSocket broadcast

### 3. `src/logger.py` — UPDATED ✅

Changes:
- Added `deque(maxlen=400)` ring buffer (`self.ring`)
- Added `on_log` callback parameter — called on each `log_state()` with `{"timestamp": ..., "message": ...}`
- Added `get_recent_logs()` — returns ring buffer as list for initial WebSocket sync

---

## What Still Needs To Be Done

### 4. Refactor `src/bot.py`

**Current state:** The bot has a `run()` method with a `while` loop that blocks until it reaches `OVERWORLD`, then returns (exits).

**Required changes:**

- **Convert to tick-driven architecture**: Replace the `while` loop with a `step()` method that processes exactly one frame (tick + state evaluation). The async server will call `step()` in a loop.
- **Add `get_state_snapshot()`**: Returns a dict combining `self.state.name`, `self.frames_in_state`, and `self.memory.get_full_state()`.
- **Add `inject_input(button_name)`**: Accepts a string button name (`"a"`, `"b"`, `"start"`, `"select"`, `"up"`, `"down"`, `"left"`, `"right"`) and maps it to the appropriate `WindowEvent.PRESS_*` / `WindowEvent.RELEASE_*` pair.
- **Don't exit at OVERWORLD**: After reaching OVERWORLD, the `step()` method should just call `self.pyboy.tick()` and return — keeping the emulator running so the user controls everything from the browser.
- **Add screen capture**: Method that returns the current Game Boy screen (160×144) as a base64-encoded PNG string in data URI format. Use `self.pyboy.screen.image` (returns PIL Image), encode with `io.BytesIO` + `base64.b64encode`.

Here is the original `bot.py` for reference (before any changes):

```python
import time
from enum import Enum, auto
from pyboy.utils import WindowEvent

class GameState(Enum):
    BOOTING = auto()
    TITLE_SCREEN = auto()
    MAIN_MENU = auto()
    SAVE_FILE_STATS = auto()
    TRANSITION_TO_OVERWORLD = auto()
    OVERWORLD = auto()

class PokemonBot:
    def __init__(self, pyboy, memory, logger):
        self.pyboy = pyboy
        self.memory = memory
        self.logger = logger
        self.state = GameState.BOOTING
        self.frames_in_state = 0

    def wait_frames(self, count):
        for _ in range(count):
            self.pyboy.tick()

    def press_button(self, button, hold_frames=5):
        self.pyboy.send_input(button)
        self.wait_frames(hold_frames)
        release = None
        if button == WindowEvent.PRESS_BUTTON_START:
            release = WindowEvent.RELEASE_BUTTON_START
        elif button == WindowEvent.PRESS_BUTTON_A:
            release = WindowEvent.RELEASE_BUTTON_A
        if release:
            self.pyboy.send_input(release)
        self.wait_frames(5)

    def transition_to(self, target_state, log_msg):
        self.logger.log_state(log_msg)
        self.state = target_state
        self.frames_in_state = 0

    def run(self):
        self.logger.log_state("Bot initialized. Starting deterministic state machine evaluation.")
        while self.state != GameState.OVERWORLD:
            self.pyboy.tick()
            self.frames_in_state += 1
            # ... state handlers ...
```

**Key design note on tick-driven refactor:**

The existing `press_button()` and `wait_frames()` methods call `self.pyboy.tick()` internally (they tick multiple frames for holds/waits). For the tick-driven approach, the state machine should still work but `step()` calls `self.pyboy.tick()` once per call. The state handler logic (frame counting, transitions) stays the same — but `wait_frames` and `press_button` need to be reworked:

- Option A (simpler): Keep `press_button` as-is (it ticks internally for the hold duration) and accept that a single `step()` call may advance multiple frames during a button press. This slightly breaks the "one tick per step" contract but is simpler.
- Option B (cleaner): Use a `pending_input` queue. In `step()`, if there's a pending input, send the press event, and set a frame counter for when to release. Each `step()` call ticks exactly once.

**Recommended: Option A** for simplicity. The 12 FPS sampling rate means we're already skipping many frames between samples. The state machine only presses buttons at specific transition points during boot, so the multi-tick press operations happen briefly and rarely.

After OVERWORLD is reached, `step()` should:
1. Process any `inject_input` from the browser (send press, wait a few ticks, send release)
2. Call `self.pyboy.tick()` once
3. Return

**Input injection approach:**

```python
BUTTON_MAP = {
    "a":      (WindowEvent.PRESS_BUTTON_A,      WindowEvent.RELEASE_BUTTON_A),
    "b":      (WindowEvent.PRESS_BUTTON_B,      WindowEvent.RELEASE_BUTTON_B),
    "start":  (WindowEvent.PRESS_BUTTON_START,   WindowEvent.RELEASE_BUTTON_START),
    "select": (WindowEvent.PRESS_BUTTON_SELECT,  WindowEvent.RELEASE_BUTTON_SELECT),
    "up":     (WindowEvent.PRESS_ARROW_UP,       WindowEvent.RELEASE_ARROW_UP),
    "down":   (WindowEvent.PRESS_ARROW_DOWN,     WindowEvent.RELEASE_ARROW_DOWN),
    "left":   (WindowEvent.PRESS_ARROW_LEFT,     WindowEvent.RELEASE_ARROW_LEFT),
    "right":  (WindowEvent.PRESS_ARROW_RIGHT,    WindowEvent.RELEASE_ARROW_RIGHT),
}
```

For injected input, press the button, tick 8 frames (standard hold), release, tick 1 frame. This matches how the RL agent in PokemonRedExperiments does it (see `run_action_on_emulator` in `ref/PokemonRedExperiments/baselines/red_gym_env.py` lines 233–256).

---

### 5. Create `src/server.py` — NEW FILE

This is the core new file. It does three things:
1. Serves static HTML/CSS/JS from `src/web/` over HTTP
2. Runs a WebSocket server for real-time bidirectional communication
3. Runs the emulation loop as an async task

**Technology:** Use the `websockets` library (lightweight, pure Python, async-native).  
Install: `pip install websockets`

**Architecture:**

```
┌──────────────────────────────────────────┐
│              asyncio event loop          │
│                                          │
│  ┌─────────────┐   ┌─────────────────┐   │
│  │  emulation   │   │  websocket      │   │
│  │  loop task   │   │  server task    │   │
│  │  (bot.step)  │   │  (connections)  │   │
│  └──────┬───────┘   └───────┬─────────┘   │
│         │                   │             │
│         │    broadcast()    │             │
│         ├───────────────────┤             │
│         │                   │             │
│  ┌──────┴───────────────────┴─────────┐   │
│  │         shared state               │   │
│  │  - bot instance                    │   │
│  │  - connected clients set           │   │
│  │  - input queue                     │   │
│  └────────────────────────────────────┘   │
└──────────────────────────────────────────┘
```

**Emulation loop pseudocode:**

```python
async def emulation_loop(bot, speed, clients, input_queue):
    frame_count = 0
    last_sample_time = time.monotonic()
    sample_interval = 1.0 / 12.0  # 12 FPS = 83.33ms

    while True:
        # Process any pending input from browser
        while not input_queue.empty():
            button = input_queue.get_nowait()
            bot.inject_input(button)

        # Tick the emulator
        bot.step()
        frame_count += 1

        # Speed control
        if speed != "max":
            multiplier = int(speed.replace("x", ""))
            target_frame_time = 1.0 / (60.0 * multiplier)
            # sleep to maintain target frame rate
            elapsed = time.monotonic() - frame_start
            if elapsed < target_frame_time:
                await asyncio.sleep(target_frame_time - elapsed)
        else:
            # Yield to event loop periodically (every 100 frames)
            if frame_count % 100 == 0:
                await asyncio.sleep(0)

        # Sample at 12 FPS for WebSocket broadcast
        now = time.monotonic()
        if now - last_sample_time >= sample_interval:
            last_sample_time = now
            state = bot.get_state_snapshot()
            screen_b64 = bot.get_screen_base64()
            message = json.dumps({
                "type": "state",
                "frame": frame_count,
                **state,
                "screen": screen_b64,
                "speed": speed,
            })
            # Broadcast to all connected clients
            websockets.broadcast(clients, message)
```

**WebSocket handler pseudocode:**

```python
async def ws_handler(websocket, bot, clients, input_queue, speed_ref):
    clients.add(websocket)
    try:
        # Send initial state: recent logs + current game state
        for log_entry in bot.logger.get_recent_logs():
            await websocket.send(json.dumps({"type": "log", **log_entry}))

        async for message in websocket:
            data = json.loads(message)
            if data["type"] == "input":
                input_queue.put_nowait(data["button"])
            elif data["type"] == "set_speed":
                speed_ref[0] = data["speed"]  # mutable reference
    finally:
        clients.discard(websocket)
```

**HTTP handler for static files:**

The `websockets` library supports serving HTTP alongside WebSocket on the same port. Use `websockets.serve()` with a `process_request` handler that serves files from `src/web/`:

```python
import mimetypes
from pathlib import Path

WEB_DIR = Path(__file__).parent / "web"

async def process_request(path, request_headers):
    if path == "/ws":
        return None  # Let WebSocket handler take over

    # Serve static files
    if path == "/":
        path = "/index.html"
    file_path = WEB_DIR / path.lstrip("/")
    if file_path.is_file():
        content_type = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"
        return (200, [("Content-Type", content_type)], file_path.read_bytes())
    return (404, [], b"Not Found")
```

**Log callback integration:**

When creating the `GameLogger`, pass an `on_log` callback that broadcasts to all connected WebSocket clients:

```python
def on_log_entry(entry):
    msg = json.dumps({"type": "log", **entry})
    websockets.broadcast(clients, msg)

logger = GameLogger(pyboy, state_dir, on_log=on_log_entry)
```

**Important note on `websockets` library versions:**

The `websockets` library API changed significantly between versions. For `websockets >= 11.0`:
- Use `async with websockets.serve(handler, host, port, process_request=process_request):`
- `websockets.broadcast(connections, message)` is the function for broadcasting

For the most compatible approach, use `websockets>=12.0` which has the cleanest async API.

---

### 6. Update `src/main.py`

**Current state:** Synchronous script that creates PyBoy, Memory, Logger, Bot, calls `bot.run()`, then stops.

**Required changes:**

```python
import os
import sys
import shutil
import glob
import argparse
import asyncio
from pyboy import PyBoy

# Add src to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from memory import MemoryMap
from logger import GameLogger
from bot import PokemonBot
from server import start_server

def parse_args():
    parser = argparse.ArgumentParser(description="Pokémon Blue Headless Automaton")
    parser.add_argument("--speed", default="1x",
                        choices=["max", "1x", "2x", "4x", "8x", "10x"],
                        help="Emulation speed (default: 1x)")
    parser.add_argument("--port", type=int, default=8765,
                        help="WebSocket/HTTP server port (default: 8765)")
    return parser.parse_args()

def main():
    args = parse_args()
    state_dir = os.environ.get("STATE_DIR",
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "state"))

    # ... existing ROM/save discovery logic unchanged ...

    pyboy = PyBoy(rom_path, window="null")
    memory = MemoryMap(pyboy, map_file)
    logger = GameLogger(pyboy, state_dir)  # on_log set later by server
    bot = PokemonBot(pyboy, memory, logger)

    try:
        asyncio.run(start_server(bot, logger, args.speed, args.port))
    finally:
        pyboy.stop()
        print("Emulation terminated.")

if __name__ == "__main__":
    main()
```

---

### 7. Create Frontend Files

All frontend files go in `src/web/`.

#### `src/web/index.html`

Single-page layout. Key sections:
- **Header bar**: Title + speed control buttons (`1x`, `2x`, `4x`, `8x`, `10x`, `MAX`)
- **Left panel**: Game Boy screen (`<img>` tag, src updated from base64) + d-pad/button controls below it
- **Right panel**: World map canvas (`<canvas>` element, draws colored rectangles for map regions with player dot)
- **Bottom bar**: Game state text (Map name, X, Y, Party count, Badges, Money)
- **Log panel**: `<pre>` element with auto-scroll, capped at 400 entries (evict oldest from DOM)

The layout should be functional, not fancy. Dark background (`#1a1a2e`), monospace fonts for data, clear button outlines.

#### `src/web/style.css`

- Dark theme: `background: #1a1a2e`, text: `#e0e0e0`
- Game Boy screen: bordered with `#333`, scaled to 2x or 3x (320×288 or 480×432)
- D-pad: CSS grid or flexbox cross shape. Each direction is a button.
- A/B buttons: round, colored (`#e74c3c` for A, `#3498db` for B)
- Start/Select: small rectangles, muted color
- Log area: monospace, `overflow-y: auto`, dark background, green text
- World map: canvas with dark background, regions drawn as colored rectangles
- Speed buttons: horizontal row, active speed highlighted

#### `src/web/app.js`

**WebSocket connection:**

```javascript
const WS_URL = `ws://${window.location.host}/ws`;
let ws;
let reconnectTimer;

function connect() {
    ws = new WebSocket(WS_URL);
    ws.onopen = () => { /* update connection status indicator */ };
    ws.onclose = () => { reconnectTimer = setTimeout(connect, 2000); };
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "state") handleState(data);
        else if (data.type === "log") handleLog(data);
    };
}
```

**State handler:**

```javascript
function handleState(data) {
    // Update screen image
    document.getElementById("screen").src = data.screen;

    // Update state text
    document.getElementById("map-name").textContent = data.map_name || `Map ${data.map_id}`;
    document.getElementById("coords").textContent = `X:${data.x} Y:${data.y}`;
    document.getElementById("party").textContent = `Party: ${data.party_count}`;
    document.getElementById("badges").textContent = `Badges: ${data.badges}`;
    document.getElementById("bot-state").textContent = data.state;
    document.getElementById("frame-count").textContent = `Frame: ${data.frame}`;

    // Update player position on world map
    updateWorldMap(data.map_id, data.x, data.y);
}
```

**Log handler (400 row cap):**

```javascript
const MAX_LOG_ROWS = 400;
const logContainer = document.getElementById("log-output");

function handleLog(data) {
    const line = document.createElement("div");
    line.textContent = `[${data.timestamp}] ${data.message}`;
    logContainer.appendChild(line);

    // Evict oldest entries
    while (logContainer.children.length > MAX_LOG_ROWS) {
        logContainer.removeChild(logContainer.firstChild);
    }

    // Auto-scroll to bottom
    logContainer.scrollTop = logContainer.scrollHeight;
}
```

**Input handling:**

```javascript
// Keyboard mapping
const KEY_MAP = {
    "ArrowUp": "up", "ArrowDown": "down",
    "ArrowLeft": "left", "ArrowRight": "right",
    "z": "a", "Z": "a",
    "x": "b", "X": "b",
    "Enter": "start",
    "Shift": "select",
};

document.addEventListener("keydown", (e) => {
    const button = KEY_MAP[e.key];
    if (button && ws && ws.readyState === WebSocket.OPEN) {
        e.preventDefault();
        ws.send(JSON.stringify({ type: "input", button }));
    }
});

// On-screen buttons
document.querySelectorAll("[data-btn]").forEach(el => {
    el.addEventListener("click", () => {
        const button = el.dataset.btn;
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "input", button }));
        }
    });
});

// Speed control
document.querySelectorAll("[data-speed]").forEach(el => {
    el.addEventListener("click", () => {
        const speed = el.dataset.speed;
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "set_speed", speed }));
        }
        // Highlight active speed button
        document.querySelectorAll("[data-speed]").forEach(b => b.classList.remove("active"));
        el.classList.add("active");
    });
});
```

**World map rendering:**

Load `map_data.json` (fetch from server or embed). Draw each outdoor region as a colored rectangle on a `<canvas>`. The global map is 436×444 tiles with 20-tile padding. Scale to fit the canvas.

```javascript
let mapData = null;
const MAP_COLORS = {
    "Pallet Town": "#7ec850", "Viridian City": "#78c850",
    "Pewter City": "#b8b8a0", "Cerulean City": "#6890f0",
    // ... etc, or just use a few alternating colors by type
};

async function loadMapData() {
    const resp = await fetch("/map_data.json");
    const data = await resp.json();
    mapData = {};
    for (const region of data.regions) {
        mapData[parseInt(region.id)] = region;
    }
    drawWorldMap();
}

function drawWorldMap() {
    const canvas = document.getElementById("world-map");
    const ctx = canvas.getContext("2d");
    const PAD = 20;
    const SCALE = canvas.width / (436 + PAD * 2);

    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Only draw outdoor maps (id 0-36)
    for (const [id, region] of Object.entries(mapData)) {
        if (parseInt(id) > 36 || parseInt(id) < 0) continue;
        const [rx, ry] = region.coordinates;
        const [tw, th] = region.tileSize;
        const x = (rx + PAD) * SCALE;
        const y = (ry + PAD) * SCALE;
        const w = tw * SCALE;
        const h = th * SCALE;

        ctx.fillStyle = "#2a5a2a";
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = "#4a8a4a";
        ctx.strokeRect(x, y, w, h);
    }
}

function updateWorldMap(mapId, playerX, playerY) {
    if (!mapData || !mapData[mapId]) return;
    drawWorldMap(); // Redraw base

    const canvas = document.getElementById("world-map");
    const ctx = canvas.getContext("2d");
    const PAD = 20;
    const SCALE = canvas.width / (436 + PAD * 2);

    const region = mapData[mapId];
    const [rx, ry] = region.coordinates;
    const gx = (rx + playerX + PAD) * SCALE;
    const gy = (ry + playerY + PAD) * SCALE;

    // Draw player dot
    ctx.fillStyle = "#ff3333";
    ctx.beginPath();
    ctx.arc(gx, gy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.stroke();
}
```

#### `src/web/map_data.json`

Copy `ref/PokemonRedExperiments/baselines/map_data.json` to `src/web/map_data.json`. This is a 58KB JSON file with 248 regions. The frontend needs it to draw the world map.

**Important:** The `coordinates` in `map_data.json` use `[x, y]` format where x is the column offset and y is the row offset from the top-left of the global map. The `tileSize` is `[width, height]` in tile units (each tile = 2×2 pixels in the actual game, but we treat them as unit squares for the map display).

The coordinate system from `ref/PokemonRedExperiments/baselines/global_map.py`:
```python
GLOBAL_MAP_SHAPE = (444 + PAD * 2, 436 + PAD * 2)  # (rows, cols) with PAD=20
# For a given map_n with player at local (r, c):
#   global_y = r + map_y + PAD
#   global_x = c + map_x + PAD
```

Note: In the map_data.json, coordinates are `[x, y]` = `[col_offset, row_offset]`. In `global_map.py`, `map_x, map_y = coordinates[0], coordinates[1]`. So `x` in the JSON is the *column* (horizontal) and `y` is the *row* (vertical).

---

### 8. Update Infrastructure

#### `Dockerfile`

```dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install dependencies
RUN pip install --no-cache-dir pyboy Pillow websockets

# Copy source
COPY src /app/src

ENV STATE_DIR=/app/state

EXPOSE 8765

CMD ["python", "src/main.py", "--speed", "1x", "--port", "8765"]
```

#### `docker-compose.yml`

```yaml
version: '3.8'

services:
  pokemon-headless:
    build: .
    ports:
      - "8765:8765"
    volumes:
      - ./state:/app/state
    command: ["python", "src/main.py", "--speed", "1x", "--port", "8765"]
```

---

## Key Reference Files

These files in the repo contain critical information. Read them before implementing:

| File | Why |
|------|-----|
| `src/bot.py` | The state machine to refactor (current version, NOT yet modified) |
| `src/memory.py` | Already updated with `get_full_state()` — see what it returns |
| `src/logger.py` | Already updated with ring buffer + `on_log` callback |
| `state/memory_map.json` | Already updated with all new addresses |
| `ref/PokemonRedExperiments/baselines/global_map.py` | Coordinate transform for world map (32 lines) |
| `ref/PokemonRedExperiments/baselines/map_data.json` | All 248 map regions with coordinates — copy to `src/web/` |
| `ref/PokemonRedExperiments/baselines/red_gym_env.py` lines 233-256 | Input injection pattern (press, tick 8 frames, release) |
| `ref/PokemonRedExperiments/baselines/memory_addresses.py` | Source of all the new memory addresses |
| `ref/pokered/constants/map_constants.asm` | Authoritative map IDs + dimensions |

---

## Decided Design Choices

1. **12 FPS sampling** for both screen base64 AND game state, regardless of emulation speed. At max speed this means sampling every ~83.33ms. Never send per-frame data.

2. **After OVERWORLD reached**, the bot state machine stops evaluating. The emulator keeps ticking. The user controls everything from the browser.

3. **Keyboard shortcuts**: Arrow keys → d-pad, `Z` → A, `X` → B, `Enter` → Start, `Shift` → Select.

4. **Speed changes** via UI buttons only (1x, 2x, 4x, 8x, 10x, MAX). Sends `{"type": "set_speed", "speed": "4x"}` over WebSocket.

5. **Browser RAM cap**: Max 400 log rows in the DOM. Oldest entries evicted. No infinitely growing data structures in the frontend. Disk (state/logs/) keeps everything.

6. **WebSocket protocol** — all messages are JSON:
   - Client → Server: `{"type": "input", "button": "a"}` or `{"type": "set_speed", "speed": "4x"}`
   - Server → Client: `{"type": "state", "frame": N, "state": "OVERWORLD", "map_id": 0, "x": 5, "y": 7, ...}` or `{"type": "log", "timestamp": "...", "message": "..."}`

7. **Single port** for both HTTP (static files) and WebSocket. WebSocket endpoint is `/ws`. Everything else serves from `src/web/`.

8. **Functional UI** — not fancy. Dark theme, monospace, clear buttons. Focus on utility.

9. **Map name resolution**: The server should include `map_name` in the state message. Use the `map_data.json` regions list to look up the name by ID. If not found, send `"Unknown"`.

---

## Verification Checklist

After implementation, verify:

1. `docker compose up --build` builds and starts without error
2. `http://localhost:8765` loads the web UI
3. Game Boy screen displays and updates at ~12 FPS
4. World map shows colored regions with a red player dot
5. Clicking d-pad buttons or pressing arrow keys moves the character
6. Clicking A/B or pressing Z/X triggers game actions
7. Speed buttons change emulation speed (visible in frame counter rate)
8. Log entries stream in real-time in the log panel
9. Log panel never exceeds 400 entries
10. At max speed, CPU usage stays reasonable (no base64 encoding bottleneck)

---

## Dependencies Summary

**Python (pip):**
- `pyboy` — Game Boy emulator (already installed)
- `Pillow` — Image handling (already installed)
- `websockets` — WebSocket server (**NEW**, add to Dockerfile)

**Frontend:**
- Zero dependencies. Pure HTML/CSS/JS. No build step. No npm.

---

## File Checklist

| File | Status | Action |
|------|--------|--------|
| `state/memory_map.json` | ✅ Done | — |
| `src/memory.py` | ✅ Done | — |
| `src/logger.py` | ✅ Done | — |
| `src/bot.py` | ❌ TODO | Refactor to tick-driven with `step()`, `inject_input()`, `get_state_snapshot()`, `get_screen_base64()` |
| `src/server.py` | ❌ TODO | Create: asyncio WebSocket + HTTP server, emulation loop, broadcast |
| `src/main.py` | ❌ TODO | Refactor: argparse + asyncio entry point |
| `src/web/index.html` | ❌ TODO | Create: full layout |
| `src/web/style.css` | ❌ TODO | Create: dark theme, Game Boy buttons |
| `src/web/app.js` | ❌ TODO | Create: WebSocket client, input, map, logs |
| `src/web/map_data.json` | ❌ TODO | Copy from `ref/PokemonRedExperiments/baselines/map_data.json` |
| `Dockerfile` | ❌ TODO | Add websockets, expose port, copy web/ |
| `docker-compose.yml` | ❌ TODO | Add port mapping |
