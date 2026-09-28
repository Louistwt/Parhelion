"""Parhelion CLI. Run `parhelion --help` (or `ph --help`)."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import typer

from . import dashboard as dash
from . import project as proj
from .config import Paths, banned_terms, find_root, image_models, load_settings, pipeline_cfg, prices, prompt_templates
from .cost import Ledger, entry_cost, sync_actuals
from .providers.base import ProviderError
from .versioning import IMAGE_EXTS, all_paths, find_version, parse_version

app = typer.Typer(no_args_is_help=True, add_completion=False, help="Parhelion — script → voice → shots → keyframes → storyboard → clips → rough cut.")
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


def _run_plan(paths, settings, plan, *, yes: bool, dry_run: bool):
    """CLI spend flow: notes → estimate → budget guard → confirm → execute. Returns results or None."""
    from .cost import confirm_spend
    from .stages.imagegen import cli_progress
    from .stages.imagegen_plan import execute

    for note in plan.notes:
        typer.secho(f"Note: {note}", fg="yellow")
    ledger = Ledger(paths.ledger)
    if not confirm_spend(plan.items, settings, ledger, yes=yes, dry_run=dry_run):
        return None
    return execute(plan, _fal_factory(settings)(), ledger, on_progress=cli_progress)


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
                proj.load_shotlist(folder), script, proj.load_timing(folder), prompt_templates(paths.root), cfg, banned, paths,
                folder=folder,
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
def timing(
    project: str,
    force: bool = typer.Option(False, "--force", help="Replace real voice timing with an estimate"),
):
    """Estimate line timing from character count → timing.json."""
    from .stages.timing import estimate

    paths, _ = _ctx()
    folder = proj.resolve(paths, project)
    current = proj.load_timing(folder)
    if current is not None and current.source == "tts" and not force:
        raise typer.BadParameter("timing.json comes from the voice track; an estimate would replace it (the rough cut "
                                 "would lose its voice). Rebuild with `parhelion voice-track`, or pass --force.")
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
    discard: Optional[str] = typer.Option(None, "--discard", help="Move a sheet you don't want to discarded/, e.g. v3"),
    dry_run: bool = typer.Option(False, "--dry-run"),
    yes: bool = typer.Option(False, "--yes", "-y"),
):
    """Generate character reference sheets into library/characters/<name>/, or approve / discard one."""
    from .stages import characters as C

    paths, settings = _ctx()
    if approve:
        f = C.approve(paths, name, parse_version(approve))
        typer.echo(f"Approved {name}/{f} as reference sheet.")
        return
    if discard:
        f = C.discard(paths, name, parse_version(discard))
        typer.echo(f"Moved {name}/{f} to {name}/discarded/.")
        return
    n = n or int(pipeline_cfg(paths.root)["characters"]["variants"])
    plan = C.build(paths, name, n=n, model_key=model, use_approved=use_approved, seed=seed)
    typer.echo(f"Prompt: {plan.jobs[0].job.prompt}")
    _run_plan(paths, settings, plan, yes=yes, dry_run=dry_run)


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
    plan = K.build(paths, folder, shot_ids=[shot] if shot else None, n=n, model_key=model, seed=seed,
                   include_approved=include_approved)
    if not plan.jobs:
        typer.echo("Nothing to do — every shot already has an approved keyframe (use --shot or --all).")
        return
    results = _run_plan(paths, settings, plan, yes=yes, dry_run=dry_run)
    if results is not None:
        K.after_run(folder)
        ok = sum(1 for files in results.values() if files)
        typer.echo(f"Done: {ok}/{len(plan.jobs)} requests succeeded. Review keyframes/, then `parhelion approve`.")


@app.command()
def approve(project: str, kind: str, item: str, version: str):
    """Approve a take: `approve demo-b keyframe S03 v2` · `audio L01 v2` · `clip S03 v1` · `lipsync S03 v1`."""
    from .stages import clips as CL
    from .stages import keyframes as K
    from .stages import voice as VO

    paths, _ = _ctx()
    folder = proj.resolve(paths, project)
    v = parse_version(version)
    if kind == "keyframe":
        typer.echo(f"Approved {item} → keyframes/{K.approve(folder, item, v)}")
    elif kind == "audio":
        typer.echo(f"Approved {item} → audio/{VO.approve(folder, item, v)}")
    elif kind in ("clip", "lipsync"):
        stem = item if kind == "clip" else f"{item}_lipsync"
        f = find_version(folder / "clips", stem, v, CL.VIDEO_EXTS)
        if f is None:
            raise typer.BadParameter(f"No clips/{stem}_v{v}")
        typer.echo(f"Approved {item} → clips/{CL.approve(folder, item, f.name)}")
    else:
        raise typer.BadParameter("kind must be keyframe, audio, clip or lipsync (characters: parhelion character <name> --approve vN)")


@app.command()
def discard(project: str, kind: str, item: str, version: str):
    """Hide an unwanted keyframe: `discard demo-a keyframe S03 v2`. Moved to keyframes/discarded/, never deleted.
    (Character sheets: parhelion character <name> --discard vN)"""
    from .stages import keyframes as K

    paths, _ = _ctx()
    folder = proj.resolve(paths, project)
    if kind != "keyframe":
        raise typer.BadParameter("kind must be keyframe (characters: parhelion character <name> --discard vN)")
    f = K.discard(folder, item, parse_version(version))
    typer.echo(f"Moved keyframes/{f} to keyframes/discarded/.")


# ---------------- video stages ----------------


@app.command()
def voice(
    project: str,
    line: Optional[str] = typer.Option(None, "--line", help="Only this line, e.g. L03"),
    model: Optional[str] = typer.Option(None, "--model", help="TTS model key from config/models.yaml"),
    dry_run: bool = typer.Option(False, "--dry-run"),
    yes: bool = typer.Option(False, "--yes", "-y"),
):
    """Generate a voice take per script line (paid, cheap). Then approve takes and run `voice-track`."""
    from .stages import voice as VO

    paths, settings = _ctx()
    folder = proj.resolve(paths, project)
    plan = VO.build(paths, folder, line_ids=[line] if line else None, model_key=model)
    if _run_plan(paths, settings, plan, yes=yes, dry_run=dry_run) is not None:
        proj.set_stage(folder, "voice", "in_progress")


@app.command("voice-track")
def voice_track(project: str, approve_latest: bool = typer.Option(False, "--approve-latest", help="Approve the newest take of any unapproved line first")):
    """Build real timing + one voice track from the approved takes (free)."""
    from .stages import voice as VO

    paths, _ = _ctx()
    folder = proj.resolve(paths, project)
    if approve_latest:
        VO.approve_latest(folder, proj.load_script(folder))
    timing, track = VO.build_track(paths, folder)
    typer.echo(f"Wrote audio/{track.name} · timing.json (tts) · total {timing.total_seconds:.2f}s")


@app.command()
def retime(project: str):
    """Move shot boundaries onto the real line timing (free, deterministic)."""
    from .stages import retime as RT

    paths, _ = _ctx()
    new, issues = RT.run(paths, proj.resolve(paths, project))
    for s in new.shots:
        typer.echo(f"  {s.id}  {s.start:6.2f}–{s.end:6.2f}s  ({s.duration:.2f}s)")
    for i in issues:
        typer.secho(f"  WARN {i}", fg="yellow")


@app.command()
def clips(
    project: str,
    shot: Optional[str] = typer.Option(None, "--shot", help="Only this shot, e.g. S03"),
    n: Optional[int] = typer.Option(None, "--n", help="Takes per shot (default from config/pipeline.yaml)"),
    model: Optional[str] = typer.Option(None, "--model", help="Video model key from config/models.yaml"),
    include_approved: bool = typer.Option(False, "--all", help="Include shots that already have an approved clip"),
    dry_run: bool = typer.Option(False, "--dry-run"),
    yes: bool = typer.Option(False, "--yes", "-y"),
):
    """Animate approved keyframes into clips (paid — the expensive stage)."""
    from .stages import clips as CL

    paths, settings = _ctx()
    folder = proj.resolve(paths, project)
    n = n or int(pipeline_cfg(paths.root)["clips"]["variants_per_shot"])
    plan = CL.build(paths, folder, shot_ids=[shot] if shot else None, n=n, model_key=model, include_approved=include_approved)
    if not plan.jobs:
        for note in plan.notes:
            typer.secho(f"Note: {note}", fg="yellow")
        typer.echo("Nothing to generate.")
        return
    if _run_plan(paths, settings, plan, yes=yes, dry_run=dry_run) is not None:
        CL.after_run(folder)


@app.command()
def lipsync(
    project: str,
    shot: Optional[str] = typer.Option(None, "--shot"),
    model: Optional[str] = typer.Option(None, "--model", help="Lip-sync model key from config/models.yaml"),
    dry_run: bool = typer.Option(False, "--dry-run"),
    yes: bool = typer.Option(False, "--yes", "-y"),
):
    """Lip-sync approved clips of shots marked on_camera_speech (paid)."""
    from .stages import clips as CL

    paths, settings = _ctx()
    plan = CL.build_lipsync(paths, proj.resolve(paths, project), shot_ids=[shot] if shot else None, model_key=model)
    _run_plan(paths, settings, plan, yes=yes, dry_run=dry_run)


@app.command()
def assemble(project: str):
    """Render the rough cut (clips or keyframe stills + voice + subtitles) and the CapCut folder (free)."""
    from .stages import assemble as AS

    paths, _ = _ctx()
    s = AS.assemble(paths, proj.resolve(paths, project))
    typer.echo(f"output/{s['rough_cut']} ({s['duration']:.1f}s) · output/{s['clean']} · output/{s['srt']} · output/{s['capcut']}/")
    for r in s["shots"]:
        typer.echo(f"  {r['shot']}  {r['start']:6.2f}–{r['end']:6.2f}s  {r['source']}")


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


@app.command()
def ui(
    port: int = typer.Option(8765, "--port"),
    no_browser: bool = typer.Option(False, "--no-browser"),
    reload: bool = typer.Option(False, "--reload", help="Auto-reload the API on code changes (development)"),
):
    """Start the local UI at http://127.0.0.1:<port> (this machine only)."""
    import uvicorn

    from .api.app import dist_dir

    paths, _ = _ctx()
    url = f"http://127.0.0.1:{port}"
    if not reload and not (dist_dir(paths.root) / "index.html").exists():
        typer.secho(
            "The web UI is not built yet. Run:\n  npm --prefix web install && npm --prefix web run build\n"
            "(The API still starts; for UI development use `npm --prefix web run dev`.)",
            fg="yellow",
        )
    if not no_browser:
        _open_browser_later(url)
    typer.echo(f"Parhelion UI → {url}   (Ctrl+C to stop)")
    uvicorn.run("parhelion.api.app:create_app", factory=True, host="127.0.0.1", port=port, reload=reload,
                reload_dirs=[str(Path(__file__).resolve().parent)] if reload else None, log_level="warning")


def _open_browser_later(url: str) -> None:
    import shutil
    import subprocess
    import threading
    import webbrowser

    def go():
        for cmd in ("wslview", "explorer.exe"):
            if shutil.which(cmd):
                try:
                    subprocess.Popen([cmd, url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    return
                except OSError:
                    pass
        webbrowser.open(url)

    threading.Timer(1.2, go).start()


def main() -> None:
    """Console entry point: user errors print as a message instead of a traceback."""
    from .config import UserError

    try:
        app()
    except UserError as e:
        typer.secho(str(e), fg="red", err=True)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
