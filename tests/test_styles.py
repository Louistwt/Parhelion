import pytest

from parhelion import project as proj
from parhelion.config import Paths, UserError, image_model, pipeline_cfg, prompt_templates
from parhelion.stages import characters, keyframes
from parhelion.stages.lint import lint_shotlist
from parhelion.stages.prompts import compose_character_prompt, load_character, plain_text, save_character

FOLDER = ("projects", "2026-09-24-demo")


def _set_style(root, name, style):
    paths = Paths(root)
    c = load_character(paths, name)
    c.style = style
    save_character(paths, c)


def _add_character(root, name, style):
    d = root / "library" / "characters" / name
    d.mkdir()
    (d / "character.yaml").write_text(f"name: {name}\nprompt_block: old man\nstyle: {style}\n", encoding="utf-8")


def test_character_prompt_uses_its_style(root):
    paths, t = Paths(root), prompt_templates(root)
    assert "cartoon" in compose_character_prompt(t, load_character(paths, "xiaowang"))  # default_style
    _set_style(root, "xiaowang", "realistic")
    p = compose_character_prompt(t, load_character(paths, "xiaowang"))
    assert p.startswith("photorealistic") and "flat 2D cartoon" not in p
    assert "one horizontal row" in p and "no text" in p


def test_unknown_style_is_an_error(root):
    _set_style(root, "xiaowang", "watercolour")
    with pytest.raises(UserError, match="watercolour"):
        compose_character_prompt(prompt_templates(root), load_character(Paths(root), "xiaowang"))


def test_old_single_style_key_still_works(root):
    t = prompt_templates(root)
    t = {k: v for k, v in t.items() if k not in ("styles", "default_style")} | {"style": "oil painting"}
    assert compose_character_prompt(t, load_character(Paths(root), "xiaowang")).startswith("oil painting")


def test_markdown_look_is_flattened():
    md = "**Facial Features**\n\n* **Hair**: Short dark hair.\n\n* **Body**: Stocky\n\n**Attire**\n- White shirt"
    assert plain_text(md) == "Hair: Short dark hair. Body: Stocky. White shirt"
    assert plain_text("A man in his 30s, round glasses") == "A man in his 30s, round glasses"


def test_shots_without_people_use_the_script_style(root):
    _set_style(root, "xiaowang", "realistic")
    plan = keyframes.build(Paths(root), root.joinpath(*FOLDER), shot_ids=None, n=1, model_key=None)
    insert = next(j for j in plan.jobs if j.label == "S02")
    assert insert.job.prompt.startswith("photorealistic")
    assert "9:16" in insert.job.prompt


def test_sheets_are_landscape_keyframes_are_not(root):
    paths = Paths(root)
    plan = characters.build(paths, "xiaowang", n=2, model_key=None)
    assert plan.jobs[0].job.params["image_size"] == {"width": 1920, "height": 1080}
    assert image_model(root, None)["params"]["image_size"] == {"width": 1080, "height": 1920}
    kf = keyframes.build(paths, root.joinpath(*FOLDER), shot_ids=["S01"], n=1, model_key=None)
    assert kf.jobs[0].job.params["image_size"] == {"width": 1080, "height": 1920}
    nb = characters.build(paths, "xiaowang", n=1, model_key="nano-banana")
    assert nb.jobs[0].job.params["aspect_ratio"] == "16:9"


def _lint(root):
    folder = root.joinpath(*FOLDER)
    script = proj.load_script(folder)
    script.characters.append("zhangshu")
    sl = proj.load_shotlist(folder)
    sl.shots[0].characters.append("zhangshu")
    return lint_shotlist(sl, script, None, prompt_templates(root), pipeline_cfg(root), [], Paths(root))


def test_lint_mixed_styles(root):
    _add_character(root, "zhangshu", "realistic")  # xiaowang stays cartoon (default)
    issues = _lint(root)
    assert any("different styles" in i.message for i in issues if i.level == "error" and i.where == "S01")
    assert any("different styles" in i.message for i in issues if i.level == "warn" and i.where == "characters")


def test_lint_unknown_style(root):
    _add_character(root, "zhangshu", "watercolour")
    assert any("watercolour" in i.message for i in _lint(root) if i.level == "error")


def test_sheet_from_reference_keeps_face_not_clothes(root):
    from PIL import Image
    paths = Paths(root)
    d = root / "library" / "characters" / "xiaowang"
    Image.new("RGB", (30, 40)).save(d / "sheet_v1.jpg")
    c = load_character(paths, "xiaowang")
    c.approved_sheets = ["sheet_v1.jpg"]
    save_character(paths, c)
    job = characters.build(paths, "xiaowang", n=1, model_key=None, use_approved=True).jobs[0]
    assert job.endpoint.endswith("/edit") and "ignore the clothes" in job.job.prompt
    plain = characters.build(paths, "xiaowang", n=1, model_key=None).jobs[0]
    assert "reference image" not in plain.job.prompt
