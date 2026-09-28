import json
import re
import subprocess

from PIL import Image

from parhelion import project as proj
from parhelion.config import Paths, pipeline_cfg, prompt_templates
from parhelion.media import ffmpeg_exe
from parhelion.schemas import LineTiming, Script, Timing
from parhelion.stages import clips, keyframes
from parhelion.stages.lint import lint_shotlist
from parhelion.stages.prompts import load_character, save_character

FOLDER = ("projects", "2026-09-24-demo")


def _setup_refs(root, face=True, sheets=("sheet_v1.png", "sheet_v2.png")):
    paths = Paths(root)
    d = root / "library" / "characters" / "xiaowang"
    for n in (*sheets, "photo_v1.jpg"):
        Image.new("RGB", (16, 16)).save(d / n)
    c = load_character(paths, "xiaowang")
    c.approved_sheets = list(sheets)
    c.face_ref = "photo_v1.jpg" if face else None
    save_character(paths, c)


def test_face_ref_first_then_latest_sheet(root):
    _setup_refs(root)
    job = keyframes.build(Paths(root), root.joinpath(*FOLDER), shot_ids=["S01"], n=1, model_key=None).jobs[0].job
    assert [p.name for p in job.reference_images] == ["photo_v1.jpg", "sheet_v2.png"]
    assert "image 1 = 小王 (face close-up), image 2 = 小王 (full body)" in job.prompt


def test_face_ref_that_is_also_approved_is_not_sent_twice(root):
    _setup_refs(root, sheets=("sheet_v1.png", "photo_v1.jpg"))
    job = keyframes.build(Paths(root), root.joinpath(*FOLDER), shot_ids=["S01"], n=1, model_key=None).jobs[0].job
    assert [p.name for p in job.reference_images] == ["photo_v1.jpg", "sheet_v1.png"]


def test_location_ref_is_sent_last(root):
    _setup_refs(root, face=False)
    folder = root.joinpath(*FOLDER)
    Image.new("RGB", (9, 16)).save(folder / "keyframes" / "S01_v1.png")
    sl = proj.load_shotlist(folder)
    sl.location_ref = "keyframes/S01_v1.png"
    proj.save(folder / "shotlist.json", sl)
    plan = keyframes.build(Paths(root), folder, shot_ids=None, n=1, model_key=None)
    s01, s02 = plan.jobs
    assert [p.name for p in s01.job.reference_images] == ["sheet_v2.png", "S01_v1.png"]
    assert "image 2 = the room" in s01.job.prompt and "same room" in s01.job.prompt
    assert [p.name for p in s02.job.reference_images] == ["S01_v1.png"]  # insert shot: room only
    assert "image 1 = the room" in s02.job.prompt and "never swap" not in s02.job.prompt


def test_lint_room_missing_and_speech_warnings(root):
    folder = root.joinpath(*FOLDER)
    sl = proj.load_shotlist(folder)
    sl.location_ref = "keyframes/nope.png"
    sl.shots[0].motion_prompt = "he nods while speaking"
    script = proj.load_script(folder)
    issues = lint_shotlist(sl, script, None, prompt_templates(root), pipeline_cfg(root), [], Paths(root), folder=folder)
    assert any(i.level == "error" and i.where == "location_ref" for i in issues)
    assert any("mentions speaking" in i.message for i in issues if i.where == "S01")
    sl.shots[0].on_camera_speech = True
    sl.shots[0].characters = ["xiaowang", "zhangshu"]
    issues = lint_shotlist(sl, script, None, prompt_templates(root), pipeline_cfg(root), [], Paths(root), folder=folder)
    assert any("more than one person" in i.message for i in issues if i.where == "S01")
    assert not any("mentions speaking" in i.message for i in issues)


def _mean_db(wav, a, b):
    res = subprocess.run([ffmpeg_exe(), "-hide_banner", "-i", str(wav), "-af", f"atrim={a}:{b},volumedetect", "-f", "null", "-"],
                         capture_output=True, text=True)
    return float(re.search(r"mean_volume: (-?[\d.]+) dB", res.stderr).group(1))


def test_lipsync_audio_hears_only_the_on_screen_speaker(root):
    folder = root.joinpath(*FOLDER)
    (folder / "audio").mkdir()
    (folder / "clips").mkdir()
    ff = ffmpeg_exe()
    subprocess.run([ff, "-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=8.5", str(folder / "audio" / "track_v1.wav")], check=True, capture_output=True)
    subprocess.run([ff, "-y", "-f", "lavfi", "-i", "color=c=gray:s=64x64:d=5", "-pix_fmt", "yuv420p", str(folder / "clips" / "S01_v1.mp4")], check=True, capture_output=True)
    # S01 (0–4 s, xiaowang on screen) contains L01 (xiaowang, 0–2 s) and a narrator line (2–4 s)
    script = proj.load_script(folder)
    script.lines[1].speaker = "narrator"
    proj.save(folder / "script.json", script)
    timing = Timing(source="tts", chars_per_second=4.5, total_seconds=8.5,
                    lines=[LineTiming(line_id="L01", chars=7, start=0.0, end=2.0), LineTiming(line_id="L02", chars=18, start=2.0, end=4.0)])
    proj.save(folder / "timing.json", timing)
    sl = proj.load_shotlist(folder)
    s01 = sl.shots[0]
    s01.line_ids, s01.approved_clip = ["L01", "L02"], "S01_v1.mp4"
    assert clips.mute_windows(Script.model_validate(script.model_dump()), timing, s01) == [(2.0, 4.0)]
    video, audio = clips._segment_inputs(Paths(root), folder, s01)
    assert _mean_db(audio, 0.2, 1.8) > -30  # xiaowang: kept
    assert _mean_db(audio, 2.2, 3.8) < -80  # narrator: muted
