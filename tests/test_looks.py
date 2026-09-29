"""Character looks: one person (text + face photo), several outfits; the video (or a shot) picks one."""

import base64
import io
import json

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from parhelion import project as proj
from parhelion.api.app import create_app
from parhelion.config import Paths, UserError, pipeline_cfg, prompt_templates
from parhelion.schemas import Look
from parhelion.stages import characters as C
from parhelion.stages import keyframes
from parhelion.stages.lint import lint_shotlist
from parhelion.stages.prompts import SHEET_FROM_REFERENCE, load_character, save_character, with_look

from test_api import FakeProvider

PID = "2026-09-24-demo"
FOLDER = ("projects", PID)


def _setup(root, anchor_sheets=("sheet_v3.png",)):
    """xiaowang: face photo, default look (navy suit, sheet_v1) and look 'casual' (sheet_v3)."""
    paths = Paths(root)
    d = root / "library" / "characters" / "xiaowang"
    for n in ("photo_v1.jpg", "sheet_v1.png", "sheet_v2.png", "sheet_v3.png"):
        Image.new("RGB", (16, 16)).save(d / n)
    c = load_character(paths, "xiaowang")
    c.face_ref = "photo_v1.jpg"
    c.approved_sheets = ["sheet_v1.png"]
    c.looks = {"casual": Look(label="休闲", outfit="red hoodie, jeans", approved_sheets=list(anchor_sheets))}
    save_character(paths, c)
    return paths


def _set_looks(root, video=None, shot=None):
    folder = root.joinpath(*FOLDER)
    sl = proj.load_shotlist(folder)
    sl.looks = video or {}
    sl.shots[0].looks = shot or {}
    proj.save(folder / "shotlist.json", sl)
    return folder


def _s01(root):
    return keyframes.build(Paths(root), root.joinpath(*FOLDER), shot_ids=["S01"], n=1, model_key=None).jobs[0].job


def test_with_look_is_person_plus_outfit_keeps_face(root):
    paths = _setup(root)
    base = load_character(paths, "xiaowang")
    c = with_look(base, "casual")
    assert c.prompt_block == "young agent, navy suit\nred hoodie, jeans" and c.approved_sheets == ["sheet_v3.png"]
    assert c.face_ref == "photo_v1.jpg"
    # an older character with no outfit field: the main look is its text unchanged
    assert with_look(base, "default").prompt_block == "young agent, navy suit"
    base.prompt_block, base.outfit = "young agent", "grey suit"
    assert with_look(base, None).prompt_block == "young agent\ngrey suit"
    with pytest.raises(UserError):
        with_look(load_character(paths, "xiaowang"), "nope")


def test_keyframe_uses_video_look_and_shot_override_wins(root):
    _setup(root)
    job = _s01(root)
    assert [p.name for p in job.reference_images] == ["photo_v1.jpg", "sheet_v1.png"]
    assert "navy suit" in job.prompt

    _set_looks(root, video={"xiaowang": "casual"})
    job = _s01(root)
    assert [p.name for p in job.reference_images] == ["photo_v1.jpg", "sheet_v3.png"]
    assert "young agent, navy suit. red hoodie, jeans" in job.prompt  # person + this look's outfit
    assert "image 1 = 小王 (face close-up), image 2 = 小王 (full body)" in job.prompt

    _set_looks(root, video={"xiaowang": "casual"}, shot={"xiaowang": "default"})
    assert "navy suit" in _s01(root).prompt


def test_lint_unknown_look_and_look_without_sheet(root):
    paths = _setup(root, anchor_sheets=())
    templates, cfg = prompt_templates(root), pipeline_cfg(root)

    def issues():
        folder = root.joinpath(*FOLDER)
        return lint_shotlist(proj.load_shotlist(folder), proj.load_script(folder), None, templates, cfg, [], paths, folder)

    _set_looks(root, video={"xiaowang": "casual"})
    assert any(i.level == "warn" and "look 'casual'" in i.message and "no approved sheet" in i.message for i in issues())
    _set_looks(root, shot={"xiaowang": "nope"})
    assert any(i.level == "error" and "no look 'nope'" in i.message for i in issues())


def test_sheet_run_for_a_look(root):
    paths = _setup(root, anchor_sheets=())
    plan = C.build(paths, "xiaowang", n=1, model_key=None, use_approved=True, look="casual")
    job = plan.jobs[0]
    assert "red hoodie" in job.job.prompt and SHEET_FROM_REFERENCE in job.job.prompt
    # a new look with a face photo: face only, not the default look's outfit sheets
    assert [p.name for p in job.job.reference_images] == ["photo_v1.jpg"]
    assert job.meta == {"look": "casual"} and job.label == "xiaowang (casual) sheet"
    default = C.build(paths, "xiaowang", n=1, model_key=None, use_approved=True).jobs[0]
    assert [p.name for p in default.job.reference_images] == ["sheet_v1.png"] and default.meta == {}


