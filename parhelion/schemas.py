"""Pydantic models for every JSON file the pipeline reads or writes."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field

Language = Literal["mandarin", "cantonese"]
ClaimStatus = Literal["unverified", "approved", "rejected"]


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# ---------- script.json ----------


class Beat(BaseModel):
    name: str
    line_ids: list[str] = []


class Line(BaseModel):
    id: str
    speaker: str
    text_voice: str
    text_subtitle: str = ""
    emotion: str = ""
    on_screen_text: str = ""
    sfx: str = ""

    @property
    def subtitle(self) -> str:
        return self.text_subtitle or self.text_voice


class Claim(BaseModel):
    id: str
    text: str
    line_ids: list[str] = []
    status: ClaimStatus = "unverified"
    note: str = ""


class Script(BaseModel):
    title: str
    language: Language
    target_seconds: float
    format: str = ""
    characters: list[str] = []
    beats: list[Beat] = []
    lines: list[Line] = []
    claims: list[Claim] = []

    def line(self, line_id: str) -> Line | None:
        return next((l for l in self.lines if l.id == line_id), None)


# ---------- timing.json ----------


class LineTiming(BaseModel):
    line_id: str
    chars: int
    start: float
    end: float

    @property
    def duration(self) -> float:
        return round(self.end - self.start, 2)


class Timing(BaseModel):
    source: Literal["estimate", "tts"] = "estimate"
    chars_per_second: float
    total_seconds: float
    lines: list[LineTiming] = []


# ---------- shotlist.json ----------


class Shot(BaseModel):
    id: str
    start: float
    end: float
    line_ids: list[str] = []
    framing: str = "medium"
    characters: list[str] = []
    props: list[str] = []
    setting: str = ""
    action: str = ""
    on_camera_speech: bool = False
    notes: str = ""
    motion_prompt: str = ""
    camera: str = ""  # simple camera move for image-to-video, e.g. "slow push in"
    approved_keyframe: str | None = None
    approved_clip: str | None = None

    @property
    def duration(self) -> float:
        return round(self.end - self.start, 2)


class ShotList(BaseModel):
    shots: list[Shot] = []

    def shot(self, shot_id: str) -> Shot | None:
        return next((s for s in self.shots if s.id == shot_id), None)


# ---------- project.json ----------


class Approval(BaseModel):
    what: str
    value: str
    by: str = "operator"
    at: str = Field(default_factory=utcnow)


class Project(BaseModel):
    slug: str
    language: Language
    target_seconds: float
    created: str = Field(default_factory=utcnow)
    stages: dict[str, str] = Field(
        default_factory=lambda: {
            "brief": "todo",
            "script": "todo",
            "timing": "todo",
            "shotlist": "todo",
            "keyframes": "todo",
            "storyboard": "todo",
            "voice": "todo",
            "clips": "todo",
            "video": "todo",
        }
    )
    approvals: list[Approval] = []
    models: dict[str, str] = {}


# ---------- characters ----------


class Voice(BaseModel):
    voice_id: str
    speed: float = 1.0
    pitch: int = 0
    emotion: str | None = None


class Character(BaseModel):
    name: str
    display_name: str = ""
    prompt_block: str
    style: str | None = None  # key in prompt_templates.yaml `styles`; None = default_style
    approved_sheets: list[str] = []
    voice: Voice | None = None


# ---------- cost ledger ----------


class CostEntry(BaseModel):
    ts: str = Field(default_factory=utcnow)
    project: str  # project slug, or "library" for character sheets
    stage: str
    provider: str
    model: str  # endpoint id
    units: float
    unit: str = "image"
    est_cost_usd: float
    actual_cost_usd: float | None = None
    request_id: str | None = None
    status: Literal["ok", "failed", "dry-run"] = "ok"
    note: str = ""
