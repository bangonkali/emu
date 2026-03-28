# Memory Mapping

The bot avoids brittle GUI interactions like Optical Character Recognition (OCR) by acting as an integrated RAM parser.

By compiling reversing data from the [pret/pokered](https://github.com/pret/pokered) Game Boy disassembly and [Data Crystal](https://datacrystal.tcrf.net/wiki/Pok%C3%A9mon_Red/Blue:RAM_map), we've structured a `state/memory_map.json` that hooks physical memory addresses natively out of the PyBoy emulator process.

## How It Works

The `src/memory.py` module loads `state/memory_map.json` at startup and provides a label-based API so the rest of the codebase never touches raw hex:

```python
memory = MemoryMap(pyboy, "state/memory_map.json")
map_id = memory.read("wMapLevel")       # Returns the byte at 0xD35E
in_ow  = memory.is_in_overworld()       # Composite check across multiple addresses
```

## Address Reference

All addresses below are single-byte reads from WRAM.

| Label | Address | Purpose |
|-------|---------|---------|
| `wMapLevel` | `0xD35E` | Current map ID. `0x00` = Pallet Town. Valid once the overworld engine has loaded. |
| `wCurrentMenuItem` | `0xCC26` | Cursor position in menus (0 = topmost item). On the main menu with a save file present, `0` = CONTINUE. |
| `wJoyIgnore` | `0xCC29` | Bitmask disabling joypad input during cutscenes/movies. `0x00` = all input accepted. |
| `wBattleState` | `0xD057` | Battle type. `0` = Overworld, `1` = Wild, `2` = Trainer, `3` = Safari Zone. |
| `wPartyCount` | `0xD163` | Number of Pokémon in the party (1–6). Non-zero confirms save data has been loaded into WRAM. |
| `wYCoord` | `0xD361` | Player's Y coordinate on the current map. |
| `wXCoord` | `0xD362` | Player's X coordinate on the current map. |

## Overworld Detection Logic

The `is_in_overworld()` helper combines two checks:

```python
return battle_state == 0 and party_count > 0 and party_count <= 6
```

> [!WARNING]
> **WRAM Population Hazard**
> `wPartyCount` gets populated while rendering the CONTINUE screen (to display the player's stats). This means the value reads as truthy *before the overworld map has loaded*. The state machine in `bot.py` compensates with a 350-frame deterministic delay after confirming save data — see [State Machine](state_machine.md) for details.

## Sources

All reference repositories are available locally as git submodules under `ref/`:

- **[pret/pokered](https://github.com/pret/pokered)** (`ref/pokered`) — The authoritative disassembly. Variable names (e.g. `wPartyCount`) come directly from `ref/pokered/ram/wram.asm`.
- **[PokemonRedExperiments](https://github.com/PWhiddy/PokemonRedExperiments)** (`ref/PokemonRedExperiments`) — Peter Whidden's RL project, which validated several of these addresses in practice with PyBoy.
- **[Data Crystal RAM Map](https://datacrystal.tcrf.net/wiki/Pok%C3%A9mon_Red/Blue:RAM_map)** — Community-maintained hex address reference (external).