def test_face_photo_sent_without_refine_and_note_without_any_reference(root):
    paths = _setup(root)
    for look in (None, "casual"):
        plan = C.build(paths, "xiaowang", n=1, model_key=None, look=look)
        assert [p.name for p in plan.jobs[0].job.reference_images] == ["photo_v1.jpg"]
        assert SHEET_FROM_REFERENCE in plan.jobs[0].job.prompt and "edit" in plan.jobs[0].endpoint
        assert not any("invent" in n for n in plan.notes)
    c = load_character(paths, "xiaowang")
    c.face_ref = None
    save_character(paths, c)
    plan = C.build(paths, "xiaowang", n=1, model_key=None)
    assert plan.jobs[0].job.reference_images == [] and any("invent this person's face" in n for n in plan.notes)


def test_approve_into_look_and_discard_guard(root):
    paths = _setup(root, anchor_sheets=())
    C.approve(paths, "xiaowang", 2, look="casual")
    c = load_character(paths, "xiaowang")
    assert c.looks["casual"].approved_sheets == ["sheet_v2.png"] and c.approved_sheets == ["sheet_v1.png"]
    with pytest.raises(UserError):
        C.discard(paths, "xiaowang", 2)  # approved in a look
    C.unapprove(paths, "xiaowang", 2, look="casual")
    assert load_character(paths, "xiaowang").looks["casual"].approved_sheets == []
    C.discard(paths, "xiaowang", 2)


@pytest.fixture
def client(root, monkeypatch):
    monkeypatch.setenv("FAL_KEY", "fal-secret-key-xyz")
    provider = FakeProvider()
    c = TestClient(create_app(root, provider_factory=lambda: provider))
    c.provider = provider
    return c


def test_looks_api(client, root):
    assert client.put("/api/characters/xiaowang/looks/anchor", json={"label": "主播", "outfit": "dark suit, tie"}).status_code == 200
    assert client.put("/api/characters/xiaowang/looks/default", json={"outfit": "x"}).status_code == 400
    assert client.put("/api/characters/xiaowang/looks/anchor", json={"outfit": "  "}).status_code == 400

    job = client.post("/api/jobs", json={"kind": "character", "name": "xiaowang", "n": 1, "look": "anchor"}).json()
    client.app.state.jobs.wait_idle()
    assert client.get(f"/api/jobs/{job['id']}").json()["status"] == "done"
    d = root / "library" / "characters" / "xiaowang"
    assert json.loads((d / "sheet_v1.json").read_text())["look"] == "anchor"
    assert "dark suit" in client.provider.calls[-1]

    assert client.post("/api/characters/xiaowang/sheets/v1/approve?look=anchor").status_code == 200
    assert client.post("/api/characters/xiaowang/sheets/v1/approve?look=nope").status_code == 400
    xw = next(c for c in client.get("/api/characters").json()["characters"] if c["name"] == "xiaowang")
    assert xw["looks"]["anchor"] == {"label": "主播", "outfit": "dark suit, tie", "style": None, "use_face_ref": True,
                                     "approved_sheets": ["sheet_v1.png"], "reference": None}
    assert xw["approved_sheets"] == []
    assert client.post("/api/characters/xiaowang/sheets/v1/discard").status_code == 400

    # renaming the text keeps the look's sheets
    client.put("/api/characters/xiaowang/looks/anchor", json={"label": "主播", "outfit": "dark suit, blue tie"})
    assert load_character(Paths(root), "xiaowang").looks["anchor"].approved_sheets == ["sheet_v1.png"]

    # video and shot selection; location_ref untouched by a looks-only update
    kf = root.joinpath(*FOLDER) / "keyframes"
    (kf / "S01_v1.png").write_bytes(b"x")
    client.put(f"/api/projects/{PID}/shotlist", json={"location_ref": "keyframes/S01_v1.png"})
    assert client.put(f"/api/projects/{PID}/shotlist", json={"looks": {"xiaowang": "anchor"}}).status_code == 200
    assert client.put(f"/api/projects/{PID}/shotlist", json={"looks": {"xiaowang": "nope"}}).status_code == 400
    shots = client.get(f"/api/projects/{PID}/shots").json()
    assert shots["looks"] == {"xiaowang": "anchor"} and shots["location_ref"] == "keyframes/S01_v1.png"
    assert "blue tie" in shots["shots"][0]["prompt"]
    assert client.put(f"/api/projects/{PID}/shots/S01", json={"looks": {"xiaowang": "default"}}).status_code == 200
    s01 = client.get(f"/api/projects/{PID}/shots").json()["shots"][0]
    assert s01["looks"] == {"xiaowang": "default"} and "navy suit" in s01["prompt"]  # the shot overrides the video
    client.put(f"/api/projects/{PID}/shots/S01", json={"looks": {}})
    assert "blue tie" in client.get(f"/api/projects/{PID}/shots").json()["shots"][0]["prompt"]
    client.put(f"/api/projects/{PID}/shotlist", json={"looks": {}})
    assert client.get(f"/api/projects/{PID}/shots").json()["looks"] == {}

    assert client.delete("/api/characters/xiaowang/looks/anchor").status_code == 200
    assert client.delete("/api/characters/xiaowang/looks/anchor").status_code == 404
    assert (d / "sheet_v1.png").exists()


