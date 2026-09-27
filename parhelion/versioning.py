"""Never overwrite generated media: every output gets the next free _vN suffix.

`exts` may be one extension (".html") or several (IMAGE_EXTS) — version numbers are shared
across them, so S01_v1.png and S01_v2.jpg never collide.

Unwanted outputs are never deleted: `discard` moves them (and their .json sidecar) into a
`discarded/` subfolder, which still counts towards the next version number.
"""

from __future__ import annotations

import re
import shutil
from pathlib import Path

from .config import UserError

IMAGE_EXTS = (".png", ".jpg", ".jpeg", ".webp")
DISCARDED = "discarded"


def _as_tuple(exts: str | tuple[str, ...]) -> tuple[str, ...]:
    return (exts,) if isinstance(exts, str) else tuple(exts)


def _versions(directory: Path, stem: str, exts: str | tuple[str, ...]) -> dict[int, Path]:
    if not directory.exists():
        return {}
    pat = re.compile(rf"^{re.escape(stem)}_v(\d+)(\.[A-Za-z0-9]+)$")
    allowed = {e.lower() for e in _as_tuple(exts)}
    found: dict[int, Path] = {}
    for p in directory.iterdir():
        m = pat.match(p.name)
        if m and m.group(2).lower() in allowed:
            found[int(m.group(1))] = p
    return found


def existing_versions(directory: Path, stem: str, exts: str | tuple[str, ...]) -> list[int]:
    return sorted(_versions(directory, stem, exts))


def next_version(directory: Path, stem: str, exts: str | tuple[str, ...]) -> int:
    versions = existing_versions(directory, stem, exts) + existing_versions(directory / DISCARDED, stem, exts)
    return (max(versions) + 1) if versions else 1


def next_path(directory: Path, stem: str, ext: str, exts: str | tuple[str, ...] | None = None) -> Path:
    """Path for the next version, e.g. keyframes/S01_v3.png. `exts` = extensions sharing the counter."""
    return directory / f"{stem}_v{next_version(directory, stem, exts or ext)}{ext}"


def find_version(directory: Path, stem: str, version: int, exts: str | tuple[str, ...]) -> Path | None:
    return _versions(directory, stem, exts).get(version)


def latest_path(directory: Path, stem: str, exts: str | tuple[str, ...]) -> Path | None:
    found = _versions(directory, stem, exts)
    return found[max(found)] if found else None


def all_paths(directory: Path, stem: str, exts: str | tuple[str, ...]) -> list[Path]:
    found = _versions(directory, stem, exts)
    return [found[v] for v in sorted(found)]


def discard(path: Path) -> Path:
    """Move a generated file and its .json sidecar into <dir>/discarded/. Returns the new path."""
    target_dir = path.parent / DISCARDED
    target_dir.mkdir(exist_ok=True)
    sidecar = path.with_suffix(".json")
    if sidecar.exists() and sidecar != path:
        shutil.move(str(sidecar), str(target_dir / sidecar.name))
    return Path(shutil.move(str(path), str(target_dir / path.name)))


def parse_version(text: str) -> int:
    """Accept 'v2', 'V2' or '2'."""
    t = text.strip().lower().lstrip("v")
    if not t.isdigit():
        raise UserError(f"Version must look like v2 or 2, got {text!r}")
    return int(t)
