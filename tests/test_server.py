import asyncio

from websockets.datastructures import Headers
from websockets.http11 import Request

from server import (
    InputAuthority,
    _resolve_web_path,
    build_audio_config_payload,
    build_state_payload,
    load_map_names,
    process_request,
    resolve_map_name,
)


def test_map_names_load_from_web_asset():
    map_names = load_map_names()
    assert map_names[0] == "Pallet Town"
    assert map_names[1] == "Viridian City"


def test_resolve_map_name_falls_back_to_unknown():
    assert resolve_map_name({0: "Pallet Town"}, 0) == "Pallet Town"
    assert resolve_map_name({}, 999) == "Unknown"


def test_resolve_web_path_blocks_parent_traversal():
    assert _resolve_web_path("/../README.md") is None


def test_process_request_serves_dashboard_index():
    response = asyncio.run(process_request(None, Request(path="/", headers=Headers())))
    assert response.status_code == 200
    assert response.headers["Content-Type"] == "text/html"
    assert b"<div id=\"app\"></div>" in response.body


def test_process_request_returns_404_for_missing_file():
    response = asyncio.run(process_request(None, Request(path="/missing-file.txt", headers=Headers())))
    assert response.status_code == 404
    assert response.body == b"Not Found"


def test_input_authority_tracks_latest_direction_and_buttons():
    authority = InputAuthority()
    authority.apply_event("client-a", "left", True, 1)
    authority.apply_event("client-b", "up", True, 1)
    authority.apply_event("client-a", "a", True, 2)

    assert authority.resolve_buttons() == {"up", "a"}

    authority.apply_event("client-b", "up", False, 2)
    assert authority.resolve_buttons() == {"left", "a"}


def test_input_authority_ignores_stale_sequences_and_clears_disconnected_clients():
    authority = InputAuthority()
    authority.apply_snapshot("client-a", ["left"], 3)
    authority.apply_snapshot("client-a", ["right"], 2)
    assert authority.resolve_buttons() == {"left"}

    authority.remove_client("client-a")
    assert authority.resolve_buttons() == set()


def test_input_authority_clear_removes_all_active_buttons():
    authority = InputAuthority()
    authority.apply_snapshot("client-a", ["left", "a"], 1)
    authority.apply_snapshot("client-b", ["right"], 1)

    authority.clear()

    assert authority.resolve_buttons() == set()


class FakeBot:
    def get_state_snapshot(self):
        return {"map_id": 0, "x": 4, "y": 9}

    def get_screen_base64(self):
        return "data:image/png;base64,AAAA"

    def get_audio_config(self):
        return {
            "enabled": True,
            "sample_rate": 48000,
            "channels": 2,
            "format": "s8",
            "interleaved": True,
            "playback_speed": "1x",
        }


def test_build_state_payload_includes_map_name_speed_and_frame():
    payload = build_state_payload(FakeBot(), ["2x"], {0: "Pallet Town"}, 88)

    assert payload["type"] == "state"
    assert payload["map_name"] == "Pallet Town"
    assert payload["speed"] == "2x"
    assert payload["frame"] == 88
    assert payload["screen"].startswith("data:image/png;base64,")


def test_build_audio_config_payload_uses_bot_audio_config():
    payload = build_audio_config_payload(FakeBot())

    assert payload == {
        "type": "audio_config",
        "enabled": True,
        "sample_rate": 48000,
        "channels": 2,
        "format": "s8",
        "interleaved": True,
        "playback_speed": "1x",
    }