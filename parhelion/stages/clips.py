"""Image-to-video clips per shot (from the approved keyframe) and lip-sync for on-camera speech."""

from __future__ import annotations

import math
from pathlib import Path

from .. import project as proj
from ..config import Paths, UserError, pipeline_cfg, prices, prompt_templates, stage_model
from ..cost import unit_price
from ..media import run_ffmpeg
from ..schemas import Shot
from ..versioning import all_paths, next_path
from .imagegen_plan import RunPlan
from .mediagen import MediaJob
from .voice import latest_track

VIDEO_EXTS = (".mp4", ".mov", ".webm")


def _clean(s: str) -> str:
    return " ".join(s.split()).rstrip(".")


def compose_motion_prompt(templates: dict, shot: Shot) -> str:
    motion = _clean(shot.motion_prompt) or f"{_clean(shot.action) or 'the scene'}, subtle natural movement"
    camera = _clean(shot.camera) or _clean(templates.get("default_camera", "static camera"))
    return " ".join(templates["motion"].format(motion=motion, camera=camera).split())


def generation_length(model: dict, shot_seconds: float) -> int:
    """Shortest duration the model can generate that covers the shot (assembly trims the rest)."""
    options = sorted(int(d) for d in model.get("durations", [5]))
    for d in options:
        if d >= shot_seconds - 0.05:
            return d
    return options[-1]


def billing_units(entry: dict, unit: str, seconds: float) -> float:
    if unit == "minutes":
        return seconds / 60
    if unit == "units":
        return math.ceil(seconds / float(entry.get("seconds_per_unit", 5)))
    return seconds


# ---------- clips ----------


def build(paths: Paths, folder: Path, *, shot_ids: list[str] | None, n: int, model_key: str | None,
          include_approved: bool = False) -> RunPlan:
    shotlist = proj.load_shotlist(folder)
    model = stage_model(paths.root, "video", model_key)
    templates = prompt_templates(paths.root)
    entry = prices(paths.root).get(model["endpoint"], {})
    price, unit = unit_price(prices(paths.root), model["endpoint"])
    shots = [s for s in shotlist.shots if (not shot_ids or s.id in shot_ids)]
    if not shot_ids:
        shots = [s for s in shots if include_approved or not s.approved_clip]
    jobs, notes = [], []
    if not model.get("verified"):
        notes.append(f"Model {model['key']!r} is marked unverified in config/models.yaml.")
    for s in shots:
        if not s.approved_keyframe:
            notes.append(f"{s.id}: skipped — approve a keyframe first.")
            continue
        seconds = generation_length(model, s.duration)
        if seconds + 0.05 < s.duration:
            notes.append(f"{s.id}: shot is {s.duration:g}s but the model's longest clip is {seconds}s — the end will hold the last frame.")
        payload = {"prompt": compose_motion_prompt(templates, s), "duration": str(seconds), **model.get("params", {})}
        if model.get("supports_negative_prompt"):
            payload["negative_prompt"] = " ".join(templates.get("motion_negative", "").split())
        for i in range(n):
            jobs.append(MediaJob(
                label=f"{s.id} clip" + (f" #{i + 1}" if n > 1 else ""), out_dir=folder / "clips", stem=s.id,
                endpoint=model["endpoint"], model_key=model["key"], payload=payload, expect="video", ext=".mp4",
                units=billing_units(entry, unit, seconds), unit=unit, unit_price=price,
                files={"image_url": folder / "keyframes" / s.approved_keyframe},
                meta={"shot_id": s.id, "keyframe": s.approved_keyframe, "shot_seconds": s.duration, "generated_seconds": seconds},
            ))
    return RunPlan(kind="clips", project=proj.load_project(folder).slug, stage="clips", jobs=jobs, notes=notes, folder=folder)


def clip_takes(folder: Path, shot_id: str) -> list[Path]:
    return all_paths(folder / "clips", shot_id, VIDEO_EXTS)


def lipsync_takes(folder: Path, shot_id: str) -> list[Path]:
    return all_paths(folder / "clips", f"{shot_id}_lipsync", VIDEO_EXTS)


