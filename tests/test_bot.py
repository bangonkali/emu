from PIL import Image

from bot import BUTTON_MAP, GameState, PokemonBot, slugify_name


class FakeScreen:
    def __init__(self):
        self.image = Image.new("RGB", (160, 144), "black")


class FakePyBoy:
    def __init__(self):
        self.tick_count = 0
        self.inputs = []
        self.screen = FakeScreen()
        self.saved_state_payload = b"FAKE_PYBOY_STATE"
        self.loaded_state_payload = None

    def tick(self):
        self.tick_count += 1

    def send_input(self, event):
        self.inputs.append(event)

    def save_state(self, file_like_object):
        file_like_object.write(self.saved_state_payload)

    def load_state(self, file_like_object):
        self.loaded_state_payload = file_like_object.read()


class FakeMemory:
    def __init__(self):
        self.values = {
            "wMapLevel": 0,
            "wCurrentMenuItem": 0,
            "wXCoord": 5,
            "wYCoord": 9,
            "wPartyCount": 1,
            "wBattleState": 0,
        }
        self.overworld_ready = False

    def read(self, label):
        return self.values[label]

    def is_in_overworld(self):
        return self.overworld_ready

    def get_full_state(self):
        return {
            "map_id": self.values["wMapLevel"],
            "x": self.values["wXCoord"],
            "y": self.values["wYCoord"],
            "party_count": self.values["wPartyCount"],
            "badges": 0,
            "money": 0,
            "lead_hp": 0,
            "lead_max_hp": 0,
        }


class FakeLogger:
    def __init__(self):
        self.entries = []

    def log_state(self, message):
        self.entries.append(message)

    def get_recent_logs(self):
        return []


def test_bot_reaches_title_screen_after_boot_frames():
    pyboy = FakePyBoy()
    memory = FakeMemory()
    logger = FakeLogger()
    bot = PokemonBot(pyboy, memory, logger)

    for _ in range(240):
        bot.step()

    assert bot.state == GameState.TITLE_SCREEN
    assert bot.frames_in_state == 0
    assert logger.entries[0] == "Bot initialized. Starting deterministic state machine evaluation."
    assert "Proceeding to Title Screen" in logger.entries[1]


def test_manual_input_is_ignored_before_overworld():
    bot = PokemonBot(FakePyBoy(), FakeMemory(), FakeLogger())
    assert bot.set_manual_buttons({"left"}) is False


def test_manual_input_presses_and_releases_with_state_sync():
    pyboy = FakePyBoy()
    memory = FakeMemory()
    logger = FakeLogger()
    bot = PokemonBot(pyboy, memory, logger)
    bot.state = GameState.OVERWORLD

    assert bot.set_manual_buttons({"left"}) is True
    bot.step()
    assert pyboy.inputs[0] == BUTTON_MAP["left"][0]
    assert bot.get_state_snapshot()["active_inputs"] == ["left"]

    bot.set_manual_buttons(set())
    bot.step()
    assert pyboy.inputs[1] == BUTTON_MAP["left"][1]
    assert bot.get_state_snapshot()["active_inputs"] == []


def test_manual_input_keeps_latest_direction_when_multiple_are_requested():
    pyboy = FakePyBoy()
    bot = PokemonBot(pyboy, FakeMemory(), FakeLogger())
    bot.state = GameState.OVERWORLD

    bot.set_manual_buttons({"left", "right"})
    bot.step()

    assert pyboy.inputs == [BUTTON_MAP["right"][0]]


def test_screen_snapshot_is_png_data_uri():
    bot = PokemonBot(FakePyBoy(), FakeMemory(), FakeLogger())
    payload = bot.get_screen_base64()
    assert payload.startswith("data:image/png;base64,")


def test_slugify_name_normalizes_game_and_label_names():
    assert slugify_name("Pokémon - Blue") == "pokemon-blue"
    assert slugify_name("  Elite Four Prep!  ") == "elite-four-prep"


def test_bot_can_save_and_list_native_snapshots(tmp_path):
    pyboy = FakePyBoy()
    bot = PokemonBot(pyboy, FakeMemory(), FakeLogger(), saves_dir=tmp_path, game_name="Pokémon - Blue")

    record = bot.save_emulator_state("Route 2 Start")
    saves = bot.list_save_states()

    assert record["filename"].startswith("pokemon-blue-")
    assert record["filename"].endswith(".state")
    assert record["label"] == "Route 2 Start"
    assert record["active"] is True
    assert len(saves) == 1
    assert saves[0]["filename"] == record["filename"]
    assert saves[0]["display_name"] == "Route 2 Start"


def test_bot_loads_snapshot_and_restores_runtime_metadata(tmp_path):
    pyboy = FakePyBoy()
    bot = PokemonBot(pyboy, FakeMemory(), FakeLogger(), saves_dir=tmp_path, game_name="Pokemon Blue")
    bot.state = GameState.OVERWORLD
    bot.frames_in_state = 123
    bot._started = True
    bot._manual_desired_buttons = {"left"}
    bot._manual_active_buttons = {"left"}

    record = bot.save_emulator_state("Checkpoint")

    bot.state = GameState.BOOTING
    bot.frames_in_state = 0
    bot._manual_desired_buttons = set()
    bot._manual_active_buttons = set()

    loaded = bot.load_emulator_state(record["filename"])

    assert loaded["filename"] == record["filename"]
    assert bot.state == GameState.OVERWORLD
    assert bot.frames_in_state == 123
    assert bot.active_save_filename == record["filename"]
    assert pyboy.loaded_state_payload == pyboy.saved_state_payload