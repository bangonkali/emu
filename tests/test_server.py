import asyncio

from websockets.datastructures import Headers
from websockets.http11 import Request

from server import _resolve_web_path, load_map_names, process_request, resolve_map_name


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
    assert b"Pokemon Blue Debug Console" in response.body


def test_process_request_returns_404_for_missing_file():
    response = asyncio.run(process_request(None, Request(path="/missing-file.txt", headers=Headers())))
    assert response.status_code == 404
    assert response.body == b"Not Found"