"""Parhelion CLI. Run `parhelion --help` (or `ph --help`)."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional

import typer

from . import dashboard as dash
from . import project as proj
from .config import Paths, banned_terms, find_root, image_models, load_settings, pipeline_cfg, prices, prompt_templates
from .cost import Ledger, entry_cost, sync_actuals
from .providers.base import ProviderError
from .versioning import IMAGE_EXTS, all_paths, parse_version

app = typer.Typer(no_args_is_help=True, add_completion=False, help="Parhelion — script → shot list → keyframes → storyboard.")
cost_app = typer.Typer(help="Cost ledger: summary and sync with fal billing.")
prices_app = typer.Typer(help="Price table checks.")
app.add_typer(cost_app, name="cost")
app.add_typer(prices_app, name="prices")


def _ctx():
    paths = Paths(find_root())
    return paths, load_settings(paths.root)


def _fal_factory(settings):
    def make():
        from .providers.fal import FalImageProvider

        if not settings.fal_key:
            raise typer.BadParameter("FAL_KEY is not set in .env")
        return FalImageProvider(settings.fal_key)
    return make


# ---------------- project ----------------


@app.command()
def new(
    slug: str,
    lang: str = typer.Option(..., "--lang", help="mandarin | cantonese"),
    seconds: float = typer.Option(60, "--seconds"),
):
    """Create projects/<date>-<slug>/ with project.json and a brief.md template."""
    if lang not in ("mandarin", "cantonese"):
        raise typer.BadParameter("--lang must be mandarin or cantonese")
    paths, _ = _ctx()
    folder = proj.create(paths, slug, lang, seconds)
    typer.echo(f"Created {folder.relative_to(paths.root)} — fill in brief.md next.")


@app.command()
def status(project: str):
    """Show stage statuses, files and spend for a project."""
    paths, settings = _ctx()
    folder = proj.resolve(paths, project)
    p = proj.load_project(folder)
    typer.secho(f"{folder.name}  ({p.language}, target {p.target_seconds:g}s)", bold=True)
    for stage, st in p.stages.items():
        typer.echo(f"  {stage:<11} {st}")
    drafts = all_paths(folder, "script", ".md")
    typer.echo(f"  script drafts: {', '.join(d.name for d in drafts) or 'none'}")
    if (folder / "script.json").exists():
        s = proj.load_script(folder)
        counts = defaultdict(int)
        for c in s.claims:
            counts[c.status] += 1
        typer.echo(f"  script.json: {len(s.lines)} lines, claims {dict(counts) or 'none'}")
    if (folder / "shotlist.json").exists():
        shots = proj.load_shotlist(folder).shots
        approved = sum(1 for s in shots if s.approved_keyframe)
        variants = sum(len(all_paths(folder / "keyframes", s.id, IMAGE_EXTS)) for s in shots)
        typer.echo(f"  shots: {len(shots)}, keyframe variants: {variants}, approved: {approved}/{len(shots)}")
    spent = sum(entry_cost(e) for e in Ledger(paths.ledger).entries() if e.project == p.slug)
    typer.echo(f"  spend: ${spent:.2f}")


@app.command()
def lint(project: str):
    """Deterministic checks on script and shot list. Exit code 1 if there are errors."""
    from .stages import lint as L
    from .stages.prompts import character_dir

    paths, _ = _ctx()
    folder = proj.resolve(paths, project)
    cfg = pipeline_cfg(paths.root)
    banned = banned_terms(paths.root)
    issues = []
    if (folder / "script.json").exists():
        script = proj.load_script(folder)
        known = {p.name for p in paths.characters.iterdir() if p.is_dir() and (p / "character.yaml").exists()} if paths.characters.exists() else set()
        issues += L.lint_script(script, cfg, banned, known)
        if (folder / "shotlist.json").exists():
            issues += L.lint_shotlist(
                proj.load_shotlist(folder), script, proj.load_timing(folder), prompt_templates(paths.root), cfg, banned, paths
            )
    elif (md := proj.latest_script_md(folder)) is not None:
        typer.echo(f"No script.json yet — checking draft {md.name} for TODOs and banned terms only.")
        issues += L.lint_markdown(md, banned)
    else:
        typer.echo("Nothing to lint yet (no script_vN.md or script.json).")
        return
    errors = [i for i in issues if i.level == "error"]
    for i in sorted(issues, key=lambda i: (i.level != "error", i.where)):
        typer.secho(str(i), fg="red" if i.level == "error" else "yellow")
    typer.secho(f"{len(errors)} error(s), {len(issues) - len(errors)} warning(s)", bold=True)
    if errors:
        raise typer.Exit(1)


@app.command()
def timing(project: str):
    """Estimate line timing from character count → timing.json."""
    from .stages.timing import estimate

    paths, _ = _ctx()
    folder = proj.resolve(paths, project)
    script = proj.load_script(folder)
    t = estimate(script, pipeline_cfg(paths.root))
    proj.save(folder / "timing.json", t)
    proj.set_stage(folder, "timing", "estimated")
    for lt in t.lines:
        typer.echo(f"  {lt.line_id}  {lt.chars:>3} chars  {lt.start:6.2f}–{lt.end:6.2f}s")
    typer.echo(f"Total ≈ {t.total_seconds:.1f}s at {t.chars_per_second:g} chars/s (target {script.target_seconds:g}s)")


# ---------------- paid image stages ----------------


@app.command()
def character(
    name: str,
    n: Optional[int] = typer.Option(None, "--n", help="Variants (default from config/pipeline.yaml)"),
    model: Optional[str] = typer.Option(None, "--model", help="Model key from config/models.yaml"),
    use_approved: bool = typer.Option(False, "--use-approved", help="Send approved sheets as references (refine)"),
    seed: Optional[int] = typer.Option(None, "--seed"),
    approve: Optional[str] = typer.Option(None, "--approve", help="Approve sheet version, e.g. v2 (no spend)"),
    dry_run: bool = typer.Option(False, "--dry-run"),
    yes: bool = typer.Option(False, "--yes", "-y"),
):
    """Generate character reference sheets into library/characters/<name>/, or approve one."""
    from .stages import characters as C

    paths, settings = _ctx()
    if approve:
        f = C.approve(paths, name, parse_version(approve))
        typer.echo(f"Approved {name}/{f} as reference sheet.")
        return
    n = n or int(pipeline_cfg(paths.root)["characters"]["variants"])
    C.generate(paths, settings, _fal_factory(settings), name, n=n, model_key=model, use_approved=use_approved,
               seed=seed, yes=yes, dry_run=dry_run)


@app.command()
def keyframes(
    project: str,
    shot: Optional[str] = typer.Option(None, "--shot", help="Only this shot, e.g. S03"),
    n: Optional[int] = typer.Option(None, "--n", help="Variants per shot (default from config/pipeline.yaml)"),
    model: Optional[str] = typer.Option(None, "--model", help="Model key from config/models.yaml"),
    seed: Optional[int] = typer.Option(None, "--seed"),
    include_approved: bool = typer.Option(False, "--all", help="Include shots that already have an approved keyframe"),
    dry_run: bool = typer.Option(False, "--dry-run"),
    yes: bool = typer.Option(False, "--yes", "-y"),
):
    """Generate N keyframe variants per shot (paid). Asks before spending."""
    from .stages import keyframes as K

    paths, settings = _ctx()
    folder = proj.resolve(paths, project)
    n = n or int(pipeline_cfg(paths.root)["keyframes"]["variants_per_shot"])
    K.generate(paths, settings, _fal_factory(settings), folder, shot_id=shot, n=n, model_key=model, seed=seed,
               include_approved=include_approved, yes=yes, dry_run=dry_run)


@app.command()
def approve(project: str, kind: str, item: str, version: str):
    """Approve a variant, e.g. `parhelion approve demo-b keyframe S03 v2`."""
    from .stages import keyframes as K

    paths, _ = _ctx()
    folder = proj.resolve(paths, project)
    if kind != "keyframe":
        raise typer.BadParameter("Only 'keyframe' can be approved in the storyboard scope (characters: parhelion character <name> --approve vN)")
    f = K.approve(folder, item, parse_version(version))
    typer.echo(f"Approved {item} → keyframes/{f}")


@app.command()
def storyboard(project: str):
    """Render output/storyboard_vN.html (open in a browser; print to PDF)."""
    from .stages import storyboard as SB

    paths, _ = _ctx()
    folder = proj.resolve(paths, project)
    out = SB.render(folder, paths)
    typer.echo(f"Wrote {out}")


# ---------------- costs ----------------


@cost_app.callback(invoke_without_command=True)
def cost_summary(ctx: typer.Context, project: Optional[str] = typer.Option(None, "--project")):
    """Summarise the ledger (by project / stage / model)."""
    if ctx.invoked_subcommand:
        return
    paths, settings = _ctx()
    ledger = Ledger(paths.ledger)
    entries = [e for e in ledger.entries() if e.status != "dry-run" and (not project or e.project == project)]
    if not entries:
        typer.echo("No spend logged yet.")
        return
    for key in ("project", "stage", "model"):
        totals: dict[str, float] = defaultdict(float)
        for e in entries:
            totals[getattr(e, key)] += entry_cost(e)
        typer.secho(f"By {key}:", bold=True)
        for k, v in sorted(totals.items(), key=lambda kv: -kv[1]):
            typer.echo(f"  {k:<48} ${v:8.3f}")
    total = sum(entry_cost(e) for e in entries)
    unsynced = sum(1 for e in entries if e.status == "ok" and e.actual_cost_usd is None)
    typer.secho(f"Total ${total:.3f}  (month to date ${ledger.month_spend():.2f} of ${settings.monthly_budget:.2f}; {unsynced} entries are estimates)", bold=True)


@cost_app.command("sync")
def cost_sync(days: int = typer.Option(30, "--days", help="Look back this many days (fal caps at 90)")):
    """Fill actual costs from fal billing events (needs FAL_ADMIN_KEY)."""
    from .providers.fal import FalPlatform

    paths, settings = _ctx()
    if not settings.fal_admin_key:
        raise typer.BadParameter("FAL_ADMIN_KEY is not set in .env (billing APIs need an ADMIN key)")
    start = (datetime.now(timezone.utc) - timedelta(days=min(days, 90))).isoformat(timespec="seconds")
    platform = FalPlatform(settings.fal_admin_key)
    try:
        events = platform.billing_events(start)
    except ProviderError as e:
        typer.secho(str(e), fg="red")
        raise typer.Exit(1)
    updated = sync_actuals(Ledger(paths.ledger), events)
    fal_total = sum(float(e.get("cost_total") or 0) for e in events)
    typer.echo(f"{len(events)} billing events (${fal_total:.3f} on fal since {start[:10]}); updated {updated} ledger rows.")


@app.command()
def dashboard(online: bool = typer.Option(False, "--online", help="Fetch live fal balance (needs FAL_ADMIN_KEY)")):
    """Write output/dashboard.html."""
    paths, settings = _ctx()
    balance, err = None, None
    if online:
        if not settings.fal_admin_key:
            err = "FAL_ADMIN_KEY not set"
        else:
            from .providers.fal import FalPlatform

            try:
                balance = FalPlatform(settings.fal_admin_key).balance()
            except ProviderError as e:
                err = str(e)[:120]
    out = dash.render(paths, settings, balance, err)
    typer.echo(f"Wrote {out}")


@prices_app.command("check")
def prices_check():
    """Compare config/prices.yaml with fal's pricing API."""
    from .providers.fal import FalPlatform

    paths, settings = _ctx()
    key = settings.fal_admin_key or settings.fal_key
    if not key:
        raise typer.BadParameter("FAL_KEY is not set in .env")
    endpoints = sorted({m[k] for m in image_models(paths.root) for k in ("text_endpoint", "edit_endpoint") if m.get(k)})
    try:
        live = {p["endpoint_id"]: p for p in FalPlatform(key).pricing(endpoints)}
    except ProviderError as e:
        typer.secho(str(e), fg="red")
        raise typer.Exit(1)
    table = prices(paths.root)
    mismatch = 0
    for ep in endpoints:
        ours = table.get(ep, {})
        theirs = live.get(ep)
        if theirs is None:
            typer.secho(f"  ?  {ep:<44} not returned by fal (check endpoint id)", fg="yellow")
            mismatch += 1
            continue
        same = ours.get("unit_price") is not None and abs(float(ours["unit_price"]) - float(theirs["unit_price"])) < 1e-9
        mark, color = ("ok", "green") if same else ("≠", "red")
        mismatch += 0 if same else 1
        typer.secho(f"  {mark:<2} {ep:<44} ours {ours.get('unit_price')}  fal {theirs['unit_price']}/{theirs.get('unit')}", fg=color)
    typer.echo("All prices match." if not mismatch else f"{mismatch} difference(s) — update config/prices.yaml and its `verified` date.")


if __name__ == "__main__":
    app()
