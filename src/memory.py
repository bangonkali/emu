import json
import os

class MemoryMap:
    def __init__(self, pyboy, map_path="/app/state/memory_map.json"):
        self.pyboy = pyboy
        with open(map_path, 'r', encoding='utf-8') as f:
            self.map_data = json.load(f)
            
    def read(self, label):
        """Reads a byte from the PyBoy memory given a label defined in the map."""
        if label not in self.map_data["addresses"]:
            raise ValueError(f"Label {label} not defined in memory map.")
            
        hex_addr = self.map_data["addresses"][label]["hex"]
        addr = int(hex_addr, 16)
        
        # We read a single byte (size_bytes: 1) as defined in our map.
        return self.pyboy.memory[addr]

    def read_word(self, label):
        """Reads a 2-byte big-endian value from PyBoy memory."""
        if label not in self.map_data["addresses"]:
            raise ValueError(f"Label {label} not defined in memory map.")
        hex_addr = self.map_data["addresses"][label]["hex"]
        addr = int(hex_addr, 16)
        return 256 * self.pyboy.memory[addr] + self.pyboy.memory[addr + 1]

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

    def get_party_info(self):
        """Returns a list of dicts with species and level for each party member."""
        count = self.read("wPartyCount")
        count = min(count, 6)
        party = []
        species_labels = [f"wPartyMon{i}Species" for i in range(1, 7)]
        level_labels = [f"wPartyMon{i}Level" for i in range(1, 7)]
        for i in range(count):
            party.append({
                "slot": i + 1,
                "species_id": self.read(species_labels[i]),
                "level": self.read(level_labels[i]),
            })
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
            hp = 0
            max_hp = 0
            try:
                hp = self.read_word("wPartyMon1HP")
                max_hp = self.read_word("wPartyMon1MaxHP")
            except Exception:
                pass

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
                "menu_item": self.read("wCurrentMenuItem"),
                "joy_ignore": self.read("wJoyIgnore"),
            }
        except Exception as e:
            return {"error": str(e)}
