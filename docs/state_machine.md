# State Machine Architecture

The bot is driven by a `GameState` Enum defined in `src/bot.py`. Each tick of the emulator advances one frame (`pyboy.tick()`), after which the current state handler evaluates whether to transition.

## State Flow

```
BOOTING ──(240 frames)──► TITLE_SCREEN ──(press START)──► MAIN_MENU
                                                              │
                                                         (180 frames,
                                                          press A)
                                                              │
                                                              ▼
                                                       SAVE_FILE_STATS
                                                              │
                                                         (180 frames,
                                                          press A)
                                                              │
                                                              ▼
                                                  TRANSITION_TO_OVERWORLD
                                                              │
                                                         (350 frames +
                                                     memory confirmation)
                                                              │
                                                              ▼
                                                          OVERWORLD
                                                       (bot halts)
```

## State Descriptions

### `BOOTING`
**Duration:** 240 frames (~4 seconds at 60 FPS)  
**Action:** None — the emulator ticks through the Game Freak logo and Nidorino-vs-Gengar intro animation.  
**Exit condition:** Frame counter reaches 240.

### `TITLE_SCREEN`
**Duration:** ~60 frames  
**Action:** Sends `START` button input immediately upon entry.  
**Exit condition:** Frame counter reaches 60 (enough time for the menu to begin drawing).

### `MAIN_MENU`
**Duration:** 180 frames (~3 seconds)  
**Action:** Waits for the menu text to fully render in VRAM, then reads `wCurrentMenuItem` to confirm the cursor is on CONTINUE, and presses `A`.  
**Exit condition:** Frame counter reaches 180.

### `SAVE_FILE_STATS`
**Duration:** 180 frames (~3 seconds)  
**Action:** The engine displays the player's name, badges, and Pokédex count. Waits for the stats box to render, then presses `A` to begin loading the save.  
**Exit condition:** Frame counter reaches 180.

> [!WARNING]
> `wPartyCount` is populated during this state — not after loading the overworld. Using it as an overworld indicator here would be a false positive. See [Memory Map](memory_map.md) for details.

### `TRANSITION_TO_OVERWORLD`
**Duration:** 350+ frames (~6 seconds)  
**Action:** The screen fades to black while the engine loads the map, tile data, and sprite objects. The bot waits deterministically, then polls `is_in_overworld()`.  
**Exit condition:** Frame counter ≥ 350 AND `is_in_overworld()` returns `True`.  
**Fallback:** If memory check fails, presses `A` every 60 frames to dismiss residual dialog. Times out at 6000 frames with an error log.

### `OVERWORLD`
**Action:** The `while` loop breaks. The bot's final screenshot is captured by the `transition_to()` call that enters this state.  
**Termination:** `bot.run()` returns, and `main.py` calls `pyboy.stop()`.

## The WRAM vs Visual Rendering Desync Problem

During early experimentation, a critical flaw was discovered: **WRAM evaluation resolves faster than the Game Boy's physical graphics render loop.**

When the player selects CONTINUE from the main menu, the engine instantly allocates WRAM for map entities. PyBoy's `memory[]` reflects this immediately. However, the LCD screen is still fading through hundreds of VBLANK intervals before the overworld is actually visible.

If a snapshot is captured purely based on a positive WRAM check, the resulting `.png` will show a black screen, a transitional artifact, or even the frozen Main Menu.

### The Solution: Deterministic Frame Delays

```python
elif self.state == GameState.TRANSITION_TO_OVERWORLD:
    if self.frames_in_state >= 350:
        if self.memory.is_in_overworld():
            # Safe to screenshot — visual rendering has caught up
```

The 350-frame delay guarantees the LCD fade subroutines have finished rastering the overworld tiles before any screenshot is taken.

## Adding New States

To extend the state machine (e.g. for battle handling or menu navigation):

1. Add a new member to the `GameState` Enum.
2. Add an `elif self.state == GameState.YOUR_STATE:` block in `run()`.
3. Use `self.transition_to(next_state, "log message")` to move forward — this automatically logs + screenshots.
