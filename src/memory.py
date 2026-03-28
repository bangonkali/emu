import json
import os


PARTY_MON_STRUCT_LENGTH = 0x2C
POKEDEX_FLAG_BYTES = 19
POKEDEX_TOTAL = 151

PARTY_OFFSETS = {
    "species": 0x00,
    "hp": 0x01,
    "level": 0x21,
    "max_hp": 0x22,
    "attack": 0x24,
    "defense": 0x26,
    "speed": 0x28,
    "special": 0x2A,
    "status": 0x04,
    "exp": 0x0E,
}

STATUS_FLAGS = {
    3: "Poisoned",
    4: "Burned",
    5: "Frozen",
    6: "Paralyzed",
}

class MemoryMap:
    def __init__(self, pyboy, map_path="/app/state/memory_map.json"):
        self.pyboy = pyboy
        with open(map_path, 'r', encoding='utf-8') as f:
            self.map_data = json.load(f)

    def get_address(self, label):
        if label not in self.map_data["addresses"]:
            raise ValueError(f"Label {label} not defined in memory map.")
        return int(self.map_data["addresses"][label]["hex"], 16)

    def read_address(self, address):
        return self.pyboy.memory[address]

    def read_word_at(self, address):
        return 256 * self.pyboy.memory[address] + self.pyboy.memory[address + 1]

    def read_triple_at(self, address):
        return (
            self.pyboy.memory[address] * 65536
            + self.pyboy.memory[address + 1] * 256
            + self.pyboy.memory[address + 2]
        )

    def read_bytes_at(self, address, count):
        return [self.pyboy.memory[address + offset] for offset in range(count)]
            
    def read(self, label):
        """Reads a byte from the PyBoy memory given a label defined in the map."""
        return self.read_address(self.get_address(label))

    def read_word(self, label):
        """Reads a 2-byte big-endian value from PyBoy memory."""
        return self.read_word_at(self.get_address(label))

    def read_bit(self, label, bit):
        """Helper to read a specific bit from a byte."""
        val = self.read(label)
        return (val >> bit) & 1

    def is_in_overworld(self):
        """Determines if the player is fully rendered in the overworld."""
        battle_state = self.read("wBattleState")
        party_count = self.read("wPartyCount")
        
        return battle_state == 0 and party_count > 0 and party_count <= 6

    def get_badges_count(self):
        """Count the number of set bits in the badge flags byte."""
        flags = self.read("wBadgeFlags")
        return bin(flags).count('1')

    def read_bcd(self, val):
        """Decode a BCD-encoded byte into a decimal integer."""
        return 10 * ((val >> 4) & 0x0F) + (val & 0x0F)

    def get_money(self):
        """Read the player's money from 3 BCD-encoded bytes."""
        b1 = self.read("wMoney1")
        b2 = self.read("wMoney2")
        b3 = self.read("wMoney3")
        return self.read_bcd(b1) * 10000 + self.read_bcd(b2) * 100 + self.read_bcd(b3)

    def decode_status(self, status_byte):
        if status_byte & 0b111:
            return "Sleeping"
        for bit, label in STATUS_FLAGS.items():
            if status_byte & (1 << bit):
                return label
        return "Healthy"

    def get_party_member(self, slot):
        if slot < 1 or slot > 6:
            raise ValueError("Party slot must be between 1 and 6.")

        party_base = self.get_address("wPartyMons")
        base = party_base + (slot - 1) * PARTY_MON_STRUCT_LENGTH
        species_id = self.read_address(base + PARTY_OFFSETS["species"])
        if species_id == 0:
            return None

        return {
            "slot": slot,
            "species_id": species_id,
            "level": self.read_address(base + PARTY_OFFSETS["level"]),
            "hp": self.read_word_at(base + PARTY_OFFSETS["hp"]),
            "max_hp": self.read_word_at(base + PARTY_OFFSETS["max_hp"]),
            "attack": self.read_word_at(base + PARTY_OFFSETS["attack"]),
            "defense": self.read_word_at(base + PARTY_OFFSETS["defense"]),
            "speed": self.read_word_at(base + PARTY_OFFSETS["speed"]),
            "special": self.read_word_at(base + PARTY_OFFSETS["special"]),
            "status": self.decode_status(self.read_address(base + PARTY_OFFSETS["status"])),
            "status_code": self.read_address(base + PARTY_OFFSETS["status"]),
            "experience": self.read_triple_at(base + PARTY_OFFSETS["exp"]),
        }

    def _decode_flag_array(self, label):
        base_address = self.get_address(label)
        raw = self.read_bytes_at(base_address, POKEDEX_FLAG_BYTES)
        dex_numbers = []
        for dex_no in range(1, POKEDEX_TOTAL + 1):
            byte_index = (dex_no - 1) // 8
            bit_index = (dex_no - 1) % 8
            if raw[byte_index] & (1 << bit_index):
                dex_numbers.append(dex_no)
        return dex_numbers

    def get_pokedex_progress(self):
        owned = self._decode_flag_array("wPokedexOwned")
        seen = self._decode_flag_array("wPokedexSeen")
        return {
            "total": POKEDEX_TOTAL,
            "owned": owned,
            "seen": seen,
            "owned_count": len(owned),
            "seen_count": len(seen),
        }

    def get_party_info(self):
        """Returns a list of detailed dicts for each party member."""
        count = self.read("wPartyCount")
        count = min(count, 6)
        party = []
        for slot in range(1, count + 1):
            member = self.get_party_member(slot)
            if member:
                party.append(member)
        return party

    def get_full_state(self):
        """Returns a dict of all readable game state for WebSocket broadcast."""
        try:
            map_id = self.read("wMapLevel")
            x = self.read("wXCoord")
            y = self.read("wYCoord")
            party_count = self.read("wPartyCount")
            battle_state = self.read("wBattleState")
            badges = self.get_badges_count()
            money = self.get_money()
            party = self.get_party_info()
            pokedex = self.get_pokedex_progress()
            hp = 0
            max_hp = 0
            if party:
                hp = party[0]["hp"]
                max_hp = party[0]["max_hp"]

            return {
                "map_id": map_id,
                "x": x,
                "y": y,
                "party_count": party_count,
                "battle_state": battle_state,
                "badges": badges,
                "money": money,
                "party": party,
                "lead_hp": hp,
                "lead_max_hp": max_hp,
                "pokedex": pokedex,
                "pokedex_owned_count": pokedex["owned_count"],
                "pokedex_seen_count": pokedex["seen_count"],
                "menu_item": self.read("wCurrentMenuItem"),
                "joy_ignore": self.read("wJoyIgnore"),
            }
        except Exception as e:
            return {"error": str(e)}
