"""Move shot boundaries onto the real line timing (deterministic, no AI)."""

from __future__ import annotations

from pathlib import Path

from .. import project as proj
from ..config import Paths, UserError, pipeline_cfg
from ..schemas import ShotList, Timing


def retime(shotlist: ShotList, timing: Timing) -> tuple[ShotList, list[str]]:
    """Shots partition the audio timeline. A shot with lines starts when its first line starts (unless that line
    is shared with the previous shot); lineless shots fill the gap between their neighbours."""
    lines = {l.line_id: l for l in timing.lines}
    shots = shotlist.shots
    n = len(shots)
    if n == 0:
        return shotlist, []
    total = timing.total_seconds
    bounds = [0.0] * (n + 1)
    bounds[n] = total
    old_total = max(shots[-1].end, 0.001)
    for i in range(1, n):
        prev, cur = shots[i - 1], shots[i]
        cur_lines = [lines[x] for x in cur.line_ids if x in lines]
        prev_lines = [lines[x] for x in prev.line_ids if x in lines]
        if cur_lines and cur.line_ids[0] not in prev.line_ids:
            b = min(l.start for l in cur_lines)
        elif prev_lines and prev.line_ids[-1] not in cur.line_ids:
            b = max(l.end for l in prev_lines)
        else:  # shared line or both lineless: keep the old proportion
            b = cur.start / old_total * total
        bounds[i] = max(bounds[i - 1], min(b, total))
    out = shotlist.model_copy(deep=True)
    for i, s in enumerate(out.shots):
        s.start, s.end = round(bounds[i], 2), round(bounds[i + 1], 2)
    return out, []


def run(paths: Paths, folder: Path) -> tuple[ShotList, list[str]]:
    timing = proj.load_timing(folder)
    if timing is None or timing.source != "tts":
        raise UserError("Build the voice track first (Voice tab → Build timing) so timing comes from real audio.")
    old = proj.load_shotlist(folder)
    new, _ = retime(old, timing)
    hist = folder / ".history"
    hist.mkdir(exist_ok=True)
    from datetime import datetime, timezone

    proj.save(hist / f"shotlist_{datetime.now(timezone.utc):%Y%m%dT%H%M%SZ}.json", old)
    lo, hi = (float(pipeline_cfg(paths.root)["shots"][k]) for k in ("min_seconds", "max_seconds"))
    issues = [f"{s.id}: {s.duration:g}s is outside {lo:g}–{hi:g}s" for s in new.shots if not lo <= s.duration <= hi]
    proj.save(folder / "shotlist.json", new)
    return new, issues
