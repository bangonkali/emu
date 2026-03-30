import base64
import io
import json
import re
import unicodedata
from collections import deque
from datetime import datetime
from enum import Enum, auto
from pathlib import Path

from pyboy.utils import WindowEvent


INPUT_HOLD_FRAMES = 8
POST_RELEASE_COOLDOWN_FRAMES = 1
DIRECTIONAL_BUTTONS = {"up", "down", "left", "right"}
SAVE_STATE_MAGIC = b"POKEBOT_STATE_V1\n"
SAVE_STATE_SUFFIX = ".state"

BUTTON_MAP = {
    "a": (WindowEvent.PRESS_BUTTON_A, WindowEvent.RELEASE_BUTTON_A),
    "b": (WindowEvent.PRESS_BUTTON_B, WindowEvent.RELEASE_BUTTON_B),
    "start": (WindowEvent.PRESS_BUTTON_START, WindowEvent.RELEASE_BUTTON_START),
    "select": (WindowEvent.PRESS_BUTTON_SELECT, WindowEvent.RELEASE_BUTTON_SELECT),
    "up": (WindowEvent.PRESS_ARROW_UP, WindowEvent.RELEASE_ARROW_UP),
    "down": (WindowEvent.PRESS_ARROW_DOWN, WindowEvent.RELEASE_ARROW_DOWN),
    "left": (WindowEvent.PRESS_ARROW_LEFT, WindowEvent.RELEASE_ARROW_LEFT),
    "right": (WindowEvent.PRESS_ARROW_RIGHT, WindowEvent.RELEASE_ARROW_RIGHT),
}


class GameState(Enum):
    BOOTING = auto()
    TITLE_SCREEN = auto()
    MAIN_MENU = auto()
    SAVE_FILE_STATS = auto()
    TRANSITION_TO_OVERWORLD = auto()
    OVERWORLD = auto()


def slugify_name(value, fallback="snapshot"):
    normalized = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", normalized).strip("-").lower()
    return slug or fallback


