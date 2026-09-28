"""Keyframes: N image variants per shot, using approved character sheets as references."""

from __future__ import annotations

from pathlib import Path

from .. import project as proj
from ..config import Paths, UserError, image_model, prices, prompt_templates
from ..cost import unit_price
from ..providers.base import ImageJob
from ..schemas import Shot
from ..versioning import IMAGE_EXTS, discard as discard_file, find_version
from .imagegen import PlannedJob
from .imagegen_plan import RunPlan
from .prompts import compose_shot_prompt, load_character, reference_sheet, script_style


def select_shots(shots: list[Shot], shot_ids: list[str] | None, include_approved: bool) -> list[Shot]:
    if shot_ids:
        wanted = set(shot_ids)
        chosen = [s for s in shots if s.id in wanted]
        missing = wanted - {s.id for s in chosen}
        if missing:
            raise UserError(f"No shot(s): {', '.join(sorted(missing))}")
        return chosen
    return [s for s in shots if include_approved or not s.approved_keyframe]


def build(
    paths: Paths, folder: Path, *, shot_ids: list[str] | None, n: int, model_key: str | None,
    seed: int | None = None, include_approved: bool = False,
) -> RunPlan:
    """Plan a keyframe run. No side effects, no spend."""
    shotlist = proj.load_shotlist(folder)
    shots = select_shots(shotlist.shots, shot_ids, include_approved)
    model = image_model(paths.root, model_key)
    templates = prompt_templates(paths.root)
    price_table = prices(paths.root)
    script_chars = proj.load_script(folder).characters if (folder / "script.json").exists() else []
    fallback_style = script_style(paths, templates, script_chars)
    jobs, notes = [], []
    if not model.get("verified"):
        notes.append(f"Model {model['key']!r} is marked unverified in config/models.yaml.")
    for shot in shots:
        chars = [load_character(paths, c) for c in shot.characters]
        refs = [p for c in chars if (p := reference_sheet(paths, c)) is not None]  # one per character, see reference_legend
        if chars and not refs:
            notes.append(f"{shot.id}: no approved character sheet — generating without references.")
        endpoint = model["edit_endpoint"] if refs else model["text_endpoint"]
        price, unit = unit_price(price_table, endpoint)
        jobs.append(
            PlannedJob(
                label=shot.id, out_dir=folder / "keyframes", stem=shot.id, endpoint=endpoint, model_key=model["key"],
                unit_price=price, unit=unit,
                job=ImageJob(prompt=compose_shot_prompt(templates, shot, chars, fallback_style), num_images=n,
                             reference_images=refs, seed=seed, params=dict(model.get("params", {}))),
            )
        )
    slug = proj.load_project(folder).slug
    return RunPlan(kind="keyframes", project=slug, stage="keyframes", jobs=jobs, notes=notes, folder=folder)


def after_run(folder: Path) -> None:
    proj.set_stage(folder, "keyframes", "in_progress")


def discard(folder: Path, shot_id: str, version: int) -> str:
    """Hide a keyframe you don't want: moved to keyframes/discarded/ (never deleted; its version number is not reused)."""
    shotlist = proj.load_shotlist(folder)
    shot = shotlist.shot(shot_id)
    if shot is None:
        raise UserError(f"No shot {shot_id}")
    f = find_version(folder / "keyframes", shot_id, version, IMAGE_EXTS)
    if f is None:
        raise UserError(f"No keyframes/{shot_id}_v{version}.*")
    if shot.approved_keyframe == f.name:
        raise UserError(f"{f.name} is the approved keyframe for {shot_id}: approve another one before discarding it")
    discard_file(f)
    return f.name


def approve(folder: Path, shot_id: str, version: int) -> str:
    shotlist = proj.load_shotlist(folder)
    shot = shotlist.shot(shot_id)
    if shot is None:
        raise UserError(f"No shot {shot_id}")
    f = find_version(folder / "keyframes", shot_id, version, IMAGE_EXTS)
    if f is None:
        raise UserError(f"No keyframes/{shot_id}_v{version}.*")
    shot.approved_keyframe = f.name
    proj.save(folder / "shotlist.json", shotlist)
    proj.record_approval(folder, f"keyframe {shot_id}", f.name)
    if all(s.approved_keyframe for s in shotlist.shots):
        proj.set_stage(folder, "keyframes", "approved")
    return f.name
