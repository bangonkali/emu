from PIL import Image

from bot import BUTTON_MAP, GameState, PokemonBot


class FakeScreen:
    def __init__(self):
        self.image = Image.new("RGB", (160, 144), "black")


class FakePyBoy:
    def __init__(self):
        self.tick_count = 0
        self.inputs = []
        self.screen = FakeScreen()

    def tick(self):
        self.tick_count += 1

    def send_input(self, event):
        self.inputs.append(event)


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
    assert bot.inject_input("left") is False


def test_manual_input_uses_eight_frame_hold_and_cooldown():
    pyboy = FakePyBoy()
    memory = FakeMemory()
    logger = FakeLogger()
    bot = PokemonBot(pyboy, memory, logger)
    bot.state = GameState.OVERWORLD

    assert bot.inject_input("left") is True
    assert bot.inject_input("right") is True

    for _ in range(10):
        bot.step()

    assert pyboy.inputs[:2] == [BUTTON_MAP["left"][0], BUTTON_MAP["left"][1]]
    assert BUTTON_MAP["right"][0] not in pyboy.inputs[:2]

    bot.step()

    assert pyboy.inputs[2] == BUTTON_MAP["right"][0]


def test_screen_snapshot_is_png_data_uri():
    bot = PokemonBot(FakePyBoy(), FakeMemory(), FakeLogger())
    payload = bot.get_screen_base64()
    assert payload.startswith("data:image/png;base64,")