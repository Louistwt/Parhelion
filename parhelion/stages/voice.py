"""Voice (TTS) per script line → approve one take per line → real timing + one voice track."""

from __future__ import annotations

import json
from pathlib import Path

from .. import project as proj
from ..config import Paths, UserError, pipeline_cfg, prices, stage_model, voices
from ..cost import unit_price
from ..media import decoded_duration, probe_duration, run_ffmpeg
from ..schemas import LineTiming, Script, Timing, Voice
from ..versioning import all_paths, find_version, next_path
from .imagegen_plan import RunPlan
from .mediagen import MediaJob
from .prompts import character_dir, load_character
from .timing import speech_chars

AUDIO_EXTS = (".mp3", ".wav", ".flac")
EMOTIONS = {"neutral", "happy", "sad", "angry", "fearful", "disgusted", "surprised"}
LANGUAGE_BOOST = {"mandarin": "Chinese", "cantonese": "Chinese,Yue"}


# ---------- voices ----------


def voice_for(paths: Paths, speaker: str, language: str) -> Voice:
    if speaker == "narrator":
        cfg = (voices(paths.root).get("narrator") or {}).get(language)
        if not cfg:
            raise UserError(f"No narrator voice for {language} in library/voices.yaml")
        return Voice.model_validate(cfg)
    char = load_character(paths, speaker)
    if char.voice is None:
        raise UserError(
            f"Character {speaker!r} has no voice yet. Pick one on the Characters page "
            f"(or add `voice: {{voice_id: ...}}` to library/characters/{speaker}/character.yaml)."
        )
    return char.voice


def pronunciation(paths: Paths) -> dict:
    path = paths.library / "pronunciation.json"
    if not path.exists():
        return {}
    terms = (json.loads(path.read_text(encoding="utf-8")) or {}).get("terms", {})
    return {"tone": [f"{k}/{v}" for k, v in terms.items()]} if terms else {}


def tts_payload(model: dict, text: str, voice: Voice, language: str, emotion: str | None, pron: dict) -> dict:
    vs = {"voice_id": voice.voice_id, "speed": voice.speed, "pitch": voice.pitch}
    emo = emotion if emotion in EMOTIONS else voice.emotion
    if emo in EMOTIONS:
        vs["emotion"] = emo
    payload = {"prompt": text, "voice_setting": vs, "language_boost": LANGUAGE_BOOST[language], **model.get("params", {})}
    if pron:
        payload["pronunciation_dict"] = pron
    return payload


def _tts_job(paths: Paths, model: dict, *, label: str, out_dir: Path, stem: str, text: str, voice: Voice,
             language: str, emotion: str | None, meta: dict) -> MediaJob:
    price, unit = unit_price(prices(paths.root), model["endpoint"])
    return MediaJob(
        label=label, out_dir=out_dir, stem=stem, endpoint=model["endpoint"], model_key=model["key"],
        payload=tts_payload(model, text, voice, language, emotion, pronunciation(paths)),
        expect="audio", ext=".mp3", units=len(text) / 1000, unit=unit, unit_price=price, meta=meta,
    )


def build(paths: Paths, folder: Path, *, line_ids: list[str] | None, model_key: str | None) -> RunPlan:
    """One TTS request per line. No side effects, no spend."""
    script = proj.load_script(folder)
    model = stage_model(paths.root, "tts", model_key)
    lines = [l for l in script.lines if not line_ids or l.id in line_ids]
    if line_ids and len(lines) != len(set(line_ids)):
        missing = set(line_ids) - {l.id for l in lines}
        raise UserError(f"No line(s): {', '.join(sorted(missing))}")
    jobs = []
    for line in lines:
        voice = voice_for(paths, line.speaker, script.language)
        jobs.append(_tts_job(paths, model, label=f"{line.id} voice", out_dir=folder / "audio", stem=line.id,
                             text=line.text_voice, voice=voice, language=script.language, emotion=line.emotion,
                             meta={"line_id": line.id, "speaker": line.speaker, "text": line.text_voice}))
    notes = [] if model.get("verified") else [f"Model {model['key']!r} is marked unverified in config/models.yaml."]
    return RunPlan(kind="voice", project=proj.load_project(folder).slug, stage="voice", jobs=jobs, notes=notes, folder=folder)