def _b64(fmt="PNG"):
    buf = io.BytesIO()
    Image.new("RGB", (40, 60), "blue").save(buf, format=fmt)
    return base64.b64encode(buf.getvalue()).decode()


def test_upload_photo_becomes_face_ref(client, root):
    d = root / "library" / "characters" / "xiaowang"
    body = {"filename": "me.png", "data": _b64()}
    assert client.post("/api/characters/xiaowang/photo", json=body).status_code == 400  # consent not confirmed
    r = client.post("/api/characters/xiaowang/photo", json={**body, "consent": True})
    assert r.status_code == 200 and r.json()["file"] == "sheet_v1.png"
    side = json.loads((d / "sheet_v1.json").read_text())
    assert side["source"] == "upload" and side["consent_confirmed"] is True and side["original_name"] == "me.png"
    assert load_character(Paths(root), "xiaowang").face_ref == "sheet_v1.png"
    assert "sheet_v1.png" in (d / "description.md").read_text()
    # data: URLs work; non-images are refused; odd formats are stored as JPEG
    r = client.post("/api/characters/xiaowang/photo", json={"filename": "b.bmp", "data": "data:image/bmp;base64," + _b64("BMP"), "consent": True})
    assert r.json()["file"] == "sheet_v2.jpg"
    bad = {"filename": "x.txt", "data": base64.b64encode(b"hello").decode(), "consent": True}
    assert client.post("/api/characters/xiaowang/photo", json=bad).status_code == 400
    # the next sheet run sends the uploaded face without refine
    est = client.post("/api/estimate", json={"kind": "character", "name": "xiaowang", "n": 1}).json()
    assert est["total"] > 0 and not any("invent" in n for n in est["notes"])


def test_look_with_own_style_and_no_face_photo(root):
    paths = _setup(root)
    c = load_character(paths, "xiaowang")
    c.looks["toon"] = Look(label="卡通", outfit="navy suit", style="cartoon3d", use_face_ref=False, approved_sheets=["sheet_v2.png"])
    save_character(paths, c)
    r = with_look(load_character(paths, "xiaowang"), "toon")
    assert r.style == "cartoon3d" and r.face_ref is None
    _set_looks(root, video={"xiaowang": "toon"})
    job = _s01(root)
    assert [p.name for p in job.reference_images] == ["sheet_v2.png"]  # no real photo for the cartoon look
    assert job.prompt.startswith("3D animated film still")
    sheet = C.build(paths, "xiaowang", n=1, model_key=None, look="toon").jobs[0].job
    assert sheet.reference_images == [] and sheet.prompt.startswith("3D animated film still")
    refine = C.build(paths, "xiaowang", n=1, model_key=None, look="toon", use_approved=True).jobs[0].job
    assert [p.name for p in refine.reference_images] == ["sheet_v2.png"]
    # the video is one style (all cartoon3d via looks): no mixed-style warning
    folder = root.joinpath(*FOLDER)
    issues = lint_shotlist(proj.load_shotlist(folder), proj.load_script(folder), None, prompt_templates(root),
                           pipeline_cfg(root), [], paths, folder)
    assert not any("different styles" in i.message for i in issues)


def test_face_first_chains_portrait_then_sheet(root):
    from parhelion.cost import Ledger
    from parhelion.stages.imagegen_plan import execute

    paths = Paths(root)
    plan = C.build(paths, "xiaowang", n=1, model_key=None, face_first=True)
    face, sheet = plan.jobs
    assert face.label == "xiaowang face" and "Close-up head-and-shoulders portrait" in face.job.prompt
    assert face.job.params["image_size"] == "square_hd" and sheet.endpoint.endswith("/edit")
    assert not any("invent" in n for n in plan.notes)
    provider = FakeProvider()
    execute(plan, provider, Ledger(root / "data" / "costs.jsonl"))
    c = load_character(paths, "xiaowang")
    assert c.face_ref == "sheet_v1.png"
    assert [p.name for p in sheet.job.reference_images] == ["sheet_v1.png"] and SHEET_FROM_REFERENCE in sheet.job.prompt
    d = root / "library" / "characters" / "xiaowang"
    assert json.loads((d / "sheet_v1.json").read_text())["kind"] == "face" and (d / "sheet_v2.png").exists()


