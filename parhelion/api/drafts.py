"""Human-editable text files: brief (with history), script drafts (always new versions), feedback notes."""

from __future__ import annotations

import re
import shutil
from datetime import datetime, timezone
from pathlib import Path

from ..config import UserError
from ..versioning import all_paths, find_version, next_version

HUMAN_HEADER = re.compile(r"^<!-- edited by human in Parhelion UI.*?-->\n?", re.S)


def _stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


# ---------- brief ----------


def read_brief(folder: Path) -> str:
    f = folder / "brief.md"
    return f.read_text(encoding="utf-8") if f.exists() else ""


def save_brief(folder: Path, text: str) -> None:
    f = folder / "brief.md"
    if f.exists():
        if f.read_text(encoding="utf-8") == text:
            return
        hist = folder / ".history"
        hist.mkdir(exist_ok=True)
        shutil.copy2(f, hist / f"brief_{_stamp()}.md")
    f.write_text(text, encoding="utf-8")


# ---------- script drafts ----------


def feedback_path(folder: Path, version: int) -> Path:
    return folder / f"script_v{version}.feedback.md"


def list_drafts(folder: Path) -> list[dict]:
    out = []
    for p in all_paths(folder, "script", ".md"):
        v = int(p.stem.rsplit("_v", 1)[1])
        text = p.read_text(encoding="utf-8")
        fb = feedback_path(folder, v)
        out.append({
            "version": v,
            "name": p.name,
            "modified": datetime.fromtimestamp(p.stat().st_mtime, timezone.utc).isoformat(timespec="seconds"),
            "edited_by_human": bool(HUMAN_HEADER.match(text)),
            "has_feedback": fb.exists() and bool(fb.read_text(encoding="utf-8").strip()),
        })
    return out


def read_draft(folder: Path, version: int) -> str:
    f = find_version(folder, "script", version, ".md")
    if f is None:
        raise UserError(f"No script_v{version}.md")
    return f.read_text(encoding="utf-8")


def save_new_draft(folder: Path, text: str, based_on: int | None) -> int:
    """Never overwrites: writes script_v(N+1).md with a header saying a human edited it."""
    v = next_version(folder, "script", ".md")
    body = HUMAN_HEADER.sub("", text, count=1)
    base = f", based on v{based_on}" if based_on else ""
    header = f"<!-- edited by human in Parhelion UI{base}, {datetime.now(timezone.utc).isoformat(timespec='seconds')} -->\n"
    (folder / f"script_v{v}.md").write_text(header + body, encoding="utf-8")
    return v


def read_feedback(folder: Path, version: int) -> str:
    f = feedback_path(folder, version)
    return f.read_text(encoding="utf-8") if f.exists() else ""


def save_feedback(folder: Path, version: int, text: str) -> None:
    if find_version(folder, "script", version, ".md") is None:
        raise UserError(f"No script_v{version}.md")
    feedback_path(folder, version).write_text(text, encoding="utf-8")


def claude_prompt(folder: Path, root: Path) -> str:
    """Exact instruction to paste into Claude Code for the next script round."""
    rel = folder.relative_to(root)
    drafts = list_drafts(folder)
    if not drafts:
        return (
            f"Read CLAUDE.md and {rel}/brief.md. Following the script working session rules, "
            f"propose an outline and a first draft as {rel}/script_v1.md. Mark anything humans still "
            f"need to write as [TODO: …]. Put every medical/insurance fact in a claims list as unverified."
        )
    last = drafts[-1]["version"]
    files = [f"{rel}/brief.md", f"{rel}/script_v{last}.md"]
    if feedback_path(folder, last).exists():
        files.append(f"{rel}/script_v{last}.feedback.md")
    return (
        f"Read CLAUDE.md, {', '.join(files)}. Apply the feedback and write the next draft as "
        f"{rel}/script_v{last + 1}.md (do not edit earlier versions). Keep [TODO: …] for lines humans "
        f"must write, and list any new facts as unverified claims. If we agree this draft is final, "
        f"convert it to {rel}/script.json and run `uv run parhelion lint {folder.name}`."
    )
