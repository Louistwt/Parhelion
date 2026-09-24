"""Render the storyboard: one self-contained HTML file per version, print-to-PDF friendly."""

from __future__ import annotations

import base64
import io
from pathlib import Path

from jinja2 import Environment, PackageLoader, select_autoescape
from PIL import Image

from .. import project as proj
from ..config import Paths
from ..schemas import utcnow
from ..versioning import IMAGE_EXTS, latest_path, next_path


def thumb_data_uri(path: Path, max_side: int = 900) -> str:
    with Image.open(path) as im:
        im = im.convert("RGB")
        im.thumbnail((max_side, max_side))
        buf = io.BytesIO()
        im.save(buf, format="JPEG", quality=85)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def env() -> Environment:
    return Environment(loader=PackageLoader("parhelion", "templates"), autoescape=select_autoescape(["html", "j2"]))


def build_context(folder: Path) -> dict:
    project = proj.load_project(folder)
    script = proj.load_script(folder)
    shotlist = proj.load_shotlist(folder)
    timing = proj.load_timing(folder)
    kf_dir = folder / "keyframes"

    shots = []
    for s in shotlist.shots:
        image, image_state = None, "missing"
        if s.approved_keyframe and (kf_dir / s.approved_keyframe).exists():
            image, image_state = kf_dir / s.approved_keyframe, "approved"
        elif (latest := latest_path(kf_dir, s.id, IMAGE_EXTS)) is not None:
            image, image_state = latest, "unapproved"
        lines = []
        for lid in s.line_ids:
            line = script.line(lid)
            if line:
                lines.append({"id": lid, "speaker": line.speaker, "text": line.subtitle,
                              "on_screen_text": line.on_screen_text, "sfx": line.sfx})
        shots.append({
            "shot": s, "lines": lines, "image_state": image_state,
            "image_src": thumb_data_uri(image) if image else None,
            "image_name": image.name if image else None,
        })

    claims = {"approved": 0, "unverified": 0, "rejected": 0}
    for c in script.claims:
        claims[c.status] += 1
    return {
        "project": project, "script": script, "shots": shots, "claims": claims,
        "total_seconds": shotlist.shots[-1].end if shotlist.shots else (timing.total_seconds if timing else 0),
        "timing_source": timing.source if timing else "shot list",
        "generated": utcnow(),
    }


def render(folder: Path, paths: Paths) -> Path:
    html = env().get_template("storyboard.html.j2").render(**build_context(folder))
    out = next_path(folder / "output", "storyboard", ".html")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    proj.set_stage(folder, "storyboard", "draft")
    return out
