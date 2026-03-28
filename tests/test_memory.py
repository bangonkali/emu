from pathlib import Path

from memory import MemoryMap


class FakePyBoy:
    def __init__(self):
        self.memory = [0] * 0x10000


def set_byte(pyboy, address, value):
    pyboy.memory[address] = value


def test_memory_map_decodes_full_state():
    pyboy = FakePyBoy()
    map_file = Path(__file__).resolve().parents[1] / "state" / "memory_map.json"
    memory = MemoryMap(pyboy, str(map_file))

    set_byte(pyboy, 0xD35E, 0x00)
    set_byte(pyboy, 0xD362, 12)
    set_byte(pyboy, 0xD361, 7)
    set_byte(pyboy, 0xD163, 2)
    set_byte(pyboy, 0xD057, 0)
    set_byte(pyboy, 0xD356, 0b00101101)
    set_byte(pyboy, 0xD347, 0x12)
    set_byte(pyboy, 0xD348, 0x34)
    set_byte(pyboy, 0xD349, 0x56)
    set_byte(pyboy, 0xD164, 25)
    set_byte(pyboy, 0xD165, 4)
    set_byte(pyboy, 0xD16B, 25)
    set_byte(pyboy, 0xD197, 4)
    set_byte(pyboy, 0xD18C, 15)
    set_byte(pyboy, 0xD198, 0x01)
    set_byte(pyboy, 0xD199, 0xC2)
    set_byte(pyboy, 0xD18D, 0x02)
    set_byte(pyboy, 0xD18E, 0x58)
    set_byte(pyboy, 0xD18F, 0x00)
    set_byte(pyboy, 0xD190, 0x64)
    set_byte(pyboy, 0xD191, 0x00)
    set_byte(pyboy, 0xD192, 0x5A)
    set_byte(pyboy, 0xD193, 0x00)
    set_byte(pyboy, 0xD194, 0x5C)
    set_byte(pyboy, 0xD195, 0x00)
    set_byte(pyboy, 0xD196, 0x60)
    set_byte(pyboy, 0xD1B8, 8)
    set_byte(pyboy, 0xD16C, 0x01)
    set_byte(pyboy, 0xD16D, 0xF4)
    set_byte(pyboy, 0xCC26, 1)
    set_byte(pyboy, 0xCC29, 0)
    set_byte(pyboy, 0xD2F7, 0b00000101)
    set_byte(pyboy, 0xD30A, 0b00000111)

    state = memory.get_full_state()

    assert memory.read_word("wPartyMon1HP") == 500
    assert memory.get_badges_count() == 4
    assert memory.get_money() == 123456
    assert state["map_id"] == 0
    assert state["x"] == 12
    assert state["y"] == 7
    assert state["party_count"] == 2
    assert state["party"] == [
        {
            "slot": 1,
            "species_id": 25,
            "level": 15,
            "hp": 500,
            "max_hp": 600,
            "attack": 100,
            "defense": 90,
            "speed": 92,
            "special": 96,
            "status": "Healthy",
            "status_code": 0,
            "experience": 0,
        },
        {
            "slot": 2,
            "species_id": 4,
            "level": 8,
            "hp": 450,
            "max_hp": 0,
            "attack": 0,
            "defense": 0,
            "speed": 0,
            "special": 0,
            "status": "Healthy",
            "status_code": 0,
            "experience": 0,
        },
    ]
    assert state["lead_hp"] == 500
    assert state["lead_max_hp"] == 600
    assert state["pokedex"]["owned"] == [1, 3]
    assert state["pokedex"]["seen"] == [1, 2, 3]
    assert state["pokedex_owned_count"] == 2
    assert state["pokedex_seen_count"] == 3
    assert state["menu_item"] == 1
    assert state["joy_ignore"] == 0


def test_is_in_overworld_validates_party_and_battle_state():
    pyboy = FakePyBoy()
    map_file = Path(__file__).resolve().parents[1] / "state" / "memory_map.json"
    memory = MemoryMap(pyboy, str(map_file))

    set_byte(pyboy, 0xD057, 0)
    set_byte(pyboy, 0xD163, 3)
    assert memory.is_in_overworld() is True

    set_byte(pyboy, 0xD163, 0)
    assert memory.is_in_overworld() is False

    set_byte(pyboy, 0xD163, 3)
    set_byte(pyboy, 0xD057, 1)
    assert memory.is_in_overworld() is False