"""Compose image prompts from library/prompt_templates.yaml + character files. No AI."""

from __future__ import annotations

from pathlib import Path

import yaml

from ..config import Paths
from ..schemas import Character, Shot


def character_dir(paths: Paths, name: str) -> Path:
    return paths.characters / name


def load_character(paths: Paths, name: str) -> Character:
    f = character_dir(paths, name) / "character.yaml"
    if not f.exists():
        raise SystemExit(
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


def characters_text(chars: list[Character]) -> str:
    if not chars:
        return "No people in frame."
    parts = [f"{c.display_name or c.name}: {_sentence(c.prompt_block)}" for c in chars]
    prefix = "Character — " if len(chars) == 1 else f"{len(chars)} characters — "
    return prefix + " ".join(parts)


def compose_shot_prompt(templates: dict, shot: Shot, chars: list[Character]) -> str:
    framing = templates.get("framings", {}).get(shot.framing, shot.framing)
    props = f"Props: {', '.join(shot.props)}. " if shot.props else ""
    return _clean(
        templates["shot"].format(
            style=_clean(templates["style"]).rstrip("."),
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
            style=_clean(templates["style"]).rstrip("."),
            character=_sentence(char.prompt_block),
            negative=_clean(templates["negative"]).rstrip("."),
        )
    )
