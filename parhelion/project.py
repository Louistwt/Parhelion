"""Project folders: create, locate, load and save JSON files."""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from typing import TypeVar

from pydantic import BaseModel

from .config import Paths
from .schemas import Approval, Project, Script, ShotList, Timing
from .versioning import latest_path

M = TypeVar("M", bound=BaseModel)

BRIEF_TEMPLATE = """# Brief — {slug}

Written by humans. Claude uses this to propose an outline; it does not change it.

- **Language:** {language}
- **Target length:** {seconds}s
- **Format:** (skit / talking-head / explainer / Q&A / …)
- **Tone:** (set by humans)
- **Characters:** (names from library/characters/)
- **Audience takeaway / key point:** (one HK vs mainland difference, from partner)
- **"What to say" line for agents:** (optional, humans may draft)

## Beats
Default template — edit, reorder or replace to suit the format:
1. hook
2. setup
3. key_point
4. what_to_say
5. close

## Facts to use (partner-supplied, with source)
-

## Must avoid
-

## Notes / ideas
-
"""


def resolve(paths: Paths, name: str) -> Path:
    """Accept a full folder name, a path, or just the slug (unique suffix match)."""
    direct = Path(name)
    if direct.is_dir() and (direct / "project.json").exists():
        return direct.resolve()
    candidate = paths.projects / name
    if candidate.is_dir():
        return candidate
    matches = [p for p in paths.projects.glob(f"*-{name}") if p.is_dir()] if paths.projects.exists() else []
    if len(matches) == 1:
        return matches[0]
    if len(matches) > 1:
        raise SystemExit(f"Ambiguous project {name!r}: {', '.join(m.name for m in matches)}")
    raise SystemExit(f"Project {name!r} not found under {paths.projects}")


def create(paths: Paths, slug: str, language: str, seconds: float) -> Path:
    folder = paths.projects / f"{date.today().isoformat()}-{slug}"
    if folder.exists():
        raise SystemExit(f"{folder} already exists")
    for sub in ("keyframes", "output"):
        (folder / sub).mkdir(parents=True)
    save(folder / "project.json", Project(slug=slug, language=language, target_seconds=seconds))
    (folder / "brief.md").write_text(
        BRIEF_TEMPLATE.format(slug=slug, language=language, seconds=int(seconds)), encoding="utf-8"
    )
    return folder


def load(path: Path, model: type[M]) -> M:
    return model.model_validate_json(path.read_text(encoding="utf-8"))


def save(path: Path, obj: BaseModel) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(obj.model_dump_json(indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


def write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def load_project(folder: Path) -> Project:
    return load(folder / "project.json", Project)


def load_script(folder: Path) -> Script:
    path = folder / "script.json"
    if not path.exists():
        raise SystemExit(f"No script.json in {folder.name} — agree the script first (see CLAUDE.md).")
    return load(path, Script)


def load_timing(folder: Path) -> Timing | None:
    path = folder / "timing.json"
    return load(path, Timing) if path.exists() else None


def load_shotlist(folder: Path) -> ShotList:
    path = folder / "shotlist.json"
    if not path.exists():
        raise SystemExit(f"No shotlist.json in {folder.name}.")
    return load(path, ShotList)


def set_stage(folder: Path, stage: str, status: str) -> None:
    proj = load_project(folder)
    proj.stages[stage] = status
    save(folder / "project.json", proj)


def record_approval(folder: Path, what: str, value: str) -> None:
    proj = load_project(folder)
    proj.approvals.append(Approval(what=what, value=value))
    save(folder / "project.json", proj)


def latest_script_md(folder: Path) -> Path | None:
    return latest_path(folder, "script", ".md")