class PokemonBot:
    def __init__(self, pyboy, memory, logger, saves_dir=None, game_name="pokemon-blue"):
        self.pyboy = pyboy
        self.sound = getattr(pyboy, "sound", None)
        self.memory = memory
        self.logger = logger
        self.state = GameState.BOOTING
        self.frames_in_state = 0
        self._started = False
        self._scripted_inputs = deque()
        self._manual_inputs = deque()
        self._manual_desired_buttons = set()
        self._manual_active_buttons = set()
        self._active_input = None
        self._input_cooldown_frames = 0
        self._transition_timeout_logged = False
        self.saves_dir = Path(saves_dir) if saves_dir is not None else None
        if self.saves_dir is not None:
            self.saves_dir.mkdir(parents=True, exist_ok=True)
        self.game_name = slugify_name(game_name, fallback="pokemon-blue")
        self.active_save_filename = None
        self.audio_enabled = bool(
            self.sound is not None
            and getattr(self.sound, "raw_buffer_format", None) == "b"
            and int(getattr(self.sound, "sample_rate", 0) or 0) > 0
        )

    def _enqueue_input(self, button_name, manual=False):
        if button_name not in BUTTON_MAP:
            raise ValueError(f"Unsupported button: {button_name}")
        queue = self._manual_inputs if manual else self._scripted_inputs
        queue.append(button_name)

    def _begin_next_input(self):
        if self._active_input is not None or self._input_cooldown_frames > 0:
            return

        button_name = None
        if self._scripted_inputs:
            button_name = self._scripted_inputs.popleft()
        elif self.state == GameState.OVERWORLD and self._manual_inputs:
            button_name = self._manual_inputs.popleft()

        if button_name is None:
            return

        press_event, release_event = BUTTON_MAP[button_name]
        self.pyboy.send_input(press_event)
        self._active_input = {
            "button": button_name,
            "release": release_event,
            "held_frames": 0,
        }

    def _process_input_for_frame(self):
        if self._active_input is not None and self._active_input["held_frames"] >= INPUT_HOLD_FRAMES:
            self.pyboy.send_input(self._active_input["release"])
            self._active_input = None
            self._input_cooldown_frames = POST_RELEASE_COOLDOWN_FRAMES

        self._begin_next_input()

    def _update_input_timers(self):
        if self._active_input is not None:
            self._active_input["held_frames"] += 1
        elif self._input_cooldown_frames > 0:
            self._input_cooldown_frames -= 1

    def _sync_manual_inputs(self):
        if self.state != GameState.OVERWORLD:
            self.release_manual_inputs()
            return

        to_release = self._manual_active_buttons - self._manual_desired_buttons
        to_press = self._manual_desired_buttons - self._manual_active_buttons

        for button_name in sorted(to_release):
            self.pyboy.send_input(BUTTON_MAP[button_name][1])
        for button_name in sorted(to_press):
            self.pyboy.send_input(BUTTON_MAP[button_name][0])

        self._manual_active_buttons -= to_release
        self._manual_active_buttons |= to_press

    def release_manual_inputs(self):
        for button_name in sorted(self._manual_active_buttons):
            self.pyboy.send_input(BUTTON_MAP[button_name][1])
        self._manual_active_buttons.clear()
        self._manual_desired_buttons.clear()

    def transition_to(self, target_state, log_msg):
        self.logger.log_state(log_msg)
        self.state = target_state
        self.frames_in_state = 0
        self._transition_timeout_logged = False

    def _handle_booting(self):
        if self.frames_in_state >= 240:
            map_id = self.memory.read("wMapLevel")
            self.transition_to(
                GameState.TITLE_SCREEN,
                f"Boot sequence presumed finished. Map ID reads 0x{map_id:X}. Proceeding to Title Screen.",
            )

    def _handle_title_screen(self):
        if self.frames_in_state == 1:
            self._enqueue_input("start")
        if self.frames_in_state >= 60:
            self.transition_to(
                GameState.MAIN_MENU,
                "Sent START button input. Awaiting Main Menu generation in WRAM.",
            )

    def _handle_main_menu(self):
        if self.frames_in_state >= 60 * 3:
            menu_cursor = self.memory.read("wCurrentMenuItem")
            self._enqueue_input("a")
            self.transition_to(
                GameState.SAVE_FILE_STATS,
                f"Main Menu loaded (Cursor: {menu_cursor}). Pressed 'A' on CONTINUE prompt.",
            )

    def _handle_save_file_stats(self):
        if self.frames_in_state >= 60 * 3:
            self._enqueue_input("a")
            self.transition_to(
                GameState.TRANSITION_TO_OVERWORLD,
                "Confirmed save loading. Transitioning to Overworld execution engine.",
            )

    def _handle_transition_to_overworld(self):
        if self.frames_in_state >= 350:
            if self.memory.is_in_overworld():
                x_coord = self.memory.read("wXCoord")
                y_coord = self.memory.read("wYCoord")
                map_id = self.memory.read("wMapLevel")
                self.transition_to(
                    GameState.OVERWORLD,
                    f"Overworld natively rendered! Player actively waiting at X:{x_coord}, Y:{y_coord} on Map ID: 0x{map_id:02X}.",
                )
                return

            if self.frames_in_state % 60 == 0:
                self._enqueue_input("a")

        if self.frames_in_state > 6000 and not self._transition_timeout_logged:
            party_count = self.memory.read("wPartyCount")
            battle_state = self.memory.read("wBattleState")
            self.logger.log_state(
                "Warning: State Machine timeout during Overworld Transition "
                f"(Party: {party_count}, Battle: {battle_state})."
            )
            self._transition_timeout_logged = True

    def step(self):
        if not self._started:
            self.logger.log_state("Bot initialized. Starting deterministic state machine evaluation.")
            self._started = True

        self._process_input_for_frame()
        self._sync_manual_inputs()
        self.pyboy.tick()
        self._update_input_timers()
        self.frames_in_state += 1

        if self.state == GameState.BOOTING:
            self._handle_booting()
        elif self.state == GameState.TITLE_SCREEN:
            self._handle_title_screen()
        elif self.state == GameState.MAIN_MENU:
            self._handle_main_menu()
        elif self.state == GameState.SAVE_FILE_STATS:
            self._handle_save_file_stats()
        elif self.state == GameState.TRANSITION_TO_OVERWORLD:
            self._handle_transition_to_overworld()

    def inject_input(self, button_name):
        if self.state != GameState.OVERWORLD:
            return False
        self._enqueue_input(button_name, manual=True)
        return True

    def set_manual_buttons(self, buttons):
        if self.state != GameState.OVERWORLD:
            self._manual_desired_buttons.clear()
            return False

        normalized = {button for button in buttons if button in BUTTON_MAP}
        if len(normalized & DIRECTIONAL_BUTTONS) > 1:
            directional = sorted(normalized & DIRECTIONAL_BUTTONS)
            normalized -= set(directional[:-1])
        self._manual_desired_buttons = normalized
        return True

    def get_state_snapshot(self):
        snapshot = {
            "state": self.state.name,
            "frames_in_state": self.frames_in_state,
            "active_inputs": sorted(self._manual_active_buttons),
        }
        snapshot.update(self.memory.get_full_state())
        return snapshot

    def get_screen_base64(self):
        image_buffer = io.BytesIO()
        self.pyboy.screen.image.save(image_buffer, format="PNG")
        payload = base64.b64encode(image_buffer.getvalue()).decode("ascii")
        return f"data:image/png;base64,{payload}"

    def get_audio_config(self):
        return {
            "enabled": self.audio_enabled,
            "sample_rate": int(getattr(self.sound, "sample_rate", 0) or 0),
            "channels": 2,
            "format": "s8" if self.audio_enabled else "unknown",
            "interleaved": True,
            "playback_speed": "1x",
        }

    def get_latest_audio_frame(self):
        if not self.audio_enabled:
            return b""

        raw_buffer_head = int(getattr(self.sound, "raw_buffer_head", 0) or 0)
        if raw_buffer_head <= 0:
            return b""

        return bytes(self.sound.raw_buffer[:raw_buffer_head])

    def _ensure_saves_dir(self):
        if self.saves_dir is None:
            raise RuntimeError("Save-state directory is not configured.")
        self.saves_dir.mkdir(parents=True, exist_ok=True)
        return self.saves_dir

    def _serialize_runtime_state(self):
        active_input = None
        if self._active_input is not None:
            active_input = {
                "button": self._active_input["button"],
                "held_frames": self._active_input["held_frames"],
            }

        return {
            "bot_state": self.state.name,
            "frames_in_state": self.frames_in_state,
            "started": self._started,
            "scripted_inputs": list(self._scripted_inputs),
            "manual_inputs": list(self._manual_inputs),
            "manual_desired_buttons": sorted(self._manual_desired_buttons),
            "manual_active_buttons": sorted(self._manual_active_buttons),
            "active_input": active_input,
            "input_cooldown_frames": self._input_cooldown_frames,
            "transition_timeout_logged": self._transition_timeout_logged,
        }

    def _restore_runtime_state(self, payload):
        bot_state = payload.get("bot_state", GameState.OVERWORLD.name)
        try:
            self.state = GameState[bot_state]
        except KeyError:
            self.state = GameState.OVERWORLD

        self.frames_in_state = int(payload.get("frames_in_state", 0))
        self._started = bool(payload.get("started", True))
        self._scripted_inputs = deque(
            button for button in payload.get("scripted_inputs", []) if button in BUTTON_MAP
        )
        self._manual_inputs = deque(
            button for button in payload.get("manual_inputs", []) if button in BUTTON_MAP
        )
        self._manual_desired_buttons = {
            button for button in payload.get("manual_desired_buttons", []) if button in BUTTON_MAP
        }
        self._manual_active_buttons = {
            button for button in payload.get("manual_active_buttons", []) if button in BUTTON_MAP
        }
        active_input = payload.get("active_input")
        if active_input and active_input.get("button") in BUTTON_MAP:
            button_name = active_input["button"]
            self._active_input = {
                "button": button_name,
                "release": BUTTON_MAP[button_name][1],
                "held_frames": int(active_input.get("held_frames", 0)),
            }
        else:
            self._active_input = None
        self._input_cooldown_frames = int(payload.get("input_cooldown_frames", 0))
        self._transition_timeout_logged = bool(payload.get("transition_timeout_logged", False))

    def _build_save_filename(self, label=None):
        timestamp = datetime.now().astimezone().strftime("%Y%m%d-%H%M%S")
        base_name = f"{self.game_name}-{timestamp}"
        if label:
            base_name = f"{base_name}-{slugify_name(label)}"

        filename = f"{base_name}{SAVE_STATE_SUFFIX}"
        path = self._ensure_saves_dir() / filename
        suffix = 2
        while path.exists():
            filename = f"{base_name}-{suffix}{SAVE_STATE_SUFFIX}"
            path = self.saves_dir / filename
            suffix += 1
        return path

    def _read_save_metadata(self, path):
        with path.open("rb") as handle:
            magic = handle.readline()
            if magic != SAVE_STATE_MAGIC:
                raise ValueError(f"Unsupported save-state format for '{path.name}'.")
            raw_payload = handle.readline()

        metadata = json.loads(raw_payload.decode("utf-8"))
        metadata["filename"] = path.name
        metadata["size_bytes"] = path.stat().st_size
        metadata["active"] = path.name == self.active_save_filename
        metadata["display_name"] = metadata.get("label") or path.stem
        return metadata

    def list_save_states(self):
        saves_dir = self._ensure_saves_dir()
        records = []
        for path in saves_dir.glob(f"{self.game_name}-*{SAVE_STATE_SUFFIX}"):
            try:
                records.append(self._read_save_metadata(path))
            except (OSError, ValueError, json.JSONDecodeError):
                continue

        records.sort(key=lambda record: record.get("created_at", ""), reverse=True)
        return records

    def save_emulator_state(self, label=None):
        path = self._build_save_filename(label=label.strip() if isinstance(label, str) else None)
        metadata = {
            "version": 1,
            "game_name": self.game_name,
            "label": label.strip() if isinstance(label, str) and label.strip() else None,
            "created_at": datetime.now().astimezone().isoformat(timespec="seconds"),
            "runtime": self._serialize_runtime_state(),
        }

        with path.open("wb") as handle:
            handle.write(SAVE_STATE_MAGIC)
            handle.write(json.dumps(metadata, separators=(",", ":")).encode("utf-8"))
            handle.write(b"\n")
            self.pyboy.save_state(handle)

        self.active_save_filename = path.name
        record = self._read_save_metadata(path)
        self.logger.log_state(f"Saved native emulator snapshot to {path.name}.")
        return record

    def load_emulator_state(self, filename):
        if not isinstance(filename, str) or not filename.endswith(SAVE_STATE_SUFFIX):
            raise ValueError("A valid .state filename is required.")

        path = (self._ensure_saves_dir() / Path(filename).name).resolve()
        saves_root = self.saves_dir.resolve()
        if path.parent != saves_root or not path.is_file():
            raise FileNotFoundError(f"Save state '{filename}' was not found.")

        self.release_manual_inputs()

        with path.open("rb") as handle:
            magic = handle.readline()
            if magic != SAVE_STATE_MAGIC:
                raise ValueError(f"Unsupported save-state format for '{path.name}'.")
            metadata = json.loads(handle.readline().decode("utf-8"))
            self.pyboy.load_state(handle)

        self._restore_runtime_state(metadata.get("runtime", {}))
        self.active_save_filename = path.name
        record = self._read_save_metadata(path)
        self.logger.log_state(f"Loaded native emulator snapshot from {path.name}.")
        return record

    def run(self, max_steps=None):
        steps = 0
        while True:
            self.step()
            steps += 1
            if self.state == GameState.OVERWORLD:
                return
            if max_steps is not None and steps >= max_steps:
                return
