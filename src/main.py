import os
import shutil
import glob
from pyboy import PyBoy

from memory import MemoryMap
from logger import GameLogger
from bot import PokemonBot

def main():
    state_dir = os.environ.get("STATE_DIR", os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "state"))
    
    if not os.path.exists(state_dir):
        print(f"Error: Directory '{state_dir}' does not exist.")
        return

    # Ensure memory map exists in the expected location
    map_file = os.path.join(state_dir, "memory_map.json")
    if not os.path.exists(map_file):
        print(f"Error: Memory map JSON '{map_file}' not found. Please ensure it is present.")
        return

    gb_files = glob.glob(os.path.join(state_dir, "*.gb"))
    sav_files = glob.glob(os.path.join(state_dir, "*.sav"))
    
    if not gb_files or not sav_files:
        print(f"Error: Missing ROM (.gb) or Save (.sav) files in '{state_dir}'.")
        return

    rom_path = gb_files[0]
    sav_path = sav_files[0]
    
    # Establish PyBoy-readable SRAM copy
    # PyBoy 2.x expects the RAM file to be named `<rom_name>.gb.ram`
    ram_path = rom_path + ".ram"
    try:
        shutil.copy2(sav_path, ram_path)
    except Exception as e:
        print(f"Error copying save file (.sav -> .ram): {e}")
        return
        
    try:
        pyboy = PyBoy(rom_path, window="null")
        print("PyBoy emulator initialized headless successfully.")
    except Exception as e:
        print(f"Critical error initializing PyBoy: {e}")
        return

    memory = MemoryMap(pyboy, map_file)
    logger = GameLogger(pyboy, state_dir)
    bot = PokemonBot(pyboy, memory, logger)
    
    try:
        bot.run()
    except Exception as e:
        logger.log_state(f"Bot encountered error during runtime execution: {e}")
    finally:
        pyboy.stop()
        print("Emulation terminated.")

if __name__ == "__main__":
    main()
