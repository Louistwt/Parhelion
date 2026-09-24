"""Keyframes: N image variants per shot, using approved character sheets as references."""

from __future__ import annotations

from pathlib import Path

import typer

from .. import project as proj
from ..config import Paths, Settings, image_model, prices, prompt_templates
from ..cost import Ledger, confirm_spend, estimate
from ..providers.base import ImageJob
from ..schemas import Shot
from ..versioning import IMAGE_EXTS, find_version
from .imagegen import PlannedJob, run
from .prompts import approved_sheet_paths, compose_shot_prompt, load_character


def select_shots(shots: list[Shot], shot_id: str | None, include_approved: bool) -> list[Shot]:
    if shot_id:
        chosen = [s for s in shots if s.id == shot_id]
        if not chosen:
            raise SystemExit(f"No shot {shot_id}")
        return chosen
    return [s for s in shots if include_approved or not s.approved_keyframe]


def plan(paths: Paths, folder: Path, shots: list[Shot], n: int, model_key: str | None, seed: int | None) -> list[PlannedJob]:
    model = image_model(paths.root, model_key)
    templates = prompt_templates(paths.root)
    price_table = prices(paths.root)
    planned = []
    for shot in shots:
        chars = [load_character(paths, c) for c in shot.characters]
        refs = [p for c in chars for p in approved_sheet_paths(paths, c)]
        endpoint = model["edit_endpoint"] if refs else model["text_endpoint"]
        item = estimate(price_table, shot.id, endpoint, n)
        planned.append(
            PlannedJob(
                label=shot.id, out_dir=folder / "keyframes", stem=shot.id, endpoint=endpoint, model_key=model["key"],
                job=ImageJob(
                    prompt=compose_shot_prompt(templates, shot, chars), num_images=n,
                    reference_images=refs, seed=seed, params=dict(model.get("params", {})),
                ),
                unit_price=item.unit_price,
            )
        )
    return planned


def generate(
    paths: Paths, settings: Settings, provider_factory, folder: Path, *, shot_id: str | None, n: int,
    model_key: str | None, seed: int | None, include_approved: bool, yes: bool, dry_run: bool,
) -> None:
    shotlist = proj.load_shotlist(folder)
    shots = select_shots(shotlist.shots, shot_id, include_approved)
    if not shots:
        typer.echo("Nothing to do — every shot already has an approved keyframe (use --shot or --all).")
        return
    model = image_model(paths.root, model_key)
    if not model.get("verified"):
        typer.secho(f"Note: model {model['key']!r} is marked unverified in config/models.yaml.", fg="yellow")
    planned = plan(paths, folder, shots, n, model_key, seed)
    for p in planned:
        if not p.job.reference_images and any(s.characters for s in shots if s.id == p.label):
            typer.secho(f"  {p.label}: no approved character sheet — generating without references", fg="yellow")
    items = [estimate(prices(paths.root), p.label, p.endpoint, n) for p in planned]
    ledger = Ledger(paths.ledger)
    if not confirm_spend(items, settings, ledger, yes=yes, dry_run=dry_run):
        return
    provider = provider_factory()
    project_slug = proj.load_project(folder).slug
    ok = 0
    for p in planned:
        if run(p, provider, ledger, project=project_slug, stage="keyframes"):
            ok += 1
    proj.set_stage(folder, "keyframes", "in_progress")
    typer.echo(f"Done: {ok}/{len(planned)} shots succeeded. Review keyframes/, then `parhelion approve`.")


def approve(folder: Path, shot_id: str, version: int) -> str:
    shotlist = proj.load_shotlist(folder)
    shot = shotlist.shot(shot_id)
    if shot is None:
        raise SystemExit(f"No shot {shot_id}")
    f = find_version(folder / "keyframes", shot_id, version, IMAGE_EXTS)
    if f is None:
        raise SystemExit(f"No keyframes/{shot_id}_v{version}.*")
    shot.approved_keyframe = f.name
    proj.save(folder / "shotlist.json", shotlist)
    proj.record_approval(folder, f"keyframe {shot_id}", f.name)
    if all(s.approved_keyframe for s in shotlist.shots):
        proj.set_stage(folder, "keyframes", "approved")
    return f.name
