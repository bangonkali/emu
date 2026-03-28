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
    set_byte(pyboy, 0xD31D, 3)
    set_byte(pyboy, 0xD31E, 0x04)
    set_byte(pyboy, 0xD31F, 10)
    set_byte(pyboy, 0xD320, 0x14)
    set_byte(pyboy, 0xD321, 2)
    set_byte(pyboy, 0xD322, 0xC9)
    set_byte(pyboy, 0xD323, 1)
    set_byte(pyboy, 0xD324, 0xFF)

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
    assert state["combat"]["active"] is False
    assert state["combat"]["kind"] == "overworld"
    assert state["inventory"] == {
        "count": 3,
        "capacity": 20,
        "total_quantity": 13,
        "items": [
            {"slot": 1, "item_id": 0x04, "quantity": 10},
            {"slot": 2, "item_id": 0x14, "quantity": 2},
            {"slot": 3, "item_id": 0xC9, "quantity": 1},
        ],
    }
    assert state["pokedex"]["owned"] == [1, 3]
    assert state["pokedex"]["seen"] == [1, 2, 3]
    assert state["pokedex_owned_count"] == 2
    assert state["pokedex_seen_count"] == 3
    assert state["menu_item"] == 1
    assert state["joy_ignore"] == 0


def test_memory_map_stops_bag_read_at_terminator():
    pyboy = FakePyBoy()
    map_file = Path(__file__).resolve().parents[1] / "state" / "memory_map.json"
    memory = MemoryMap(pyboy, str(map_file))

    set_byte(pyboy, 0xD31D, 4)
    set_byte(pyboy, 0xD31E, 0x01)
    set_byte(pyboy, 0xD31F, 3)
    set_byte(pyboy, 0xD320, 0xFF)
    set_byte(pyboy, 0xD321, 99)

    assert memory.get_bag_items() == {
        "count": 1,
        "capacity": 20,
        "total_quantity": 3,
        "items": [
            {"slot": 1, "item_id": 0x01, "quantity": 3},
        ],
    }


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


def test_memory_map_exposes_active_combat_state():
    pyboy = FakePyBoy()
    map_file = Path(__file__).resolve().parents[1] / "state" / "memory_map.json"
    memory = MemoryMap(pyboy, str(map_file))

    set_byte(pyboy, 0xD057, 2)
    set_byte(pyboy, 0xD163, 2)
    set_byte(pyboy, 0xCC2F, 0)

    set_byte(pyboy, 0xD16B, 25)
    set_byte(pyboy, 0xD18C, 36)
    set_byte(pyboy, 0xD16C, 0x00)
    set_byte(pyboy, 0xD16D, 0x96)
    set_byte(pyboy, 0xD18D, 0x00)
    set_byte(pyboy, 0xD18E, 0xC8)

    set_byte(pyboy, 0xD197, 4)
    set_byte(pyboy, 0xD1B8, 20)

    set_byte(pyboy, 0xD014, 25)
    set_byte(pyboy, 0xD015, 0x00)
    set_byte(pyboy, 0xD016, 0x96)
    set_byte(pyboy, 0xD018, 0x00)
    set_byte(pyboy, 0xD022, 36)
    set_byte(pyboy, 0xD023, 0x00)
    set_byte(pyboy, 0xD024, 0xC8)
    set_byte(pyboy, 0xD025, 0x00)
    set_byte(pyboy, 0xD026, 0x78)
    set_byte(pyboy, 0xD027, 0x00)
    set_byte(pyboy, 0xD028, 0x64)
    set_byte(pyboy, 0xD029, 0x00)
    set_byte(pyboy, 0xD02A, 0x82)
    set_byte(pyboy, 0xD02B, 0x00)
    set_byte(pyboy, 0xD02C, 0x73)

    set_byte(pyboy, 0xCFE5, 133)
    set_byte(pyboy, 0xCFE6, 0x00)
    set_byte(pyboy, 0xCFE7, 0x48)
    set_byte(pyboy, 0xCFE9, 0x00)
    set_byte(pyboy, 0xCFF3, 18)
    set_byte(pyboy, 0xCFF4, 0x00)
    set_byte(pyboy, 0xCFF5, 0x5A)
    set_byte(pyboy, 0xCFF6, 0x00)
    set_byte(pyboy, 0xCFF7, 0x37)
    set_byte(pyboy, 0xCFF8, 0x00)
    set_byte(pyboy, 0xCFF9, 0x31)
    set_byte(pyboy, 0xCFFA, 0x00)
    set_byte(pyboy, 0xCFFB, 0x3C)
    set_byte(pyboy, 0xCFFC, 0x00)
    set_byte(pyboy, 0xCFFD, 0x41)

    set_byte(pyboy, 0xD89C, 2)
    set_byte(pyboy, 0xD8A4, 133)
    set_byte(pyboy, 0xD8A5, 0x00)
    set_byte(pyboy, 0xD8A6, 0x48)
    set_byte(pyboy, 0xD8A8, 0x00)
    set_byte(pyboy, 0xD8C5, 18)
    set_byte(pyboy, 0xD8C6, 0x00)
    set_byte(pyboy, 0xD8C7, 0x5A)
    set_byte(pyboy, 0xD8C8, 0x00)
    set_byte(pyboy, 0xD8C9, 0x37)
    set_byte(pyboy, 0xD8CA, 0x00)
    set_byte(pyboy, 0xD8CB, 0x31)
    set_byte(pyboy, 0xD8CC, 0x00)
    set_byte(pyboy, 0xD8CD, 0x3C)
    set_byte(pyboy, 0xD8CE, 0x00)
    set_byte(pyboy, 0xD8CF, 0x41)

    set_byte(pyboy, 0xD8D0, 19)
    set_byte(pyboy, 0xD8D1, 0x00)
    set_byte(pyboy, 0xD8D2, 0x1E)
    set_byte(pyboy, 0xD8D4, 0x00)
    set_byte(pyboy, 0xD8F1, 12)
    set_byte(pyboy, 0xD8F2, 0x00)
    set_byte(pyboy, 0xD8F3, 0x30)

    state = memory.get_full_state()
    combat = state["combat"]

    assert combat["active"] is True
    assert combat["kind"] == "trainer"
    assert combat["player_active_slot"] == 1
    assert combat["player_active"]["species_id"] == 25
    assert combat["enemy_active"]["species_id"] == 133
    assert combat["enemy_active_slot"] == 1
    assert combat["enemy_party_count"] == 2
    assert [member["species_id"] for member in combat["enemy_party"]] == [133, 19]