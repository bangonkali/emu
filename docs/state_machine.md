# State Machine Architecture

The bot is driven by a `GameState` Enum defined in `src/bot.py`. The runtime now uses a true single-frame `step()` method: each call processes scheduled input events, advances PyBoy by one frame, and then evaluates state transitions.

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
                                                     (scripted boot halts,
                                                      emulator keeps ticking)
```

## State Descriptions

### `BOOTING`
**Duration:** 240 frames (~4 seconds at 60 FPS)  
**Action:** None — the emulator ticks through the Game Freak logo and Nidorino-vs-Gengar intro animation.  
**Exit condition:** Frame counter reaches 240.

### `TITLE_SCREEN`
**Duration:** ~60 frames  
**Action:** Queues a `START` button input immediately upon entry. The input scheduler holds the button for 8 frames, releases it, then waits 1 cooldown frame before any other queued input can begin.  
**Exit condition:** Frame counter reaches 60 (enough time for the menu to begin drawing).

### `MAIN_MENU`
**Duration:** 180 frames (~3 seconds)  
**Action:** Waits for the menu text to fully render in VRAM, then reads `wCurrentMenuItem` to confirm the cursor is on CONTINUE, and queues `A`.  
**Exit condition:** Frame counter reaches 180.

### `SAVE_FILE_STATS`
**Duration:** 180 frames (~3 seconds)  
**Action:** The engine displays the player's name, badges, and Pokédex count. Waits for the stats box to render, then queues `A` to begin loading the save.  
**Exit condition:** Frame counter reaches 180.

> [!WARNING]
> `wPartyCount` is populated during this state — not after loading the overworld. Using it as an overworld indicator here would be a false positive. See [Memory Map](memory_map.md) for details.

### `TRANSITION_TO_OVERWORLD`
**Duration:** 350+ frames (~6 seconds)  
**Action:** The screen fades to black while the engine loads the map, tile data, and sprite objects. The bot waits deterministically, then polls `is_in_overworld()`.  
**Exit condition:** Frame counter ≥ 350 AND `is_in_overworld()` returns `True`.  
**Fallback:** If memory check fails, queues `A` every 60 frames to dismiss residual dialog. A timeout warning is logged once after 6000 frames.

### `OVERWORLD`
**Action:** The scripted boot flow stops. Browser-originated inputs are accepted only in this state, and they use the same 8-frame press / 1-frame cooldown scheduler as the scripted inputs.  
**Termination:** The emulator no longer stops on entry to `OVERWORLD`. It continues ticking under the async server runtime until the process exits.

## Interactive Input Layer

The follow-up runtime adds a second control path on top of the scripted boot scheduler:

1. Scripted inputs still use the single active press slot during boot.
2. Once the bot reaches `OVERWORLD`, the server drives a held-button state set instead of one-shot directional taps.
3. Each frame, the bot compares the desired held buttons from the server with the buttons currently pressed in the emulator and sends only the needed press/release events.

This split keeps boot deterministic while making walking controls behave like a continuous hold rather than a tap queue.

## Input Scheduling

The old blocking `press_button()` helper advanced multiple frames internally. That made it awkward to coordinate WebSocket polling, speed throttling, and interactive controls. The runtime now keeps a queue of pending inputs and an active press slot:

1. A button press is sent before a frame tick.
2. The press stays active for 8 ticks.
3. The matching release event is sent.
4. The runtime waits 1 extra cooldown frame before starting another input.

This mirrors the release timing used in `ref/PokemonRedExperiments/baselines/red_gym_env.py` while preserving a strict one-frame `step()` contract.

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
2. Add an `elif self.state == GameState.YOUR_STATE:` branch in `step()`.
3. Queue scripted button input through the bot's scheduler rather than ticking inside helper methods.
4. Use `self.transition_to(next_state, "log message")` to move forward — this automatically logs + screenshots.
