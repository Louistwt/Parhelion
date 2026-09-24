"""Character reference sheets, stored in library/characters/<name>/ and reused across videos."""

from __future__ import annotations

import typer

from ..config import Paths, Settings, image_model, prices, prompt_templates
from ..cost import Ledger, confirm_spend, estimate
from ..providers.base import ImageJob, ImageProvider
from ..versioning import IMAGE_EXTS, find_version
from .imagegen import PlannedJob, run
from .prompts import approved_sheet_paths, character_dir, compose_character_prompt, load_character, save_character


def plan(paths: Paths, name: str, n: int, model_key: str | None, use_approved: bool, seed: int | None) -> PlannedJob:
    char = load_character(paths, name)
    model = image_model(paths.root, model_key)
    refs = approved_sheet_paths(paths, char) if use_approved else []
    endpoint = model["edit_endpoint"] if refs else model["text_endpoint"]
    prompt = compose_character_prompt(prompt_templates(paths.root), char)
    item = estimate(prices(paths.root), f"{name} sheet", endpoint, n)
    return PlannedJob(
        label=f"{name} sheet", out_dir=character_dir(paths, name), stem="sheet", endpoint=endpoint,
        model_key=model["key"], job=ImageJob(prompt=prompt, num_images=n, reference_images=refs, seed=seed, params=dict(model.get("params", {}))),
        unit_price=item.unit_price,
    )


def generate(
    paths: Paths, settings: Settings, provider_factory, name: str, *, n: int, model_key: str | None,
    use_approved: bool, seed: int | None, yes: bool, dry_run: bool,
) -> None:
    planned = plan(paths, name, n, model_key, use_approved, seed)
    model = image_model(paths.root, model_key)
    if not model.get("verified"):
        typer.secho(f"Note: model {model['key']!r} is marked unverified in config/models.yaml.", fg="yellow")
    typer.echo(f"Prompt: {planned.job.prompt}")
    item = estimate(prices(paths.root), planned.label, planned.endpoint, n)
    ledger = Ledger(paths.ledger)
    if not confirm_spend([item], settings, ledger, yes=yes, dry_run=dry_run):
        return
    provider: ImageProvider = provider_factory()
    run(planned, provider, ledger, project="library", stage="character")


def approve(paths: Paths, name: str, version: int) -> str:
    char = load_character(paths, name)
    f = find_version(character_dir(paths, name), "sheet", version, IMAGE_EXTS)
    if f is None:
        raise SystemExit(f"No sheet_v{version} for {name}")
    if f.name not in char.approved_sheets:
        char.approved_sheets.append(f.name)
        save_character(paths, char)
    return f.name