def build_preview(paths: Paths, name: str, *, text: str, language: str, model_key: str | None) -> RunPlan:
    """A short sample of a character's (or the narrator's) voice, saved in the library."""
    model = stage_model(paths.root, "tts", model_key)
    voice = voice_for(paths, name, language)
    out_dir = (paths.library / "voices" / "previews") if name == "narrator" else character_dir(paths, name)
    job = _tts_job(paths, model, label=f"{name} voice preview", out_dir=out_dir, stem=f"voice_preview_{language}",
                   text=text, voice=voice, language=language, emotion=None,
                   meta={"speaker": name, "voice": voice.model_dump(), "text": text})
    return RunPlan(kind="voice_preview", project="library", stage="voice", jobs=[job])


# ---------- takes & approval ----------


def approvals_path(folder: Path) -> Path:
    return folder / "voice.json"


def load_approvals(folder: Path) -> dict[str, str]:
    p = approvals_path(folder)
    return (json.loads(p.read_text(encoding="utf-8")).get("approved") or {}) if p.exists() else {}


def save_approvals(folder: Path, approved: dict[str, str]) -> None:
    approvals_path(folder).write_text(json.dumps({"approved": approved}, ensure_ascii=False, indent=2), encoding="utf-8")


def takes(folder: Path, line_id: str) -> list[Path]:
    return all_paths(folder / "audio", line_id, AUDIO_EXTS)


def take_duration(path: Path) -> float:
    """Length of the decoded audio — what actually goes into the voice track. (The provider's duration_ms ran
    ~0.05 s long per line, which made late subtitles drift.)"""
    return decoded_duration(path)


def approve(folder: Path, line_id: str, version: int) -> str:
    f = find_version(folder / "audio", line_id, version, AUDIO_EXTS)
    if f is None:
        raise UserError(f"No audio/{line_id}_v{version}")
    approved = load_approvals(folder)
    approved[line_id] = f.name
    save_approvals(folder, approved)
    proj.record_approval(folder, f"audio {line_id}", f.name)
    return f.name


def approve_latest(folder: Path, script: Script) -> dict[str, str]:
    approved = load_approvals(folder)
    for line in script.lines:
        latest = takes(folder, line.id)
        if latest and line.id not in approved:
            approved[line.id] = latest[-1].name
    save_approvals(folder, approved)
    return approved


# ---------- real timing + track ----------


def build_track(paths: Paths, folder: Path) -> tuple[Timing, Path]:
    """Real timing from the approved takes (+ pauses), and one WAV voice track (never overwritten)."""
    script = proj.load_script(folder)
    approved = load_approvals(folder)
    missing = [l.id for l in script.lines if l.id not in approved or not (folder / "audio" / approved[l.id]).exists()]
    if missing:
        raise UserError(f"Approve a take for every line first (missing: {', '.join(missing)})")
    pause = float(pipeline_cfg(paths.root)["speech"].get("pause_between_lines", 0.3))
    audio = folder / "audio"
    t, out_lines, inputs, filters = 0.0, [], [], []
    for i, line in enumerate(script.lines):
        f = audio / approved[line.id]
        dur = take_duration(f)
        out_lines.append(LineTiming(line_id=line.id, chars=speech_chars(line.text_voice), start=round(t, 3), end=round(t + dur, 3)))
        inputs += ["-i", str(f)]
        gap = pause if i < len(script.lines) - 1 else 0.0
        filters.append(f"[{i}:a]aresample=44100,aformat=channel_layouts=mono,apad=pad_dur={gap}[a{i}]")
        t += dur + gap
    total = round(t, 3)
    concat = "".join(f"[a{i}]" for i in range(len(script.lines)))
    graph = ";".join(filters) + f";{concat}concat=n={len(script.lines)}:v=0:a=1[out]"
    track = next_path(audio, "track", ".wav")
    run_ffmpeg([*inputs, "-filter_complex", graph, "-map", "[out]", "-c:a", "pcm_s16le", str(track)])
    rate = sum(l.chars for l in out_lines) / max(total, 0.01)
    timing = Timing(source="tts", chars_per_second=round(rate, 2), total_seconds=total, lines=out_lines)
    proj.save(folder / "timing.json", timing)
    proj.set_stage(folder, "voice", "approved")
    proj.set_stage(folder, "timing", "tts")
    return timing, track


def latest_track(folder: Path) -> Path | None:
    tracks = all_paths(folder / "audio", "track", ".wav")
    return tracks[-1] if tracks else None
