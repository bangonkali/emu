import os
from datetime import datetime

class GameLogger:
    def __init__(self, pyboy, state_dir="/app/state"):
        self.pyboy = pyboy
        self.logs_dir = os.path.join(state_dir, "logs")
        self.snapshots_dir = os.path.join(state_dir, "snapshots")
        
        os.makedirs(self.logs_dir, exist_ok=True)
        os.makedirs(self.snapshots_dir, exist_ok=True)
        
        # Create a single central log file for this automation run
        session_time = datetime.now().strftime("%Y%m%d-%H%M%S")
        self.log_file = os.path.join(self.logs_dir, f"{session_time}.log")
        
        self._write_to_log(f"--- Pokémon Game Automation Started at {session_time} ---\n")

    def _write_to_log(self, text):
        with open(self.log_file, "a", encoding="utf-8") as f:
            f.write(text)

    def log_state(self, message):
        """Logs a descriptive English statement based on the memory map state and captures a snapshot."""
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
        
        # Capture the raw PIL Image representation of the screen
        snapshot_path = os.path.join(self.snapshots_dir, f"{timestamp}.png")
        try:
            self.pyboy.screen.image.save(snapshot_path)
            screenshot_status = f"Snapshot '{timestamp}.png' saved."
        except Exception as e:
            screenshot_status = f"Snapshot failed: {e}"

        log_entry = f"[{timestamp}] {message} - {screenshot_status}\n"
        self._write_to_log(log_entry)
        
        # Output to stdout to follow via `docker logs`
        print(log_entry.strip())
