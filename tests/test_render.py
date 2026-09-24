import json

from PIL import Image

from parhelion import dashboard
from parhelion.config import Paths, load_settings
from parhelion.cost import Ledger
from parhelion.schemas import CostEntry
from parhelion.stages import keyframes, storyboard
from parhelion.stages.prompts import compose_shot_prompt, load_character
from parhelion.config import prompt_templates


def test_prompt_composition(root):
    paths = Paths(root)
    folder = root / "projects" / "2026-09-24-demo"
    shot = json.loads((folder / "shotlist.json").read_text())["shots"][0]
    from parhelion.schemas import Shot
    p = compose_shot_prompt(prompt_templates(root), Shot(**shot), [load_character(paths, "xiaowang")])
    assert "navy suit" in p and "no text" in p and "medium shot" in p


def test_storyboard_with_placeholder_and_approval(root):
    paths = Paths(root)
    folder = root / "projects" / "2026-09-24-demo"
    Image.new("RGB", (90, 160), "grey").save(folder / "keyframes" / "S01_v1.png")
    keyframes.approve(folder, "S01", 1)
    out = storyboard.render(folder, paths)
    html = out.read_text(encoding="utf-8")
    assert out.name == "storyboard_v1.html"
    assert "data:image/jpeg;base64" in html and "no keyframe yet" in html and "你买保险了吗" in html
    assert storyboard.render(folder, paths).name == "storyboard_v2.html"  # never overwrites


def test_dashboard_renders_with_fake_ledger(root):
    paths = Paths(root)
    ledger = Ledger(paths.ledger)
    ledger.append(CostEntry(project="demo", stage="keyframes", provider="fal", model="fal-ai/nano-banana/edit", units=3, est_cost_usd=0.12, request_id="r1"))
    ledger.append(CostEntry(project="library", stage="character", provider="fal", model="fal-ai/bytedance/seedream/v4/text-to-image", units=2, est_cost_usd=0.06, actual_cost_usd=0.06, request_id="r2"))
    out = dashboard.render(paths, load_settings(root))
    html = out.read_text(encoding="utf-8")
    assert "$0.18" in html and "demo" in html and "Forecast" in html
