import json

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from parhelion.api.app import create_app
from parhelion.cost import Ledger
from parhelion.providers.base import GeneratedImage, ImageProvider, ImageResult, ProviderError

PID = "2026-09-24-demo"


class FakeProvider(ImageProvider):
    name = "fake"

    def __init__(self, fail_labels=()):
        self.fail = set(fail_labels)
        self.calls = []

    def generate(self, job, endpoint):
        self.calls.append(job.prompt)
        if any(f in job.prompt for f in self.fail):
            raise ProviderError("boom", request_id="rq-fail")
        buf = __import__("io").BytesIO()
        Image.new("RGB", (18, 32), "red").save(buf, format="PNG")
        return ImageResult(request_id=f"rq{len(self.calls)}", endpoint=endpoint,
                           images=[GeneratedImage(buf.getvalue(), ".png")] * job.num_images,
                           seed=1, request_payload={"prompt": job.prompt}, raw_response={})


@pytest.fixture
def client(root, monkeypatch):
    monkeypatch.setenv("FAL_KEY", "fal-secret-key-xyz")
    provider = FakeProvider(fail_labels=["booklet"])  # S02's action mentions a booklet
    app = create_app(root, provider_factory=lambda: provider)
    c = TestClient(app)
    c.provider = provider
    return c


def test_overview_and_project(client):
    r = client.get("/api/overview").json()
    assert r["projects"][0]["id"] == PID and r["has_fal_key"]
    assert client.get(f"/api/projects/{PID}").json()["slug"] == "demo"
    assert client.post("/api/projects", json={"slug": "Bad Slug", "language": "mandarin"}).status_code == 400
    assert client.post("/api/projects", json={"slug": "demo-c", "language": "cantonese", "seconds": 45}).status_code == 200


def test_brief_history(client, root):
    client.put(f"/api/projects/{PID}/brief", json={"text": "v1"})
    client.put(f"/api/projects/{PID}/brief", json={"text": "v2"})
    assert client.get(f"/api/projects/{PID}/brief").json()["text"] == "v2"
    assert len(list((root / "projects" / PID / ".history").iterdir())) == 1


def test_drafts_never_overwrite_and_feedback(client, root):
    folder = root / "projects" / PID
    (folder / "script_v1.md").write_text("claude draft", encoding="utf-8")
    r = client.post(f"/api/projects/{PID}/drafts", json={"text": "my edit", "based_on": 1}).json()
    assert r["version"] == 2
    assert (folder / "script_v1.md").read_text() == "claude draft"
    assert "edited by human" in (folder / "script_v2.md").read_text()
    client.put(f"/api/projects/{PID}/drafts/2/feedback", json={"text": "shorter hook"})
    d = client.get(f"/api/projects/{PID}/drafts").json()
    assert [x["version"] for x in d["drafts"]] == [1, 2] and d["drafts"][1]["has_feedback"]
    assert "script_v3.md" in d["claude_prompt"] and "script_v2.feedback.md" in d["claude_prompt"]


def test_claim_approval_recorded(client, root):
    assert client.post(f"/api/projects/{PID}/claims/C01", json={"status": "approved", "note": "ok"}).status_code == 200
    script = json.loads((root / "projects" / PID / "script.json").read_text())
    assert script["claims"][0]["status"] == "approved"
    pj = json.loads((root / "projects" / PID / "project.json").read_text())
    assert pj["approvals"][-1]["what"] == "claim C01"


def test_lint_timing_shots(client):
    lint = client.get(f"/api/projects/{PID}/lint").json()
    assert lint["scope"] == "script+shots" and lint["errors"] == 0
    assert client.post(f"/api/projects/{PID}/timing").json()["timing"]["total_seconds"] > 0
    shots = client.get(f"/api/projects/{PID}/shots").json()["shots"]
    assert "no text" in shots[0]["prompt"]
    client.put(f"/api/projects/{PID}/shots/S01", json={"action": "waves"})
    assert client.get(f"/api/projects/{PID}/shots").json()["shots"][0]["action"] == "waves"


