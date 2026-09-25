import pytest
from fastapi.testclient import TestClient
from PIL import Image

from parhelion.api.app import create_app
from test_video import FakeMedia

PID = "2026-09-24-demo"


@pytest.fixture
def client(root, monkeypatch, tmp_path):
    monkeypatch.setenv("FAL_KEY", "k")
    provider = FakeMedia(tmp_path)
    c = TestClient(create_app(root, provider_factory=lambda: provider))
    c.provider = provider
    return c


def test_voice_flow_via_api(client, root):
    assert client.get("/api/voices").json()["catalog"]["cantonese"]
    est = client.post("/api/estimate", json={"kind": "voice", "project": PID}).json()
    assert len(est["requests"]) == 2 and est["items"][0]["unit"] == "1000 characters" and est["blocked_reason"] is None
    job = client.post("/api/jobs", json={"kind": "voice", "project": PID}).json()
    client.app.state.jobs.wait_idle()
    assert client.get(f"/api/jobs/{job['id']}").json()["status"] == "done"
    lines = client.get(f"/api/projects/{PID}/voice").json()["lines"]
    assert lines[0]["takes"][0]["file"] == "L01_v1.mp3" and lines[0]["voice"]["voice_id"]
    assert client.post(f"/api/projects/{PID}/voice/track").status_code == 400  # nothing approved yet
    client.post(f"/api/projects/{PID}/voice/L01/approve/v1")
    client.post(f"/api/projects/{PID}/voice/approve-latest")
    r = client.post(f"/api/projects/{PID}/voice/track").json()
    assert r["track"] == "track_v1.wav" and r["timing"]["source"] == "tts"
    rt = client.post(f"/api/projects/{PID}/retime").json()
    assert rt["shots"][0]["start"] == 0 and rt["issues"]
    assert client.get(f"/files/projects/{PID}/audio/track_v1.wav").status_code == 200


def test_character_voice_and_preview(client):
    client.put("/api/characters/xiaowang", json={"voice": {"voice_id": "Chinese (Mandarin)_Gentle_Youth", "speed": 1.1}})
    c = client.get("/api/characters").json()["characters"][0]
    assert c["voice"]["speed"] == 1.1
    job = client.post("/api/jobs", json={"kind": "voice_preview", "name": "xiaowang", "text": "你好"}).json()
    client.app.state.jobs.wait_idle()
    assert client.get(f"/api/jobs/{job['id']}").json()["files"]["xiaowang voice preview"] == ["voice_preview_mandarin_v1.mp3"]
    client.put("/api/characters/xiaowang", json={"voice": {}})
    assert client.get("/api/characters").json()["characters"][0]["voice"] is None


def test_clips_via_api(client, root):
    folder = root / "projects" / PID
    Image.new("RGB", (90, 160), "grey").save(folder / "keyframes" / "S01_v1.png")
    client.post(f"/api/projects/{PID}/keyframes/S01/approve/v1")
    client.put(f"/api/projects/{PID}/shots/S01", json={"motion_prompt": "he waves", "camera": "slow push in", "on_camera_speech": True})
    shots = client.get(f"/api/projects/{PID}/clips").json()["shots"]
    assert "he waves" in shots[0]["prompt"] and "slow push in" in shots[0]["prompt"] and shots[0]["on_camera_speech"]
    est = client.post("/api/estimate", json={"kind": "clips", "project": PID}).json()
    assert est["total"] == pytest.approx(0.21) and any("S02" in n for n in est["notes"])
    job = client.post("/api/jobs", json={"kind": "clips", "project": PID}).json()
    client.app.state.jobs.wait_idle()
    assert client.get(f"/api/projects/{PID}/clips").json()["shots"][0]["clips"] == ["S01_v1.mp4"]
    assert client.post(f"/api/projects/{PID}/clips/S01/approve", json={"text": "S01_v1.mp4"}).json()["file"] == "S01_v1.mp4"
    assert client.post(f"/api/projects/{PID}/clips/S01/approve", json={"text": "../x.mp4"}).status_code == 400
    assert client.get("/api/settings").json()["system"]["ffmpeg"]
