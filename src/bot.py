import base64
import io
from collections import deque
from enum import Enum, auto

from pyboy.utils import WindowEvent


INPUT_HOLD_FRAMES = 8
POST_RELEASE_COOLDOWN_FRAMES = 1

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


class PokemonBot:
    def __init__(self, pyboy, memory, logger):
        self.pyboy = pyboy
        self.memory = memory
        self.logger = logger
        self.state = GameState.BOOTING
        self.frames_in_state = 0
        self._started = False
        self._scripted_inputs = deque()
        self._manual_inputs = deque()
        self._active_input = None
        self._input_cooldown_frames = 0
        self._transition_timeout_logged = False

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

    def get_state_snapshot(self):
        snapshot = {
            "state": self.state.name,
            "frames_in_state": self.frames_in_state,
        }
        snapshot.update(self.memory.get_full_state())
        return snapshot

    def get_screen_base64(self):
        image_buffer = io.BytesIO()
        self.pyboy.screen.image.save(image_buffer, format="PNG")
        payload = base64.b64encode(image_buffer.getvalue()).decode("ascii")
        return f"data:image/png;base64,{payload}"

    def run(self, max_steps=None):
        steps = 0
        while True:
            self.step()
            steps += 1
            if self.state == GameState.OVERWORLD:
                return
            if max_steps is not None and steps >= max_steps:
                return
