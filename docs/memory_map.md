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
| `wPartyMons` | `0xD16B` | Base address of the first full in-party Pokémon struct. Additional slots are spaced by `0x2C` bytes. |
| `wPokedexOwned` | `0xD2F7` | 19-byte flag array of owned Pokédex entries. Bit 0 of the first byte is Bulbasaur. |
| `wPokedexSeen` | `0xD30A` | 19-byte flag array of seen Pokédex entries. Bit 0 of the first byte is Bulbasaur. |
| `wSentOutPartyIndex` | `0xCC2F` | 0-based index of the player's currently sent-out Pokémon during battle. |
| `wEnemyMon` | `0xCFE5` | Current enemy battle struct used for the active opposing Pokémon. |
| `wBattleMon` | `0xD014` | Current player battle struct used for the active sent-out Pokémon. |
| `wEnemyPartyCount` | `0xD89C` | Total Pokémon on the opposing trainer's team. |
| `wEnemyMons` | `0xD8A4` | Base address of the first enemy party struct. Additional slots are spaced by `0x2C` bytes. |
| `wYCoord` | `0xD361` | Player's Y coordinate on the current map. |
| `wXCoord` | `0xD362` | Player's X coordinate on the current map. |

## Overworld Detection Logic

The `is_in_overworld()` helper combines two checks:

```python
return battle_state == 0 and party_count > 0 and party_count <= 6
```

## Party Struct Reads

The richer dashboard state now reads party data directly from the `wPartyMons` structs rather than only using isolated slot labels. Each slot is `0x2C` bytes long and includes:

- Current HP
- Level
- Status byte
- Current experience
- Calculated battle stats (`Max HP`, `Attack`, `Defense`, `Speed`, `Special`)

This lets the frontend show per-party detail cards without depending on brittle UI scraping.

## Pokédex Flags

The runtime now derives Pokédex progress from the two 19-byte flag arrays in WRAM:

- `wPokedexOwned`
- `wPokedexSeen`

Counts are derived from the bit arrays directly, and the state stream exposes both the totals and the exact owned/seen Dex numbers for the dashboard.

## Battle Telemetry Reads

The dashboard combat module now combines three battle data sources:

- `wBattleMon`: the active sent-out player Pokémon with live in-battle HP and stats.
- `wEnemyMon`: the current enemy battler with live HP and stats.
- `wEnemyMons`: the opposing trainer roster, used to render the full enemy party during trainer battles.

`wSentOutPartyIndex` is used to highlight the currently active member of the player's party. For trainer battles, the runtime also attempts to match `wEnemyMon` against `wEnemyMons` so the active enemy slot can be highlighted in the enemy roster.

> [!WARNING]
> **WRAM Population Hazard**
> `wPartyCount` gets populated while rendering the CONTINUE screen (to display the player's stats). This means the value reads as truthy *before the overworld map has loaded*. The state machine in `bot.py` compensates with a 350-frame deterministic delay after confirming save data — see [State Machine](state_machine.md) for details.

## Sources

All reference repositories are available locally as git submodules under `ref/`:

- **[pret/pokered](https://github.com/pret/pokered)** (`ref/pokered`) — The authoritative disassembly. Variable names (e.g. `wPartyCount`) come directly from `ref/pokered/ram/wram.asm`.
- **[PokemonRedExperiments](https://github.com/PWhiddy/PokemonRedExperiments)** (`ref/PokemonRedExperiments`) — Peter Whidden's RL project, which validated several of these addresses in practice with PyBoy.
- **[Data Crystal RAM Map](https://datacrystal.tcrf.net/wiki/Pok%C3%A9mon_Red/Blue:RAM_map)** — Community-maintained hex address reference (external).
