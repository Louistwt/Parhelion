"""Compose image prompts from library/prompt_templates.yaml + character files. No AI."""

from __future__ import annotations

import re
from pathlib import Path

import yaml

from ..config import Paths, UserError
from ..schemas import DEFAULT_LOOK, Character, Shot, ShotList


def character_dir(paths: Paths, name: str) -> Path:
    return paths.characters / name


def load_character(paths: Paths, name: str) -> Character:
    f = character_dir(paths, name) / "character.yaml"
    if not f.exists():
        raise UserError(
            f"Character {name!r} not found. Copy library/characters/_template to library/characters/{name}/"
        )
    data = yaml.safe_load(f.read_text(encoding="utf-8")) or {}
    data.setdefault("name", name)
    return Character.model_validate(data)


def save_character(paths: Paths, char: Character) -> None:
    f = character_dir(paths, char.name) / "character.yaml"
    f.write_text(yaml.safe_dump(char.model_dump(), allow_unicode=True, sort_keys=False), encoding="utf-8")


def with_look(char: Character, look: str | None) -> Character:
    """The character as it appears in one look, ready for a prompt: prompt_block = the person + that look's outfit,
    approved_sheets = that look's sheets. Face photo, style and voice are shared by every look."""
    style, face = char.style, char.face_ref
    if not look or look == DEFAULT_LOOK:
        outfit, sheets, ref = char.outfit, char.approved_sheets, char.reference
    elif look in char.looks:
        lk = char.looks[look]
        outfit, sheets, style, ref = lk.outfit, lk.approved_sheets, lk.style or char.style, lk.reference
        face = char.face_ref if lk.use_face_ref else None
    else:
        known = ", ".join([DEFAULT_LOOK, *char.looks])
        raise UserError(f"Character {char.name!r} has no look {look!r}. Looks: {known}")
    text = "\n".join(p for p in (char.prompt_block.strip(), outfit.strip()) if p)  # plain_text makes them sentences
    return char.model_copy(update={"prompt_block": text, "outfit": "", "approved_sheets": list(sheets),
                                   "style": style, "face_ref": face, "reference": ref})


def look_for(shotlist: ShotList, shot: Shot, name: str, cast: dict[str, str] | None = None) -> str:
    """The look a character wears in a shot: the shot's override, else the video's cast (project.json), else the
    older shotlist-level choice, else the main look."""
    return shot.looks.get(name) or (cast or {}).get(name) or shotlist.looks.get(name) or DEFAULT_LOOK


def shot_characters(paths: Paths, shotlist: ShotList, shot: Shot, cast: dict[str, str] | None = None) -> list[Character]:
    """The shot's characters, each in the look it wears there (so prompt text, references and legend agree)."""
    return [with_look(load_character(paths, c), look_for(shotlist, shot, c, cast)) for c in shot.characters]


def approved_sheet_paths(paths: Paths, char: Character) -> list[Path]:
    return [character_dir(paths, char.name) / s for s in char.approved_sheets]


def reference_parts(char: Character) -> list[tuple[str, str]]:
    """What a keyframe gets for this character, in order: its face close-up (face_ref) and its most recently approved
    sheet (full body). One sheet only: several unlabelled sheets made features jump between characters, and a
    full-body sheet alone leaves the face too small (the model then invents it, e.g. older)."""
    parts = [(char.face_ref, "face close-up")] if char.face_ref else []
    sheets = [s for s in char.approved_sheets if s != char.face_ref]
    if sheets:  # the pinned reference if it is still approved, else the most recently approved
        parts.append((char.reference if char.reference in sheets else sheets[-1], "full body"))
    return parts


def reference_images(paths: Paths, char: Character) -> list[Path]:
    return [character_dir(paths, char.name) / f for f, _ in reference_parts(char)]


def _clean(text: str) -> str:
    return " ".join(text.split())


def _sentence(text: str) -> str:
    text = _clean(text).rstrip(".")
    return f"{text}." if text else ""


_HEADING = re.compile(r"(\*\*|__)[^*_]+\1:?|#+ .*")
_BULLET = re.compile(r"^([*\-•]|\d+\.)\s+")


def plain_text(text: str) -> str:
    """Flatten a markdown-ish look description into plain sentences for an image prompt:
    heading-only lines are dropped, bullets and ** / __ markers removed, one sentence per line."""
    parts = []
    for raw in text.splitlines():
        line = _BULLET.sub("", raw.strip())
        if not line or _HEADING.fullmatch(line):
            continue
        line = line.replace("**", "").replace("__", "").strip().rstrip(".;,")
        if line:
            parts.append(line)
    return ". ".join(parts)


