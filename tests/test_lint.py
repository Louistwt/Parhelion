from parhelion import project as proj
from parhelion.config import Paths, pipeline_cfg, prompt_templates
from parhelion.schemas import Beat, Script
from parhelion.stages.lint import lint_script, lint_shotlist


def _script(root):
    return proj.load_script(root / "projects" / "2026-09-24-demo")


def test_sample_script_has_no_errors(root):
    issues = lint_script(_script(root), pipeline_cfg(root), [], {"xiaowang"})
    assert [i for i in issues if i.level == "error"] == []
    assert any("unverified" in i.message for i in issues)


def test_script_errors(root):
    s = _script(root)
    s.lines[0].text_voice = "[TODO: hook] 某某保险"
    s.beats.append(Beat(name="key_point"))
    s = Script.model_validate(s.model_dump())
    msgs = [i.message for i in lint_script(s, pipeline_cfg(root), ["某某保险"], {"xiaowang"}) if i.level == "error"]
    assert any("TODO" in m for m in msgs)
    assert any("banned term" in m for m in msgs)
    assert any("no lines" in m for m in msgs)


def test_cantonese_needs_subtitle(root):
    s = _script(root)
    s.language = "cantonese"
    msgs = [i.message for i in lint_script(s, pipeline_cfg(root), [], {"xiaowang"})]
    assert any("text_subtitle" in m for m in msgs)


def test_shotlist_checks(root):
    folder = root / "projects" / "2026-09-24-demo"
    sl = proj.load_shotlist(folder)
    sl.shots[1].end = 20.0  # too long
    sl.shots[1].action = ""
    issues = lint_shotlist(sl, _script(root), None, prompt_templates(root), pipeline_cfg(root), [], Paths(root))
    msgs = [i.message for i in issues if i.level == "error"]
    assert any("outside" in m for m in msgs)
    assert any("action is empty" in m for m in msgs)


def test_negative_block_enforced(root):
    folder = root / "projects" / "2026-09-24-demo"
    t = prompt_templates(root)
    t["shot"] = "{style}. {action}."  # someone removed {negative}
    issues = lint_shotlist(proj.load_shotlist(folder), _script(root), None, t, pipeline_cfg(root), [], Paths(root))
    assert any("negative" in i.message for i in issues if i.level == "error")