def approve(folder: Path, shot_id: str, filename: str) -> str:
    """Approve a clip or lip-sync take by file name (e.g. S03_v2.mp4 or S03_lipsync_v1.mp4)."""
    sl = proj.load_shotlist(folder)
    shot = sl.shot(shot_id)
    if shot is None:
        raise UserError(f"No shot {shot_id}")
    f = folder / "clips" / Path(filename).name
    valid = {p.name for p in clip_takes(folder, shot_id) + lipsync_takes(folder, shot_id)}
    if f.name not in valid:
        raise UserError(f"No clip {filename} for {shot_id}")
    shot.approved_clip = f.name
    proj.save(folder / "shotlist.json", sl)
    proj.record_approval(folder, f"clip {shot_id}", f.name)
    if all(s.approved_clip for s in sl.shots):
        proj.set_stage(folder, "clips", "approved")
    return f.name


def after_run(folder: Path) -> None:
    proj.set_stage(folder, "clips", "in_progress")


# ---------- lip-sync ----------


def _segment_inputs(paths: Paths, folder: Path, shot: Shot) -> tuple[Path, Path]:
    """Trim the approved clip and the voice track to the shot window (inputs for lip-sync; kept for reproducibility)."""
    track = latest_track(folder)
    if track is None:
        raise UserError("Build the voice track first (Voice tab).")
    if not shot.approved_clip:
        raise UserError(f"{shot.id}: approve a clip first.")
    seg_dir = folder / "clips" / "segments"
    seg_dir.mkdir(parents=True, exist_ok=True)
    fps = int(pipeline_cfg(paths.root)["assembly"]["fps"])
    video = next_path(seg_dir, f"{shot.id}_input", ".mp4")
    run_ffmpeg(["-i", str(folder / "clips" / shot.approved_clip), "-t", f"{shot.duration:.3f}",
                "-vf", f"tpad=stop_mode=clone:stop_duration={shot.duration:.3f},fps={fps}", "-an",
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", str(video)])
    audio = next_path(seg_dir, f"{shot.id}_voice", ".wav")
    run_ffmpeg(["-ss", f"{shot.start:.3f}", "-t", f"{shot.duration:.3f}", "-i", str(track), "-c:a", "pcm_s16le", str(audio)])
    return video, audio


def build_lipsync(paths: Paths, folder: Path, *, shot_ids: list[str] | None, model_key: str | None) -> RunPlan:
    shotlist = proj.load_shotlist(folder)
    model = stage_model(paths.root, "lipsync", model_key)
    entry = prices(paths.root).get(model["endpoint"], {})
    price, unit = unit_price(prices(paths.root), model["endpoint"])
    shots = [s for s in shotlist.shots if s.on_camera_speech and (not shot_ids or s.id in shot_ids)]
    if not shots:
        raise UserError("No shots marked on_camera_speech (Shots tab) — nothing to lip-sync.")
    jobs, notes = [], []
    if not model.get("verified"):
        notes.append(f"Model {model['key']!r} is marked unverified in config/models.yaml.")
    for s in shots:
        if not s.approved_clip:
            notes.append(f"{s.id}: skipped — approve a clip first.")
            continue
        if latest_track(folder) is None:
            raise UserError("Build the voice track first (Voice tab).")
        jobs.append(MediaJob(
            label=f"{s.id} lip-sync", out_dir=folder / "clips", stem=f"{s.id}_lipsync", endpoint=model["endpoint"],
            model_key=model["key"], payload=dict(model.get("params", {})), expect="video", ext=".mp4",
            units=billing_units(entry, unit, s.duration), unit=unit, unit_price=price,
            prepare=(lambda shot=s: dict(zip(("video_url", "audio_url"), _segment_inputs(paths, folder, shot)))),
            meta={"shot_id": s.id, "source_clip": s.approved_clip, "shot_seconds": s.duration},
        ))
    return RunPlan(kind="lipsync", project=proj.load_project(folder).slug, stage="clips", jobs=jobs, notes=notes, folder=folder)
