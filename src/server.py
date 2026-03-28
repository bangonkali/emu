import asyncio
import json
import mimetypes
import time
from pathlib import Path
from urllib.parse import unquote, urlsplit

import websockets
from websockets.datastructures import Headers
from websockets.http11 import Response


SAMPLE_FPS = 12
DEFAULT_MAP_NAME = "Unknown"
VALID_SPEEDS = {"max", "1x", "2x", "4x", "8x", "10x"}
VALID_BUTTONS = {"a", "b", "start", "select", "up", "down", "left", "right"}
WEB_DIR = Path(__file__).resolve().parent / "web"
MAP_DATA_PATHS = (
    WEB_DIR / "map_data.json",
    Path(__file__).resolve().parent.parent / "ref" / "PokemonRedExperiments" / "baselines" / "map_data.json",
)


def load_map_names():
    for candidate in MAP_DATA_PATHS:
        if candidate.is_file():
            with candidate.open("r", encoding="utf-8") as handle:
                regions = json.load(handle).get("regions", [])
            return {int(region["id"]): region["name"] for region in regions}
    return {}


def resolve_map_name(map_names, map_id):
    try:
        return map_names.get(int(map_id), DEFAULT_MAP_NAME)
    except (TypeError, ValueError):
        return DEFAULT_MAP_NAME


def _resolve_web_path(raw_path):
    request_path = urlsplit(unquote(raw_path)).path
    if request_path == "/":
        request_path = "/index.html"

    web_root = WEB_DIR.resolve()
    target = (web_root / request_path.lstrip("/")).resolve()
    if target != web_root and web_root not in target.parents:
        return None
    return target


def _make_response(status_code, reason_phrase, content_type, body):
    return Response(
        status_code,
        reason_phrase,
        Headers([("Content-Type", content_type)]),
        body,
    )


async def process_request(_connection, request):
    if request.path == "/ws":
        return None

    target = _resolve_web_path(request.path)
    if target is None or not target.is_file():
        return _make_response(404, "Not Found", "text/plain; charset=utf-8", b"Not Found")

    content_type = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
    return _make_response(200, "OK", content_type, target.read_bytes())


async def broadcast_json(clients, payload):
    if not clients:
        return
    websockets.broadcast(clients, json.dumps(payload))


async def emulation_loop(bot, speed_ref, clients, input_queue, map_names):
    frame_count = 0
    last_sample_time = time.monotonic()
    sample_interval = 1.0 / SAMPLE_FPS

    while True:
        frame_started = time.monotonic()

        while not input_queue.empty():
            button_name = input_queue.get_nowait()
            bot.inject_input(button_name)

        bot.step()
        frame_count += 1

        now = time.monotonic()
        if clients and now - last_sample_time >= sample_interval:
            last_sample_time = now
            state = bot.get_state_snapshot()
            state["map_name"] = resolve_map_name(map_names, state.get("map_id"))
            state["speed"] = speed_ref[0]
            state["frame"] = frame_count
            state["screen"] = bot.get_screen_base64()
            await broadcast_json(clients, {"type": "state", **state})

        speed = speed_ref[0]
        if speed == "max":
            if frame_count % 100 == 0:
                await asyncio.sleep(0)
            continue

        multiplier = int(speed.replace("x", ""))
        target_frame_time = 1.0 / (60.0 * multiplier)
        elapsed = time.monotonic() - frame_started
        if elapsed < target_frame_time:
            await asyncio.sleep(target_frame_time - elapsed)


async def ws_handler(websocket, bot, clients, input_queue, speed_ref, map_names):
    clients.add(websocket)
    try:
        for entry in bot.logger.get_recent_logs():
            await websocket.send(json.dumps({"type": "log", **entry}))

        initial_state = bot.get_state_snapshot()
        initial_state["map_name"] = resolve_map_name(map_names, initial_state.get("map_id"))
        initial_state["speed"] = speed_ref[0]
        initial_state["frame"] = 0
        initial_state["screen"] = bot.get_screen_base64()
        await websocket.send(json.dumps({"type": "state", **initial_state}))

        async for raw_message in websocket:
            try:
                message = json.loads(raw_message)
            except json.JSONDecodeError:
                await websocket.send(json.dumps({"type": "error", "message": "Invalid JSON payload."}))
                continue

            message_type = message.get("type")
            if message_type == "input":
                button_name = message.get("button")
                if isinstance(button_name, str) and button_name in VALID_BUTTONS:
                    try:
                        input_queue.put_nowait(button_name)
                    except asyncio.QueueFull:
                        await websocket.send(json.dumps({"type": "error", "message": "Input queue is full."}))
            elif message_type == "set_speed":
                speed = message.get("speed")
                if speed in VALID_SPEEDS:
                    speed_ref[0] = speed
            else:
                await websocket.send(json.dumps({"type": "error", "message": "Unsupported message type."}))
    finally:
        clients.discard(websocket)


async def start_server(bot, logger, initial_speed, port):
    clients = set()
    input_queue = asyncio.Queue(maxsize=256)
    speed_ref = [initial_speed]
    map_names = load_map_names()
    loop = asyncio.get_running_loop()

    def on_log(entry):
        if clients:
            loop.create_task(broadcast_json(clients, {"type": "log", **entry}))

    logger.on_log = on_log

    loop_task = asyncio.create_task(emulation_loop(bot, speed_ref, clients, input_queue, map_names))

    async with websockets.serve(
        lambda websocket: ws_handler(websocket, bot, clients, input_queue, speed_ref, map_names),
        host="0.0.0.0",
        port=port,
        process_request=process_request,
    ):
        try:
            await asyncio.Future()
        finally:
            loop_task.cancel()
            await asyncio.gather(loop_task, return_exceptions=True)