"""Deterministic checks for scripts and shot lists. No AI, no judgement of quality."""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from ..config import Paths, UserError
from ..schemas import Character, Script, ShotList, Timing
from .prompts import compose_shot_prompt, load_character, script_style, style_key, style_text
from .timing import estimate, speech_chars

TODO_MARKERS = ("[TODO", "[todo", "【TODO")
SPEECH_WORDS = re.compile(r"\b(speak|speaks|speaking|talk|talks|talking|say|says|saying|mouth)\b", re.I)


@dataclass
class Issue:
    level: Literal["error", "warn"]
    where: str
    message: str

    def __str__(self) -> str:
        return f"{self.level.upper():5} {self.where:<12} {self.message}"


def _find_banned(text: str, banned: list[str]) -> list[str]:
    low = text.lower()
    return [t for t in banned if t.lower() in low]


def lint_text(where: str, text: str, banned: list[str]) -> list[Issue]:
    issues: list[Issue] = []
    if any(m in text for m in TODO_MARKERS):
        issues.append(Issue("error", where, "contains a [TODO] placeholder"))
    for term in _find_banned(text, banned):
        issues.append(Issue("error", where, f"banned term: {term!r}"))
    return issues


def lint_markdown(path: Path, banned: list[str]) -> list[Issue]:
    """Light check for a draft script_vN.md during the working session."""
    issues: list[Issue] = []
    for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        issues += lint_text(f"{path.name}:{n}", line, banned)
    return issues


def lint_script(script: Script, pipeline_cfg: dict, banned: list[str], known_characters: set[str]) -> list[Issue]:
    issues: list[Issue] = []
    ids = [l.id for l in script.lines]
    line_ids = set(ids)

    for dup in sorted({i for i in ids if ids.count(i) > 1}):
        issues.append(Issue("error", dup, "duplicate line id"))

    # beats
    if not script.beats:
        issues.append(Issue("error", "beats", "no beats declared"))
    in_beats: set[str] = set()
    for beat in script.beats:
        if not beat.line_ids:
            issues.append(Issue("error", f"beat:{beat.name}", "declared beat has no lines"))
        for lid in beat.line_ids:
            if lid not in line_ids:
                issues.append(Issue("error", f"beat:{beat.name}", f"references missing line {lid}"))
            in_beats.add(lid)
    for lid in ids:
        if lid not in in_beats:
            issues.append(Issue("warn", lid, "line is not in any beat"))

    # characters
    for name in script.characters:
        if name not in known_characters:
            issues.append(Issue("warn", "characters", f"{name!r} has no folder in library/characters/"))

    # lines
    max_shot = float(pipeline_cfg["shots"]["max_seconds"])
    rate = float(pipeline_cfg["speech"]["chars_per_second"][script.language])
    for line in script.lines:
        if not line.text_voice.strip():
            issues.append(Issue("error", line.id, "text_voice is empty"))
        if script.language == "cantonese" and not line.text_subtitle.strip():
            issues.append(Issue("error", line.id, "Cantonese line needs text_subtitle (written Chinese)"))
        if line.speaker != "narrator" and line.speaker not in script.characters:
            issues.append(Issue("warn", line.id, f"speaker {line.speaker!r} not in script.characters"))
        for field in ("text_voice", "text_subtitle", "on_screen_text", "sfx", "emotion"):
            issues += lint_text(line.id, getattr(line, field), banned)
        secs = speech_chars(line.text_voice) / rate
        if secs > max_shot:
            issues.append(
                Issue("warn", line.id, f"{speech_chars(line.text_voice)} chars ≈ {secs:.1f}s — longer than one shot ({max_shot:g}s); consider splitting")
            )

    # total budget
    timing = estimate(script, pipeline_cfg)
    target = script.target_seconds
    if timing.total_seconds > target * 1.1:
        issues.append(
            Issue("error", "total", f"estimated {timing.total_seconds:.1f}s is over target {target:g}s by more than 10% (at {rate:g} chars/s)")
        )
    elif timing.total_seconds < target * 0.7:
        issues.append(Issue("warn", "total", f"estimated {timing.total_seconds:.1f}s is well under target {target:g}s"))

    # claims
    for claim in script.claims:
        issues += lint_text(claim.id, claim.text, banned)
        if not claim.line_ids:
            issues.append(Issue("error", claim.id, "claim is not linked to any line"))
        for lid in claim.line_ids:
            if lid not in line_ids:
                issues.append(Issue("error", claim.id, f"linked to missing line {lid}"))
        if claim.status == "unverified":
            issues.append(Issue("warn", claim.id, "unverified — needs partner fact-check"))
        elif claim.status == "rejected" and any(l in line_ids for l in claim.line_ids):
            issues.append(Issue("error", claim.id, "rejected claim is still used by a line"))
    return issues


