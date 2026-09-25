"""FFmpeg helpers. Uses system ffmpeg if installed, otherwise the binary bundled with imageio-ffmpeg."""

from __future__ import annotations

import re
import shutil
import subprocess
from functools import lru_cache
from pathlib import Path

from .config import UserError


@lru_cache(maxsize=1)
def ffmpeg_exe() -> str:
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception as e:  # pragma: no cover
        raise UserError(f"ffmpeg not found. Install it with `sudo apt install ffmpeg` ({e})")


def run_ffmpeg(args: list[str]) -> None:
    cmd = [ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", *args]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise UserError(f"ffmpeg failed: {res.stderr.strip()[-800:]}")


_DURATION = re.compile(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)")


def probe_duration(path: Path) -> float:
    """Media duration in seconds (parsed from ffmpeg's header output; no ffprobe needed)."""
    res = subprocess.run([ffmpeg_exe(), "-hide_banner", "-i", str(path)], capture_output=True, text=True)
    m = _DURATION.search(res.stderr)
    if not m:
        raise UserError(f"Could not read duration of {path.name}")
    h, mnt, s = m.groups()
    return round(int(h) * 3600 + int(mnt) * 60 + float(s), 3)


def has_stream(path: Path, kind: str) -> bool:
    res = subprocess.run([ffmpeg_exe(), "-hide_banner", "-i", str(path)], capture_output=True, text=True)
    return f"Stream #" in res.stderr and f": {kind.capitalize()}:" in res.stderr


def video_size(path: Path) -> tuple[int, int] | None:
    res = subprocess.run([ffmpeg_exe(), "-hide_banner", "-i", str(path)], capture_output=True, text=True)
    m = re.search(r"Video:.*?(\d{2,5})x(\d{2,5})", res.stderr)
    return (int(m.group(1)), int(m.group(2))) if m else None


def find_font(candidates: list[str]) -> Path:
    for c in candidates:
        if Path(c).exists():
            return Path(c)
    raise UserError(
        "No Chinese font found for subtitles. Run `sudo apt install fonts-noto-cjk`, "
        "or add a font path to assembly.subtitle_fonts in config/pipeline.yaml."
    )


def system_status(font_candidates: list[str]) -> dict:
    status = {"ffmpeg": None, "ffmpeg_source": None, "font": None}
    try:
        exe = ffmpeg_exe()
        status["ffmpeg"] = exe
        status["ffmpeg_source"] = "system" if shutil.which("ffmpeg") else "bundled (imageio-ffmpeg)"
    except UserError:
        pass
    try:
        status["font"] = str(find_font(font_candidates))
    except UserError:
        pass
    return status
