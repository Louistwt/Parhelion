"""Character reference sheets, stored in library/characters/<name>/ and reused across videos."""

from __future__ import annotations

from ..config import Paths, UserError, image_model, prices, prompt_templates
from ..cost import unit_price
from ..providers.base import ImageJob
from ..versioning import IMAGE_EXTS, all_paths, find_version
from .imagegen import PlannedJob
from .imagegen_plan import RunPlan
from .prompts import approved_sheet_paths, character_dir, compose_character_prompt, load_character, save_character


def sheet_params(model: dict) -> dict:
    """Sheets are three full-body views in a row, so they use the model's landscape `sheet_params` (models.yaml)."""
    return {**model.get("params", {}), **model.get("sheet_params", {})}


def build(paths: Paths, name: str, *, n: int, model_key: str | None, use_approved: bool = False, seed: int | None = None) -> RunPlan:
    """Plan a sheet run. No side effects, no spend."""
    char = load_character(paths, name)
    model = image_model(paths.root, model_key)
    refs = approved_sheet_paths(paths, char) if use_approved else []
    endpoint = model["edit_endpoint"] if refs else model["text_endpoint"]
    price, unit = unit_price(prices(paths.root), endpoint)
    job = PlannedJob(
        label=f"{name} sheet", out_dir=character_dir(paths, name), stem="sheet", endpoint=endpoint,
        model_key=model["key"], unit_price=price, unit=unit,
        job=ImageJob(prompt=compose_character_prompt(prompt_templates(paths.root), char), num_images=n,
                     reference_images=refs, seed=seed, params=sheet_params(model)),
    )
    notes = []
    if not model.get("verified"):
        notes.append(f"Model {model['key']!r} is marked unverified in config/models.yaml.")
    return RunPlan(kind="character", project="library", stage="character", jobs=[job], notes=notes)


def sheets(paths: Paths, name: str) -> list[str]:
    return [p.name for p in all_paths(character_dir(paths, name), "sheet", IMAGE_EXTS)]


def approve(paths: Paths, name: str, version: int) -> str:
    char = load_character(paths, name)
    f = find_version(character_dir(paths, name), "sheet", version, IMAGE_EXTS)
    if f is None:
        raise UserError(f"No sheet_v{version} for {name}")
    if f.name not in char.approved_sheets:
        char.approved_sheets.append(f.name)
        save_character(paths, char)
    return f.name


def unapprove(paths: Paths, name: str, version: int) -> str:
    char = load_character(paths, name)
    f = find_version(character_dir(paths, name), "sheet", version, IMAGE_EXTS)
    if f is None:
        raise UserError(f"No sheet_v{version} for {name}")
    if f.name in char.approved_sheets:
        char.approved_sheets.remove(f.name)
        save_character(paths, char)
    return f.name