def lint_shotlist(
    shotlist: ShotList,
    script: Script,
    timing: Timing | None,
    templates: dict,
    pipeline_cfg: dict,
    banned: list[str],
    paths: Paths,
    folder: Path | None = None,
) -> list[Issue]:
    issues: list[Issue] = []
    lo, hi = float(pipeline_cfg["shots"]["min_seconds"]), float(pipeline_cfg["shots"]["max_seconds"])
    line_ids = {l.id for l in script.lines}
    covered: set[str] = set()
    ids = [s.id for s in shotlist.shots]
    for dup in sorted({i for i in ids if ids.count(i) > 1}):
        issues.append(Issue("error", dup, "duplicate shot id"))

    char_cache: dict[str, Character | None] = {}

    def get_char(name: str) -> Character | None:
        if name not in char_cache:
            try:
                char_cache[name] = load_character(paths, name)
            except UserError:
                char_cache[name] = None
        return char_cache[name]

    # styles: every character's style must exist; the video should use one style
    script_styles: dict[str, list[str]] = {}
    for name in script.characters:
        if (c := get_char(name)) is not None:
            script_styles.setdefault(style_key(templates, c), []).append(name)
    for key, names in script_styles.items():
        try:
            style_text(templates, key)
        except UserError as e:
            issues.append(Issue("error", "characters", f"{', '.join(names)}: {e}"))
    if len(script_styles) > 1:
        mix = "; ".join(f"{k}: {', '.join(v)}" for k, v in script_styles.items())
        issues.append(Issue("warn", "characters", f"characters use different styles ({mix})"))
    fallback_style = script_style(paths, templates, script.characters)
    room = False
    if shotlist.location_ref:
        if folder is not None and not (folder / shotlist.location_ref).is_file():
            issues.append(Issue("error", "location_ref", f"{shotlist.location_ref!r} not found in the project folder"))
        else:
            room = True

    negative = " ".join(templates["negative"].split()).rstrip(".")
    prev_end: float | None = None
    for shot in shotlist.shots:
        w = shot.id
        if shot.end <= shot.start:
            issues.append(Issue("error", w, "end must be after start"))
        elif not (lo <= shot.duration <= hi):
            issues.append(Issue("error", w, f"duration {shot.duration:g}s outside {lo:g}–{hi:g}s"))
        if prev_end is not None:
            gap = round(shot.start - prev_end, 2)
            if gap > 0.05:
                issues.append(Issue("warn", w, f"{gap:g}s gap after previous shot"))
            elif gap < -0.05:
                issues.append(Issue("warn", w, f"overlaps previous shot by {-gap:g}s"))
        prev_end = shot.end

        for lid in shot.line_ids:
            if lid not in line_ids:
                issues.append(Issue("error", w, f"references missing line {lid}"))
            covered.add(lid)
        if not shot.action.strip():
            issues.append(Issue("error", w, "action is empty"))
        if not shot.setting.strip():
            issues.append(Issue("warn", w, "setting is empty"))
        if shot.framing not in templates.get("framings", {}):
            issues.append(Issue("warn", w, f"framing {shot.framing!r} not in prompt_templates framings"))
        if shot.on_camera_speech and not shot.line_ids:
            issues.append(Issue("warn", w, "on_camera_speech=true but the shot has no lines to lip-sync"))
        if shot.on_camera_speech and len(shot.characters) > 1:
            issues.append(Issue("warn", w, "lip-sync shot shows more than one person: it may move the wrong face — "
                                           "use a single-face framing (close-up, or over-the-shoulder toward the speaker)"))
        if not shot.on_camera_speech and SPEECH_WORDS.search(shot.motion_prompt):
            issues.append(Issue("warn", w, "motion_prompt mentions speaking but on_camera_speech is false: the video "
                                           "model will move the mouth without matching the voice"))
        if shot.approved_keyframe and not shot.motion_prompt.strip():
            issues.append(Issue("warn", w, "no motion_prompt — clips will use the action text with subtle movement"))
        for field in ("action", "setting", "notes", "motion_prompt"):
            issues += lint_text(w, getattr(shot, field), banned)

        chars = []
        for name in shot.characters:
            c = get_char(name)
            if c is None:
                issues.append(Issue("error", w, f"character {name!r} not found in library"))
            else:
                chars.append(c)
                if not c.approved_sheets:
                    issues.append(Issue("warn", w, f"{name!r} has no approved sheet — no reference image will be sent"))
        shot_styles = sorted({style_key(templates, c) for c in chars})
        if len(shot_styles) > 1:
            issues.append(Issue("error", w, f"characters in one shot use different styles: {', '.join(shot_styles)}"))
        try:
            prompt = compose_shot_prompt(templates, shot, chars, fallback_style, location=room)
        except UserError as e:
            issues.append(Issue("error", w, str(e)))
            continue
        if negative not in prompt:
            issues.append(Issue("error", w, "composed prompt is missing the negative (no-text) block — check the 'shot' template"))
        for term in _find_banned(prompt, banned):
            issues.append(Issue("error", w, f"banned term in prompt: {term!r}"))

    for lid in sorted(line_ids - covered):
        issues.append(Issue("warn", lid, "line is not covered by any shot"))
    if timing and shotlist.shots:
        diff = abs(shotlist.shots[-1].end - timing.total_seconds)
        if diff > 0.5:
            issues.append(
                Issue("warn", "shots", f"last shot ends at {shotlist.shots[-1].end:g}s but timing total is {timing.total_seconds:g}s")
            )
    return issues