def test_estimate_and_job_flow(client, root):
    est = client.post("/api/estimate", json={"kind": "keyframes", "project": PID, "n": 2}).json()
    assert est["total"] == pytest.approx(0.12) and est["blocked_reason"] is None and len(est["requests"]) == 2
    job = client.post("/api/jobs", json={"kind": "keyframes", "project": PID, "n": 2}).json()
    client.app.state.jobs.wait_idle()
    job = client.get(f"/api/jobs/{job['id']}").json()
    assert job["status"] == "done"
    assert job["files"]["S01"] == ["S01_v1.png", "S01_v2.png"]
    assert any(e["event"] == "failed" for e in job["events"])  # S02 failed, S01 kept
    ledger = Ledger(root / "data" / "costs.jsonl").entries()
    assert [e.status for e in ledger] == ["ok", "failed"]
    kf = client.get(f"/api/projects/{PID}/keyframes").json()["shots"]
    assert kf[0]["variants"] == ["S01_v1.png", "S01_v2.png"]
    assert client.post(f"/api/projects/{PID}/keyframes/S01/approve/v2").json()["file"] == "S01_v2.png"
    assert client.get(f"/files/projects/{PID}/keyframes/S01_v2.png").status_code == 200


def test_budget_blocks_job(client, monkeypatch):
    monkeypatch.setenv("PARHELION_MAX_SPEND_PER_RUN", "0.05")
    est = client.post("/api/estimate", json={"kind": "keyframes", "project": PID, "n": 2}).json()
    assert est["blocked_reason"]
    assert client.post("/api/jobs", json={"kind": "keyframes", "project": PID, "n": 2}).status_code == 409
    assert client.provider.calls == []


def test_characters(client):
    assert client.post("/api/characters", json={"name": "zhangshu", "display_name": "张叔", "prompt_block": "old man"}).status_code == 200
    names = [c["name"] for c in client.get("/api/characters").json()["characters"]]
    assert names == ["xiaowang", "zhangshu"]
    job = client.post("/api/jobs", json={"kind": "character", "name": "zhangshu", "n": 1}).json()
    client.app.state.jobs.wait_idle()
    assert client.get("/api/characters").json()["characters"][1]["sheets"] == ["sheet_v1.png"]
    client.post("/api/characters/zhangshu/sheets/v1/approve")
    assert client.get("/api/characters").json()["characters"][1]["approved_sheets"] == ["sheet_v1.png"]


def test_storyboard_costs_settings(client):
    assert client.post(f"/api/projects/{PID}/storyboards").json()["file"] == "storyboard_v1.html"
    assert client.get(f"/api/projects/{PID}/storyboards").json()["storyboards"] == ["storyboard_v1.html"]
    assert "month_spend" in client.get("/api/costs").json()
    s = client.get("/api/settings").json()
    assert s["has_fal_key"] and "fal-secret-key-xyz" not in json.dumps(s)  # key value never exposed


def test_path_traversal_blocked(client):
    assert client.get("/files/projects/../.env").status_code == 404
    assert client.get("/files/projects/%2e%2e/%2e%2e/etc/passwd").status_code == 404
    assert client.get("/files/library/../config/models.yaml").status_code in (404, 422)
    assert client.get("/api/projects/..%2F..%2Fetc").status_code in (400, 404)


def test_character_style(client):
    data = client.get("/api/characters").json()
    assert "realistic" in data["styles"] and data["default_style"] in data["styles"]
    assert client.post("/api/characters", json={"name": "laoli", "prompt_block": "old man", "style": "realistic"}).status_code == 200
    assert client.post("/api/characters", json={"name": "bad", "prompt_block": "x", "style": "nope"}).status_code == 400
    assert client.put("/api/characters/laoli", json={"style": "cartoon"}).status_code == 200
    laoli = next(c for c in client.get("/api/characters").json()["characters"] if c["name"] == "laoli")
    assert laoli["style"] == "cartoon"


def test_discard_sheet(client, root):
    d = root / "library" / "characters" / "xiaowang"
    for v in (1, 2):
        (d / f"sheet_v{v}.png").write_bytes(b"x")
    client.post("/api/characters/xiaowang/sheets/v1/approve")
    assert client.post("/api/characters/xiaowang/sheets/v1/discard").status_code == 400  # approved: unapprove first
    assert client.post("/api/characters/xiaowang/sheets/v2/discard").status_code == 200
    xw = next(c for c in client.get("/api/characters").json()["characters"] if c["name"] == "xiaowang")
    assert xw["sheets"] == ["sheet_v1.png"]
    assert (d / "discarded" / "sheet_v2.png").exists()


def test_discard_keyframe_api(client, root):
    kf = root / "projects" / "2026-09-24-demo" / "keyframes"
    for v in (1, 2):
        (kf / f"S01_v{v}.png").write_bytes(b"x")
    assert client.post("/api/projects/2026-09-24-demo/keyframes/S01/discard/v2").status_code == 200
    shots = client.get("/api/projects/2026-09-24-demo/keyframes").json()["shots"]
    assert shots[0]["variants"] == ["S01_v1.png"]