def test_face_first_skips_sheet_when_portrait_fails(root):
    from parhelion.cost import Ledger
    from parhelion.stages.imagegen_plan import execute

    paths = Paths(root)
    plan = C.build(paths, "xiaowang", n=1, model_key=None, face_first=True)
    provider = FakeProvider(fail_labels=["head-and-shoulders"])
    execute(plan, provider, Ledger(root / "data" / "costs.jsonl"))
    assert len(provider.calls) == 1  # the sheet was never sent
    assert load_character(paths, "xiaowang").face_ref is None


def test_create_character_with_outfit_and_voice(client):
    body = {"name": "laoli", "display_name": "老李", "prompt_block": "a man in his 50s", "outfit": "grey suit",
            "style": "realistic", "voice": {"voice_id": "Chinese (Mandarin)_Gentleman", "speed": 1, "pitch": 0}}
    assert client.post("/api/characters", json=body).status_code == 200
    c = next(x for x in client.get("/api/characters").json()["characters"] if x["name"] == "laoli")
    assert c["outfit"] == "grey suit" and c["voice"]["voice_id"] == "Chinese (Mandarin)_Gentleman"
    est = client.post("/api/estimate", json={"kind": "character", "name": "laoli", "n": 1, "face_first": True}).json()
    assert len(est["items"]) == 2
    est = client.post("/api/estimate", json={"kind": "character", "name": "laoli", "face_only": True}).json()
    assert [i["label"] for i in est["items"]] == ["laoli face"]


def test_pinned_reference_and_sheet_names(root):
    paths = _setup(root)
    C.approve(paths, "xiaowang", 2)  # main look: v1, v2 approved -> latest is v2
    assert [p.name for p in _s01(root).reference_images] == ["photo_v1.jpg", "sheet_v2.png"]
    C.set_reference(paths, "xiaowang", 1)  # pin v1
    assert [p.name for p in _s01(root).reference_images] == ["photo_v1.jpg", "sheet_v1.png"]
    C.unapprove(paths, "xiaowang", 1)  # unapproving the pinned one clears the pin
    c = load_character(paths, "xiaowang")
    assert c.reference is None and c.approved_sheets == ["sheet_v2.png"]
    C.set_reference(paths, "xiaowang", 3, look="casual")
    assert load_character(paths, "xiaowang").looks["casual"].reference == "sheet_v3.png"
    with pytest.raises(UserError):
        C.set_reference(paths, "xiaowang", 1, look="nope")
    C.name_sheet(paths, "xiaowang", 3, "  hoodie, good one ")
    assert load_character(paths, "xiaowang").sheet_names == {"sheet_v3.png": "hoodie, good one"}
    C.name_sheet(paths, "xiaowang", 3, "")
    assert load_character(paths, "xiaowang").sheet_names == {}


def test_project_cast_picks_the_look_before_any_shot_override(client, root):
    _setup(root)
    assert client.put(f"/api/projects/{PID}/cast", json={"cast": {"xiaowang": "nope"}}).status_code == 400
    assert client.put(f"/api/projects/{PID}/cast", json={"cast": {"xiaowang": "casual"}}).status_code == 200
    assert client.get(f"/api/projects/{PID}/cast").json() == {"cast": {"xiaowang": "casual"}, "script_characters": ["xiaowang"]}
    assert [p.name for p in _s01(root).reference_images] == ["photo_v1.jpg", "sheet_v3.png"]
    shots = client.get(f"/api/projects/{PID}/shots").json()
    assert shots["looks"] == {"xiaowang": "casual"} and "red hoodie" in shots["shots"][0]["prompt"]
    _set_looks(root, shot={"xiaowang": "default"})  # a shot can still override the cast
    assert "red hoodie" not in _s01(root).prompt
    assert client.post("/api/characters/xiaowang/sheets/v3/reference?look=casual").status_code == 200
    assert client.put("/api/characters/xiaowang/sheets/v3/name", json={"name": "主播 A"}).status_code == 200
    xw = next(c for c in client.get("/api/characters").json()["characters"] if c["name"] == "xiaowang")
    assert xw["looks"]["casual"]["reference"] == "sheet_v3.png" and xw["sheet_names"] == {"sheet_v3.png": "主播 A"}
