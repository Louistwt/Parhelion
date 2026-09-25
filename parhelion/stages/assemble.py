"""Rough cut: approved clips (or keyframe stills with a slow zoom) + voice track + subtitles → MP4 + CapCut folder.

Subtitles are rendered to PNG with Pillow and overlaid by FFmpeg, so any ffmpeg build works and Chinese
glyphs come from a known font (config/pipeline.yaml → assembly.subtitle_fonts).
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from .. import project as proj
from ..config import Paths, UserError, pipeline_cfg
from ..media import find_font, probe_duration, run_ffmpeg
from ..schemas import Script, Timing, utcnow
from ..versioning import IMAGE_EXTS, latest_path, next_version
from .voice import latest_track, load_approvals


def srt_time(t: float) -> str:
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def build_srt(script: Script, timing: Timing) -> str:
    out = []
    for i, lt in enumerate(timing.lines, 1):
        line = script.line(lt.line_id)
        text = (line.subtitle if line else "").strip()
        if text:
            out.append(f"{i}\n{srt_time(lt.start)} --> {srt_time(lt.end)}\n{text}\n")
    return "\n".join(out)


def wrap(text: str, font: ImageFont.FreeTypeFont, max_width: int, max_chars: int) -> list[str]:
    lines, cur = [], ""
    for ch in text:
        trial = cur + ch
        if cur and (font.getlength(trial) > max_width or len(trial) > max_chars):
            lines.append(cur)
            cur = ch.lstrip()
        else:
            cur = trial
    if cur:
        lines.append(cur)
    return lines


def render_subtitle_png(text: str, path: Path, *, width: int, font_path: Path, size: int, max_chars: int) -> None:
    font = ImageFont.truetype(str(font_path), size)
    rows = wrap(text, font, width - 120, max_chars)
    line_h = int(size * 1.35)
    img = Image.new("RGBA", (width, line_h * len(rows) + 24), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    for i, row in enumerate(rows):
        w = font.getlength(row)
        draw.text(((width - w) / 2, 12 + i * line_h), row, font=font, fill=(255, 255, 255, 255),
                  stroke_width=max(3, size // 12), stroke_fill=(0, 0, 0, 255))
    img.save(path)


def _segment(src_kind: str, src: Path | None, out: Path, dur: float, cfg: dict) -> None:
    W, H, fps = int(cfg["width"]), int(cfg["height"]), int(cfg["fps"])
    enc = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-r", str(fps), "-an"]
    if src_kind == "clip":
        vf = (f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={fps},setsar=1,"
              f"tpad=stop_mode=clone:stop_duration={dur:.3f}")
        run_ffmpeg(["-i", str(src), "-vf", vf, "-t", f"{dur:.3f}", *enc, str(out)])
    elif src_kind == "still":
        frames = max(1, int(round(dur * fps)))
        z = float(cfg.get("still_zoom", 1.08))
        vf = (f"scale={W * 2}:{H * 2}:force_original_aspect_ratio=increase,crop={W * 2}:{H * 2},"
              f"zoompan=z='1+({z - 1:.4f})*on/{frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={W}x{H}:fps={fps},setsar=1")
        run_ffmpeg(["-loop", "1", "-framerate", str(fps), "-t", f"{dur:.3f}", "-i", str(src), "-vf", vf,
                    "-t", f"{dur:.3f}", *enc, str(out)])
    else:
        run_ffmpeg(["-f", "lavfi", "-i", f"color=c=black:s={W}x{H}:r={fps}", "-t", f"{dur:.3f}", *enc, str(out)])


def assemble(paths: Paths, folder: Path) -> dict:
    cfg = pipeline_cfg(paths.root)["assembly"]
    script = proj.load_script(folder)
    shotlist = proj.load_shotlist(folder)
    timing = proj.load_timing(folder)
    if timing is None:
        raise UserError("No timing yet — estimate timing or build the voice track first.")
    if not shotlist.shots:
        raise UserError("The shot list is empty.")
    track = latest_track(folder) if timing.source == "tts" else None
    total = probe_duration(track) if track else max(timing.total_seconds, shotlist.shots[-1].end)
    font = find_font(cfg["subtitle_fonts"])

    out_dir = folder / "output"
    out_dir.mkdir(parents=True, exist_ok=True)
    v = next_version(out_dir, "rough_cut", ".mp4")
    work = out_dir / f"rough_cut_v{v}_work"
    (work / "segments").mkdir(parents=True, exist_ok=True)
    (work / "subs").mkdir(exist_ok=True)

    # 1) one normalised segment per shot; the shots cover the whole timeline
    report, segs = [], []
    for i, s in enumerate(shotlist.shots):
        start = 0.0 if i == 0 else s.start
        end = total if i == len(shotlist.shots) - 1 else shotlist.shots[i + 1].start
        dur = max(0.2, end - start)
        if s.approved_clip and (folder / "clips" / s.approved_clip).exists():
            kind, src = "clip", folder / "clips" / s.approved_clip
        elif s.approved_keyframe and (folder / "keyframes" / s.approved_keyframe).exists():
            kind, src = "still", folder / "keyframes" / s.approved_keyframe
        elif (latest := latest_path(folder / "keyframes", s.id, IMAGE_EXTS)) is not None:
            kind, src = "still (not approved)", latest
        else:
            kind, src = "black (no image)", None
        seg = work / "segments" / f"{s.id}.mp4"
        _segment("clip" if kind == "clip" else ("still" if src else "black"), src, seg, dur, cfg)
        segs.append(seg)
        report.append({"shot": s.id, "start": round(start, 2), "end": round(end, 2), "source": kind,
                       "file": src.name if src else None, "lines": s.line_ids})

    concat_list = work / "segments.txt"
    concat_list.write_text("".join(f"file '{p.as_posix()}'\n" for p in segs), encoding="utf-8")
    silent = work / "video_silent.mp4"
    run_ffmpeg(["-f", "concat", "-safe", "0", "-i", str(concat_list), "-c", "copy", str(silent)])

    # 2) audio: approved voice track, or silence for an early animatic
    audio_in = ["-i", str(track)] if track else ["-f", "lavfi", "-t", f"{total:.3f}", "-i", "anullsrc=r=44100:cl=mono"]
    audio_enc = ["-c:a", "aac", "-b:a", "192k"]

    clean = out_dir / f"rough_cut_v{v}_clean.mp4"
    run_ffmpeg(["-i", str(silent), *audio_in, "-map", "0:v", "-map", "1:a", "-c:v", "copy", *audio_enc,
                "-t", f"{total:.3f}", str(clean)])

    # 3) subtitles: SRT + burned-in version
    srt = out_dir / f"subtitles_v{v}.srt"
    srt.write_text(build_srt(script, timing), encoding="utf-8")
    W, H = int(cfg["width"]), int(cfg["height"])
    inputs, chain, label = ["-i", str(silent), *audio_in], [], "0:v"
    n = 0
    for lt in timing.lines:
        line = script.line(lt.line_id)
        text = (line.subtitle if line else "").strip()
        if not text:
            continue
        png = work / "subs" / f"{lt.line_id}.png"
        render_subtitle_png(text, png, width=W, font_path=font, size=int(cfg["subtitle_font_size"]),
                            max_chars=int(cfg["subtitle_max_chars_per_line"]))
        inputs += ["-i", str(png)]
        idx = n + 2  # 0 = video, 1 = audio
        out_label = f"v{n + 1}"
        chain.append(f"[{label}][{idx}:v]overlay=x=(W-w)/2:y=H-h-{int(cfg['subtitle_bottom_margin'])}:"
                     f"enable='between(t,{lt.start:.3f},{lt.end:.3f})'[{out_label}]")
        label, n = out_label, n + 1
    burned = out_dir / f"rough_cut_v{v}.mp4"
    if chain:
        run_ffmpeg([*inputs, "-filter_complex", ";".join(chain), "-map", f"[{label}]", "-map", "1:a",
                    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", *audio_enc,
                    "-t", f"{total:.3f}", str(burned)])
    else:
        shutil.copy2(clean, burned)

    # 4) CapCut hand-off folder
    capcut = out_dir / f"capcut_v{v}"
    (capcut / "clips").mkdir(parents=True, exist_ok=True)
    (capcut / "audio").mkdir(exist_ok=True)
    for seg in segs:
        shutil.copy2(seg, capcut / "clips" / seg.name)
    approved_audio = load_approvals(folder)
    for line_id, fname in approved_audio.items():
        f = folder / "audio" / fname
        if f.exists():
            shutil.copy2(f, capcut / "audio" / f"{line_id}{f.suffix}")
    if track:
        shutil.copy2(track, capcut / "audio" / "voice_track.wav")
    shutil.copy2(srt, capcut / "subtitles.srt")
    readme = [f"# CapCut hand-off — {script.title}", "", f"Rendered {utcnow()} · total {total:.2f}s · 1080×1920 @ {cfg['fps']} fps", "",
              "1. New project (9:16). Import `clips/` in order S01, S02, … onto the video track (each is already cut to length).",
              "2. Import `audio/voice_track.wav` on the audio track at 0:00 (per-line files are in `audio/` if you want to retime).",
              "3. Captions → Import → `subtitles.srt` (Simplified Chinese).",
              "4. Add SFX, stickers, music, on-screen text. Never put company names on screen.", "",
              "| Shot | Start | End | Source | Lines |", "|---|---|---|---|---|"]
    for r in report:
        readme.append(f"| {r['shot']} | {r['start']:.2f} | {r['end']:.2f} | {r['source']} | {', '.join(r['lines'])} |")
    (capcut / "README.md").write_text("\n".join(readme) + "\n", encoding="utf-8")

    summary = {"version": v, "rough_cut": burned.name, "clean": clean.name, "srt": srt.name, "capcut": capcut.name,
               "duration": round(total, 2), "voice": track.name if track else None, "shots": report, "created": utcnow()}
    (out_dir / f"rough_cut_v{v}.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    shutil.rmtree(work, ignore_errors=True)
    proj.set_stage(folder, "video", "draft")
    return summary


def renders(folder: Path) -> list[dict]:
    out = []
    for p in sorted((folder / "output").glob("rough_cut_v*.json"), key=lambda p: int(p.stem.split("_v")[-1]), reverse=True):
        try:
            out.append(json.loads(p.read_text(encoding="utf-8")))
        except (OSError, ValueError):
            pass
    return out
