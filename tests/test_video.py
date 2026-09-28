import json
import subprocess

import pytest
from PIL import Image

from parhelion import project as proj
from parhelion.config import Paths, UserError, pipeline_cfg
from parhelion.cost import Ledger
from parhelion.media import decoded_duration, ffmpeg_exe, find_font, has_stream, probe_duration, video_size
from parhelion.providers.base import GeneratedImage, MediaProvider, MediaResult, ProviderError
from parhelion.stages import assemble as AS
from parhelion.stages import clips as CL
from parhelion.stages import retime as RT
from parhelion.stages import voice as VO
from parhelion.stages.imagegen_plan import execute

PID = "2026-09-24-demo"


def ff(*args):
    subprocess.run([ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", *args], check=True)


def tone(path, seconds):
    ff("-f", "lavfi", "-i", f"sine=frequency=440:duration={seconds}", "-c:a", "libmp3lame", str(path))
    return path


def make_clip(path, seconds=5, size="720x1280"):
    ff("-f", "lavfi", "-i", f"testsrc=size={size}:rate=24:duration={seconds}", "-pix_fmt", "yuv420p", str(path))
    return path


class FakeMedia(MediaProvider):
    name = "fake"

    def __init__(self, tmp, fail=()):
        self.tmp, self.fail, self.calls = tmp, set(fail), []

    def run_media(self, endpoint, payload, files, expect):
        self.calls.append((endpoint, payload, {k: str(v) for k, v in files.items()}))
        if any(f in json.dumps(payload, ensure_ascii=False) for f in self.fail):
            raise ProviderError("boom", request_id="bad")
        if expect == "audio":
            data = tone(self.tmp / f"t{len(self.calls)}.mp3", 1.5).read_bytes()
            return MediaResult("rq%d" % len(self.calls), endpoint, [GeneratedImage(data, ".mp3")], payload, {"duration_ms": 1500})
        data = make_clip(self.tmp / f"c{len(self.calls)}.mp4", 5).read_bytes()
        return MediaResult("rq%d" % len(self.calls), endpoint, [GeneratedImage(data, ".mp4")], payload, {})


@pytest.fixture
def folder(root):
    return root / "projects" / PID


def test_voice_build_estimate_and_missing_voice(root, folder):
    paths = Paths(root)
    plan = VO.build(paths, folder, line_ids=None, model_key=None)
    # L01 = xiaowang (has voice), L02 = narrator (voices.yaml)
    assert [j.label for j in plan.jobs] == ["L01 voice", "L02 voice"]
    j = plan.jobs[0]
    assert j.payload["language_boost"] == "Chinese" and j.payload["voice_setting"]["voice_id"].startswith("Chinese (Mandarin)")
    assert j.unit == "1000 characters" and j.estimate.cost == pytest.approx(len("你买保险了吗？") / 1000 * 0.1, abs=1e-4)
    (root / "library/characters/xiaowang/character.yaml").write_text("name: xiaowang\nprompt_block: x\n", encoding="utf-8")
    with pytest.raises(UserError, match="no voice"):
        VO.build(paths, folder, line_ids=None, model_key=None)


def test_voice_run_track_retime(root, folder, tmp_path):
    paths = Paths(root)
    ledger = Ledger(paths.ledger)
    execute(VO.build(paths, folder, line_ids=None, model_key=None), FakeMedia(tmp_path), ledger)
    assert [p.name for p in VO.takes(folder, "L01")] == ["L01_v1.mp3"]
    assert json.loads((folder / "audio/L01_v1.json").read_text())["line_id"] == "L01"
    with pytest.raises(UserError, match="Approve a take"):
        VO.build_track(paths, folder)
    VO.approve_latest(folder, proj.load_script(folder))
    timing, track = VO.build_track(paths, folder)
    first = decoded_duration(folder / "audio" / "L01_v1.mp3")  # decoded length, not the provider's duration_ms
    assert timing.source == "tts" and timing.lines[1].start == pytest.approx(first + 0.3, abs=0.01)
    assert probe_duration(track) == pytest.approx(timing.total_seconds, abs=0.05)
    new, issues = RT.run(paths, folder)
    assert new.shots[0].start == 0 and new.shots[1].start == pytest.approx(first + 0.3, abs=0.01)
    assert new.shots[-1].end == pytest.approx(timing.total_seconds, abs=0.01)
    assert any("S01" in i for i in issues)  # 1.8 s is below the 3 s minimum → flagged
    assert (folder / ".history").exists()
    assert all(e.status == "ok" and e.unit == "1000 characters" for e in ledger.entries())


def test_clips_and_lipsync(root, folder, tmp_path):
    paths = Paths(root)
    Image.new("RGB", (90, 160), "grey").save(folder / "keyframes" / "S01_v1.png")
    sl = proj.load_shotlist(folder)
    sl.shots[0].approved_keyframe = "S01_v1.png"
    sl.shots[0].on_camera_speech = True
    proj.save(folder / "shotlist.json", sl)
    plan = CL.build(paths, folder, shot_ids=None, n=1, model_key=None)
    assert [j.label for j in plan.jobs] == ["S01 clip"] and any("S02" in n for n in plan.notes)
    j = plan.jobs[0]
    assert j.payload["duration"] == "5" and j.units == 5 and j.estimate.cost == pytest.approx(0.21)
    assert "negative_prompt" in j.payload and j.files["image_url"].name == "S01_v1.png"
    hailuo = CL.build(paths, folder, shot_ids=["S01"], n=1, model_key="hailuo-02-standard").jobs[0]
    assert hailuo.payload["duration"] == "6" and "negative_prompt" not in hailuo.payload
    fake = FakeMedia(tmp_path)
    execute(plan, fake, Ledger(paths.ledger))
    assert CL.approve(folder, "S01", "S01_v1.mp4") == "S01_v1.mp4"
    with pytest.raises(UserError):
        CL.build_lipsync(paths, folder, shot_ids=None, model_key=None)  # no voice track yet
    execute(VO.build(paths, folder, line_ids=None, model_key=None), fake, Ledger(paths.ledger))
    VO.approve_latest(folder, proj.load_script(folder))
    VO.build_track(paths, folder)
    lp = CL.build_lipsync(paths, folder, shot_ids=None, model_key=None)
    assert [j.label for j in lp.jobs] == ["S01 lip-sync"] and not (folder / "clips/segments").exists()  # no side effects
    execute(lp, fake, Ledger(paths.ledger))
    endpoint, payload, files = fake.calls[-1]
    assert endpoint == "fal-ai/latentsync" and files["video_url"].endswith(".mp4") and files["audio_url"].endswith(".wav")
    assert [p.name for p in CL.lipsync_takes(folder, "S01")] == ["S01_lipsync_v1.mp4"]


@pytest.mark.skipif(not any(__import__("pathlib").Path(f).exists() for f in [
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc", "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc", "/mnt/c/Windows/Fonts/msyhbd.ttc", "/mnt/c/Windows/Fonts/msyh.ttc"]),
    reason="no CJK font available")
def test_assemble_animatic_and_clip(root, folder, tmp_path):
    paths = Paths(root)
    fake = FakeMedia(tmp_path)
    # voice → track
    execute(VO.build(paths, folder, line_ids=None, model_key=None), fake, Ledger(paths.ledger))
    VO.approve_latest(folder, proj.load_script(folder))
    timing, _ = VO.build_track(paths, folder)
    RT.run(paths, folder)
    # S01: still (approved keyframe) ; S02: clip
    Image.new("RGB", (540, 960), (40, 90, 160)).save(folder / "keyframes" / "S01_v1.png")
    make_clip(folder / "clip_src.mp4", 5)
    (folder / "clips").mkdir(exist_ok=True)
    (folder / "clip_src.mp4").rename(folder / "clips" / "S02_v1.mp4")
    sl = proj.load_shotlist(folder)
    sl.shots[0].approved_keyframe = "S01_v1.png"
    sl.shots[1].approved_clip = "S02_v1.mp4"
    proj.save(folder / "shotlist.json", sl)
    s = AS.assemble(paths, folder)
    out = folder / "output"
    cut = out / s["rough_cut"]
    assert s["rough_cut"] == "rough_cut_v1.mp4" and [r["source"] for r in s["shots"]] == ["still", "clip"]
    assert probe_duration(cut) == pytest.approx(timing.total_seconds, abs=0.2)
    assert video_size(cut) == (1080, 1920) and has_stream(cut, "audio")
    assert probe_duration(out / s["clean"]) == pytest.approx(timing.total_seconds, abs=0.2)
    srt = (out / s["srt"]).read_text(encoding="utf-8")
    assert "你买保险了吗" in srt and "00:00:00,000 -->" in srt
    cap = out / s["capcut"]
    assert sorted(p.name for p in (cap / "clips").iterdir()) == ["S01.mp4", "S02.mp4"]
    assert {p.name for p in (cap / "audio").iterdir()} == {"L01.mp3", "L02.mp3", "voice_track.wav"}
    assert (cap / "README.md").exists() and (cap / "subtitles.srt").exists()
    assert not (out / "rough_cut_v1_work").exists()
    assert AS.assemble(paths, folder)["rough_cut"] == "rough_cut_v2.mp4"  # never overwrites
    assert [r["version"] for r in AS.renders(folder)] == [2, 1]


def test_srt_and_wrap():
    from parhelion.schemas import Script, Timing
    script = Script(title="t", language="mandarin", target_seconds=5,
                    lines=[{"id": "L01", "speaker": "n", "text_voice": "a", "text_subtitle": "你好"}])
    timing = Timing(source="tts", chars_per_second=4, total_seconds=1.5, lines=[{"line_id": "L01", "chars": 2, "start": 0.25, "end": 1.5}])
    assert AS.build_srt(script, timing) == "1\n00:00:00,250 --> 00:00:01,500\n你好\n"
