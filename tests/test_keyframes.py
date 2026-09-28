import pytest
from PIL import Image

from parhelion.config import Paths, UserError, pipeline_cfg
from parhelion.stages import keyframes
from parhelion.stages.prompts import load_character, save_character
from parhelion.versioning import IMAGE_EXTS, next_version

FOLDER = ("projects", "2026-09-24-demo")


def _approve_sheets(root, *names):
    paths = Paths(root)
    c = load_character(paths, "xiaowang")
    for n in names:
        Image.new("RGB", (16, 9)).save(root / "library" / "characters" / "xiaowang" / n)
    c.approved_sheets = list(names)
    save_character(paths, c)


def test_one_reference_per_character_with_legend(root):
    _approve_sheets(root, "sheet_v1.png", "sheet_v2.png")
    plan = keyframes.build(Paths(root), root.joinpath(*FOLDER), shot_ids=["S01"], n=1, model_key=None)
    job = plan.jobs[0].job
    assert [p.name for p in job.reference_images] == ["sheet_v2.png"]  # most recently approved only
    assert "Reference images in order: image 1 = 小王" in job.prompt
    assert "no text" in job.prompt


def test_no_legend_without_references(root):
    plan = keyframes.build(Paths(root), root.joinpath(*FOLDER), shot_ids=["S01", "S02"], n=1, model_key=None)
    assert all("Reference images" not in j.job.prompt for j in plan.jobs)


def test_discard_keyframe(root):
    folder = root.joinpath(*FOLDER)
    kf = folder / "keyframes"
    for v in (1, 2):
        Image.new("RGB", (9, 16)).save(kf / f"S01_v{v}.png")
        (kf / f"S01_v{v}.json").write_text("{}")
    keyframes.approve(folder, "S01", 1)
    with pytest.raises(UserError, match="approved"):
        keyframes.discard(folder, "S01", 1)
    assert keyframes.discard(folder, "S01", 2) == "S01_v2.png"
    assert (kf / "discarded" / "S01_v2.png").exists() and (kf / "discarded" / "S01_v2.json").exists()
    assert not (kf / "S01_v2.png").exists()
    assert next_version(kf, "S01", IMAGE_EXTS) == 3


def test_one_image_per_run_by_default(root):
    cfg = pipeline_cfg(root)
    assert cfg["keyframes"]["variants_per_shot"] == 1 and cfg["characters"]["variants"] == 1
