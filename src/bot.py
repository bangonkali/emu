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

            if self.state == GameState.BOOTING:
                # Wait roughly 4 seconds (240 ticks) for the initial intro to bypass
                if self.frames_in_state >= 240:
                    map_id = self.memory.read("wMapLevel")
                    self.transition_to(
                        GameState.TITLE_SCREEN, 
                        f"Boot sequence presumed finished. Map ID reads 0x{map_id:X}. Proceeding to Title Screen."
                    )
            
            elif self.state == GameState.TITLE_SCREEN:
                # Instantly press START, waiting ~60 frames for Main Menu to render
                self.press_button(WindowEvent.PRESS_BUTTON_START)
                if self.frames_in_state >= 60:
                    self.transition_to(
                        GameState.MAIN_MENU, 
                        "Sent START button input. Awaiting Main Menu generation in WRAM."
                    )
                    
            elif self.state == GameState.MAIN_MENU:
                # Once menu draws, WRAM populates the cursor index
                if self.frames_in_state >= 60 * 3:
                    menu_cursor = self.memory.read("wCurrentMenuItem")
                    self.press_button(WindowEvent.PRESS_BUTTON_A)
                    self.transition_to(
                        GameState.SAVE_FILE_STATS, 
                        f"Main Menu loaded (Cursor: {menu_cursor}). Pressed 'A' on CONTINUE prompt."
                    )

            elif self.state == GameState.SAVE_FILE_STATS:
                # The "Continue" save file stats (Player Name, Time) populate wPartyCount before we even enter the overworld!
                if self.frames_in_state >= 60 * 3:
                    self.press_button(WindowEvent.PRESS_BUTTON_A)
                    self.transition_to(
                        GameState.TRANSITION_TO_OVERWORLD, 
                        "Confirmed save loading. Transitioning to Overworld execution engine."
                    )

            elif self.state == GameState.TRANSITION_TO_OVERWORLD:
                 # During the fade-to-black, MapLevel and Coords populate instantly, but the VBLANK fade takes time.
                 # Wait deterministically to guarantee the screen renderer completes the visual fade before screenshotting.
                 if self.frames_in_state >= 350:
                     if self.memory.is_in_overworld():
                         x_coord = self.memory.read("wXCoord")
                         y_coord = self.memory.read("wYCoord")
                         map_id = self.memory.read("wMapLevel")
                         
                         self.transition_to(
                             GameState.OVERWORLD, 
                             f"Overworld natively rendered! Player actively waiting at X:{x_coord}, Y:{y_coord} on Map ID: 0x{map_id:02X}."
                         )
                         return
                     else:
                        # Fallback spam A if a dialog box persisted somehow
                        if self.frames_in_state % 60 == 0:
                            self.press_button(WindowEvent.PRESS_BUTTON_A)
                            
                 if self.frames_in_state > 6000:
                     p_count = self.memory.read("wPartyCount")
                     b_state = self.memory.read("wBattleState")
                     self.logger.log_state(f"Warning: State Machine timeout during Overworld Transition (Party: {p_count}, Battle: {b_state}).")
                     return