# ---------- styles ----------


def styles(templates: dict) -> dict[str, str]:
    """Named style blocks. An old single `style:` key counts as one style called 'default'."""
    if "styles" in templates:
        return dict(templates["styles"])
    return {"default": templates["style"]}


def default_style(templates: dict) -> str:
    return templates.get("default_style") or next(iter(styles(templates)))


def style_key(templates: dict, char: Character) -> str:
    return char.style or default_style(templates)


def style_text(templates: dict, key: str | None) -> str:
    key = key or default_style(templates)
    table = styles(templates)
    if key not in table:
        raise UserError(f"Unknown style {key!r}. Choose one of: {', '.join(table)} (library/prompt_templates.yaml)")
    return _clean(table[key]).rstrip(".")


def script_style(paths: Paths, templates: dict, names: list[str]) -> str | None:
    """Style for shots with no characters in them: the style of the first of the script's characters that exists."""
    for name in names:
        try:
            return style_key(templates, load_character(paths, name))
        except UserError:
            continue
    return None


def characters_text(chars: list[Character]) -> str:
    if not chars:
        return "No people in frame."
    parts = [f"{c.display_name or c.name}: {_sentence(plain_text(c.prompt_block))}" for c in chars]
    prefix = "Character — " if len(chars) == 1 else f"{len(chars)} characters — "
    return prefix + " ".join(parts)


def reference_legend(chars: list[Character], location: bool = False) -> str:
    """Tells the model which reference image is which. Order matches keyframes.build: each character's
    reference_parts, then the room (location_ref) last."""
    entries = [f"{c.display_name or c.name} ({kind})" for c in chars for _, kind in reference_parts(c)]
    if location:
        entries.append("the room")
    if not entries:
        return ""
    order = ", ".join(f"image {i} = {e}" for i, e in enumerate(entries, 1))
    text = f"Reference images in order: {order}."
    if len(entries) > (1 if location else 0):
        text += (" Keep each person's face exactly as in their face close-up (if given), and their hairstyle, facial hair, "
                 "glasses (or no glasses), body shape and clothes exactly as in their references; never swap features "
                 "between people.")
    if location:
        text += " Keep the same room, furniture, window and light as the room image."
    return text


def compose_shot_prompt(
    templates: dict, shot: Shot, chars: list[Character], fallback_style: str | None = None, location: bool = False,
) -> str:
    """Style comes from the shot's characters (lint makes sure they agree); shots without people use fallback_style."""
    key = style_key(templates, chars[0]) if chars else fallback_style
    framing = templates.get("framings", {}).get(shot.framing, shot.framing)
    props = f"Props: {', '.join(shot.props)}. " if shot.props else ""
    legend = reference_legend(chars, location)
    return _clean((
        templates["shot"].format(
            style=style_text(templates, key),
            framing=_clean(framing).rstrip("."),
            setting=_clean(shot.setting).rstrip(".") or "unspecified",
            characters=characters_text(chars),
            action=_clean(shot.action).rstrip("."),
            props=props,
            negative=_clean(templates["negative"]).rstrip("."),
        )
        + (f" {legend}" if legend else "")
    ))


SHEET_FROM_REFERENCE = (
    "The reference image shows this person. Keep the face, hairstyle and glasses exactly as in the reference; "
    "ignore the clothes, pose and background of the reference and use the outfit and body described here."
)


def sheet_style_text(templates: dict, key: str | None) -> str:
    """Style words for a character sheet: `sheet_styles` when the style has an entry there, else the normal style."""
    key = key or default_style(templates)
    override = (templates.get("sheet_styles") or {}).get(key)
    return _clean(override).rstrip(".") if override else style_text(templates, key)


def compose_face_prompt(templates: dict, char: Character) -> str:
    """A close-up portrait that becomes the face reference of a character whose face was only described."""
    return _clean(templates["face_portrait"].format(
        style=sheet_style_text(templates, style_key(templates, char)),
        character=_sentence(plain_text(char.prompt_block)),
        negative=_clean(templates["negative"]).rstrip("."),
    ))


def compose_character_prompt(templates: dict, char: Character, with_reference: bool = False) -> str:
    return _clean(
        templates["character_sheet"].format(
            style=sheet_style_text(templates, style_key(templates, char)),
            character=_sentence(plain_text(char.prompt_block)),
            negative=_clean(templates["negative"]).rstrip("."),
        )
        + (f" {SHEET_FROM_REFERENCE}" if with_reference else "")
    )
