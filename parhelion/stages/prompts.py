"""Compose image prompts from library/prompt_templates.yaml + character files. No AI."""

from __future__ import annotations

import re
from pathlib import Path

import yaml

from ..config import Paths, UserError
from ..schemas import Character, Shot


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


def approved_sheet_paths(paths: Paths, char: Character) -> list[Path]:
    return [character_dir(paths, char.name) / s for s in char.approved_sheets]


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


def compose_shot_prompt(templates: dict, shot: Shot, chars: list[Character], fallback_style: str | None = None) -> str:
    """Style comes from the shot's characters (lint makes sure they agree); shots without people use fallback_style."""
    key = style_key(templates, chars[0]) if chars else fallback_style
    framing = templates.get("framings", {}).get(shot.framing, shot.framing)
    props = f"Props: {', '.join(shot.props)}. " if shot.props else ""
    return _clean(
        templates["shot"].format(
            style=style_text(templates, key),
            framing=_clean(framing).rstrip("."),
            setting=_clean(shot.setting).rstrip(".") or "unspecified",
            characters=characters_text(chars),
            action=_clean(shot.action).rstrip("."),
            props=props,
            negative=_clean(templates["negative"]).rstrip("."),
        )
    )


def compose_character_prompt(templates: dict, char: Character) -> str:
    return _clean(
        templates["character_sheet"].format(
            style=style_text(templates, style_key(templates, char)),
            character=_sentence(plain_text(char.prompt_block)),
            negative=_clean(templates["negative"]).rstrip("."),
        )
    )
