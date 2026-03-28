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

    def read_bit(self, label, bit):
        """Helper to read a specific bit from a byte."""
        val = self.read(label)
        return (val >> bit) & 1

    def is_in_overworld(self):
        """Determines if the player is fully rendered in the overworld."""
        battle_state = self.read("wBattleState")
        party_count = self.read("wPartyCount")
        
        return battle_state == 0 and party_count > 0 and party_count <= 6
