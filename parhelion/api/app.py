"""Local JSON API for the Parhelion UI. Binds to 127.0.0.1 only (see `parhelion ui`).

All pipeline logic lives in parhelion.stages / parhelion.cost — this module only translates HTTP.
"""

from __future__ import annotations

import re
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable, Literal

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from .. import dashboard as dash
from .. import project as proj
from ..config import (
    Paths, UserError, banned_terms, find_root, image_models, load_settings, pipeline_cfg, prices, prompt_templates,
    stage_models, voices,
)
from ..media import system_status
from ..cost import Ledger, PriceMissing, budget_status, entry_cost, sync_actuals
from ..providers.base import ImageProvider, ProviderError
from ..schemas import Character, Shot, Voice
from ..stages import assemble as AS
from ..stages import characters as C
from ..stages import clips as CL
from ..stages import retime as RT
from ..stages import voice as VO
from ..stages import keyframes as K
from ..stages import lint as L
from ..stages import storyboard as SB
from ..stages.imagegen_plan import RunPlan
from ..stages.prompts import (
    character_dir, compose_shot_prompt, default_style, load_character, save_character, script_style, style_text, styles,
)
from ..stages.timing import estimate as estimate_timing
from ..stages.timing import speech_chars
from ..versioning import IMAGE_EXTS, all_paths, parse_version
from . import drafts as D
from .jobs import JobManager

NAME_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,40}$")


def dist_dir(root: Path) -> Path:
    return root / "web" / "dist"


# ---------------- request bodies ----------------


class NewProject(BaseModel):
    slug: str
    language: Literal["mandarin", "cantonese"]
    seconds: float = 60


class TextBody(BaseModel):
    text: str


class DraftBody(BaseModel):
    text: str
    based_on: int | None = None


class ClaimUpdate(BaseModel):
    status: Literal["unverified", "approved", "rejected"]
    note: str = ""
    by: str = "partner"


class CharacterBody(BaseModel):
    name: str
    display_name: str = ""
    prompt_block: str
    style: str | None = None


class CharacterUpdate(BaseModel):
    display_name: str | None = None
    prompt_block: str | None = None
    style: str | None = None
    face_ref: str | None = None  # file name in the character folder; "" clears it
    voice: dict | None = None  # {voice_id, speed, pitch, emotion}; {} clears it


class ShotUpdate(BaseModel):
    framing: str | None = None
    setting: str | None = None
    action: str | None = None
    notes: str | None = None
    characters: list[str] | None = None
    props: list[str] | None = None
    motion_prompt: str | None = None
    camera: str | None = None
    on_camera_speech: bool | None = None


class ShotListUpdate(BaseModel):
    location_ref: str | None = None  # "" or null clears it


class RunRequest(BaseModel):
    kind: Literal["keyframes", "character", "voice", "voice_preview", "clips", "lipsync"]
    project: str | None = None
    name: str | None = None  # character name (or "narrator" for voice_preview)
    line_ids: list[str] | None = None
    text: str | None = None  # voice_preview sample text
    language: Literal["mandarin", "cantonese"] = "mandarin"
    shot_ids: list[str] | None = None
    n: int | None = None
    model: str | None = None
    use_approved: bool = False
    include_approved: bool = False


# ---------------- app ----------------


def create_app(root: Path | None = None, provider_factory: Callable[[], ImageProvider] | None = None) -> FastAPI:
    paths = Paths(root or find_root())
    ledger = Ledger(paths.ledger)

    def settings():
        return load_settings(paths.root)

    def default_provider() -> ImageProvider:
        from ..providers.fal import FalImageProvider

        s = settings()
        if not s.fal_key:
            raise ProviderError("FAL_KEY is not set in .env")
        return FalImageProvider(s.fal_key)

    make_provider = provider_factory or default_provider
    jobs = JobManager(ledger, settings, paths.root / "data" / "jobs.jsonl")

    app = FastAPI(title="Parhelion", docs_url="/api/docs", openapi_url="/api/openapi.json")
    app.state.paths = paths
    app.state.jobs = jobs

    @app.exception_handler(UserError)
    async def _user_error(request: Request, exc: UserError):
        return JSONResponse({"detail": str(exc)}, status_code=400)

    @app.exception_handler(PriceMissing)
    async def _price_missing(request: Request, exc: PriceMissing):
        return JSONResponse({"detail": str(exc)}, status_code=400)

    def folder_of(p: str) -> Path:
        if "/" in p or ".." in p:
            raise HTTPException(400, "bad project id")
        return proj.resolve(paths, p)

    def spend_by_project() -> dict[str, float]:
        totals: dict[str, float] = defaultdict(float)
        for e in ledger.entries():
            totals[e.project] += entry_cost(e)
        return totals

    # ---------- overview & projects ----------

    @app.get("/api/overview")
    def overview():
        s = settings()
        spend = spend_by_project()
        projects = []
        if paths.projects.exists():
            for folder in sorted((p for p in paths.projects.iterdir() if (p / "project.json").exists()), reverse=True):
                pr = proj.load_project(folder)
                shots = approved = 0
                if (folder / "shotlist.json").exists():
                    sl = proj.load_shotlist(folder).shots
                    shots, approved = len(sl), sum(1 for x in sl if x.approved_keyframe)
                projects.append({
                    "id": folder.name, "slug": pr.slug, "language": pr.language, "target_seconds": pr.target_seconds,
                    "stages": pr.stages, "created": pr.created, "shots": shots, "approved_keyframes": approved,
                    "spend": round(spend.get(pr.slug, 0.0), 4),
                    "drafts": len(all_paths(folder, "script", ".md")),
                    "has_script": (folder / "script.json").exists(),
                })
        return {
            "projects": projects,
            "month_spend": ledger.month_spend(),
            "monthly_budget": s.monthly_budget,
            "library_spend": round(spend.get("library", 0.0), 4),
            "has_fal_key": bool(s.fal_key),
            "jobs_active": jobs.active(),
        }

    @app.post("/api/projects")
    def new_project(body: NewProject):
        if not NAME_RE.match(body.slug):
            raise HTTPException(400, "Slug: lowercase letters, digits, - or _ (e.g. demo-b)")
        folder = proj.create(paths, body.slug, body.language, body.seconds)
        return {"id": folder.name}

    @app.get("/api/projects/{p}")
    def get_project(p: str):
        folder = folder_of(p)
        pr = proj.load_project(folder)
        return {
            "id": folder.name, **pr.model_dump(),
            "files": {name: (folder / name).exists() for name in ("brief.md", "script.json", "timing.json", "shotlist.json")},
            "spend": round(spend_by_project().get(pr.slug, 0.0), 4),
        }

    @app.get("/api/projects/{p}/brief")
    def get_brief(p: str):
        return {"text": D.read_brief(folder_of(p))}

    @app.put("/api/projects/{p}/brief")
    def put_brief(p: str, body: TextBody):
        folder = folder_of(p)
        D.save_brief(folder, body.text)
        if body.text.strip():
            proj.set_stage(folder, "brief", "draft")
        return {"ok": True}

    # ---------- script ----------

    @app.get("/api/projects/{p}/drafts")
    def drafts(p: str):
        folder = folder_of(p)
        return {"drafts": D.list_drafts(folder), "claude_prompt": D.claude_prompt(folder, paths.root)}

    @app.get("/api/projects/{p}/drafts/{v}")
    def draft(p: str, v: int):
        folder = folder_of(p)
        return {"version": v, "text": D.read_draft(folder, v), "feedback": D.read_feedback(folder, v)}

    @app.post("/api/projects/{p}/drafts")
    def new_draft(p: str, body: DraftBody):
        folder = folder_of(p)
        v = D.save_new_draft(folder, body.text, body.based_on)
        proj.set_stage(folder, "script", "draft")
        return {"version": v}

    @app.put("/api/projects/{p}/drafts/{v}/feedback")
    def put_feedback(p: str, v: int, body: TextBody):
        D.save_feedback(folder_of(p), v, body.text)
        return {"ok": True}

    @app.get("/api/projects/{p}/script")
    def get_script(p: str):
        folder = folder_of(p)
        if not (folder / "script.json").exists():
            return {"script": None}
        script = proj.load_script(folder)
        rate = float(pipeline_cfg(paths.root)["speech"]["chars_per_second"][script.language])
        lines = [{**l.model_dump(), "chars": speech_chars(l.text_voice),
                  "seconds": round(speech_chars(l.text_voice) / rate, 1)} for l in script.lines]
        return {"script": {**script.model_dump(), "lines": lines}, "chars_per_second": rate}

    @app.post("/api/projects/{p}/claims/{claim_id}")
    def update_claim(p: str, claim_id: str, body: ClaimUpdate):
        folder = folder_of(p)
        script = proj.load_script(folder)
        claim = next((c for c in script.claims if c.id == claim_id), None)
        if claim is None:
            raise HTTPException(404, f"No claim {claim_id}")
        claim.status, claim.note = body.status, body.note
        proj.save(folder / "script.json", script)
        pr = proj.load_project(folder)
        from ..schemas import Approval

        pr.approvals.append(Approval(what=f"claim {claim_id}", value=body.status, by=body.by or "partner"))
        proj.save(folder / "project.json", pr)
        return {"ok": True}

    @app.get("/api/projects/{p}/lint")
    def lint(p: str):
        folder = folder_of(p)
        cfg, banned = pipeline_cfg(paths.root), banned_terms(paths.root)
        issues: list[L.Issue] = []
        scope = "none"
        if (folder / "script.json").exists():
            scope = "script"
            script = proj.load_script(folder)
            known = {c["name"] for c in list_characters()}
            issues += L.lint_script(script, cfg, banned, known)
            if (folder / "shotlist.json").exists():
                scope = "script+shots"
                issues += L.lint_shotlist(proj.load_shotlist(folder), script, proj.load_timing(folder),
                                          prompt_templates(paths.root), cfg, banned, paths, folder=folder)
        elif (md := proj.latest_script_md(folder)) is not None:
            scope = f"draft {md.name}"
            issues += L.lint_markdown(md, banned)
        return {
            "scope": scope,
            "issues": [{"level": i.level, "where": i.where, "message": i.message} for i in issues],
            "errors": sum(1 for i in issues if i.level == "error"),
            "warnings": sum(1 for i in issues if i.level == "warn"),
        }

    # ---------- timing ----------

    @app.get("/api/projects/{p}/timing")
    def get_timing(p: str):
        folder = folder_of(p)
        t = proj.load_timing(folder)
        return {"timing": t.model_dump() if t else None}

    @app.post("/api/projects/{p}/timing")
    def post_timing(p: str):
        folder = folder_of(p)
        current = proj.load_timing(folder)
        if current is not None and current.source == "tts":
            raise HTTPException(409, "Timing already comes from the voice track. An estimate would replace it and the "
                                     "rough cut would lose its voice. Rebuild the voice track instead (Voice tab).")
        t = estimate_timing(proj.load_script(folder), pipeline_cfg(paths.root))
        proj.save(folder / "timing.json", t)
        proj.set_stage(folder, "timing", "estimated")
        return {"timing": t.model_dump()}

    # ---------- characters ----------

    def list_characters() -> list[dict]:
        out = []
        if not paths.characters.exists():
            return out
        for d in sorted(paths.characters.iterdir()):
            if d.is_dir() and not d.name.startswith("_") and (d / "character.yaml").exists():
                c = load_character(paths, d.name)
                previews = [f.name for lang in ("mandarin", "cantonese")
                            for f in all_paths(d, f"voice_preview_{lang}", (".mp3", ".wav"))]
                out.append({**c.model_dump(), "sheets": C.sheets(paths, d.name), "voice_previews": previews})
        return out

    def check_style(key: str | None) -> None:
        try:
            style_text(prompt_templates(paths.root), key)
        except UserError as e:
            raise HTTPException(400, str(e)) from e

    @app.get("/api/characters")
    def characters():
        templates = prompt_templates(paths.root)
        return {"characters": list_characters(), "styles": list(styles(templates)), "default_style": default_style(templates)}

    @app.post("/api/characters")
    def new_character(body: CharacterBody):
        if not NAME_RE.match(body.name):
            raise HTTPException(400, "Name: lowercase letters, digits, - or _ (e.g. zhangshu)")
        check_style(body.style)
        d = character_dir(paths, body.name)
        if d.exists():
            raise HTTPException(409, f"{body.name} already exists")
        d.mkdir(parents=True)
        save_character(paths, Character(name=body.name, display_name=body.display_name, prompt_block=body.prompt_block,
                                        style=body.style or None))
        (d / "description.md").write_text(f"# {body.display_name or body.name}\n\nHuman notes (not sent to image models).\n", encoding="utf-8")
        return {"ok": True}

    @app.put("/api/characters/{name}")
    def update_character(name: str, body: CharacterUpdate):
        c = load_character(paths, name)
        if body.display_name is not None:
            c.display_name = body.display_name
        if body.prompt_block is not None:
            c.prompt_block = body.prompt_block
        if body.style is not None:
            check_style(body.style)
            c.style = body.style
        if body.face_ref is not None:
            if body.face_ref and not (character_dir(paths, name) / Path(body.face_ref).name).is_file():
                raise HTTPException(400, f"{body.face_ref} not found for {name}")
            c.face_ref = Path(body.face_ref).name if body.face_ref else None
        if body.voice is not None:
            c.voice = Voice.model_validate(body.voice) if body.voice.get("voice_id") else None
        save_character(paths, c)
        return {"ok": True}

    @app.post("/api/characters/{name}/sheets/{v}/{action}")
    def sheet_action(name: str, v: str, action: Literal["approve", "unapprove", "discard"]):
        fn = {"approve": C.approve, "unapprove": C.unapprove, "discard": C.discard}[action]
        return {"file": fn(paths, name, parse_version(v))}

    # ---------- shots & keyframes ----------

    @app.get("/api/projects/{p}/shots")
    def shots(p: str):
        folder = folder_of(p)
        if not (folder / "shotlist.json").exists():
            return {"shots": None, "framings": list(prompt_templates(paths.root).get("framings", {}))}
        sl = proj.load_shotlist(folder)
        script = proj.load_script(folder) if (folder / "script.json").exists() else None
        templates = prompt_templates(paths.root)
        fallback_style = script_style(paths, templates, script.characters) if script else None
        room = bool(sl.location_ref)
        out = []
        for s in sl.shots:
            chars = []
            for name in s.characters:
                try:
                    chars.append(load_character(paths, name))
                except UserError:
                    pass
            lines = []
            if script:
                for lid in s.line_ids:
                    if (line := script.line(lid)):
                        lines.append({"id": lid, "speaker": line.speaker, "text": line.subtitle})
            out.append({**s.model_dump(), "duration": s.duration, "lines": lines,
                        "prompt": compose_shot_prompt(templates, s, chars, fallback_style, location=room)})
        return {"shots": out, "framings": list(templates.get("framings", {})), "location_ref": sl.location_ref}

    @app.put("/api/projects/{p}/shotlist")
    def update_shotlist(p: str, body: ShotListUpdate):
        folder = folder_of(p)
        sl = proj.load_shotlist(folder)
        ref = body.location_ref or None
        if ref is not None and not (folder / ref).is_file():
            raise HTTPException(400, f"{ref} not found in the project folder")
        sl.location_ref = ref
        proj.save(folder / "shotlist.json", sl)
        return {"ok": True}

    @app.put("/api/projects/{p}/shots/{shot_id}")
    def update_shot(p: str, shot_id: str, body: ShotUpdate):
        folder = folder_of(p)
        sl = proj.load_shotlist(folder)
        shot = sl.shot(shot_id)
        if shot is None:
            raise HTTPException(404, f"No shot {shot_id}")
        data = shot.model_dump()
        data.update({k: v for k, v in body.model_dump().items() if v is not None})
        sl.shots[sl.shots.index(shot)] = Shot.model_validate(data)
        proj.save(folder / "shotlist.json", sl)
        return {"ok": True}

    @app.get("/api/projects/{p}/keyframes")
    def keyframes(p: str):
        folder = folder_of(p)
        if not (folder / "shotlist.json").exists():
            return {"shots": None}
        sl = proj.load_shotlist(folder)
        script = proj.load_script(folder) if (folder / "script.json").exists() else None
        out = []
        for s in sl.shots:
            variants = [x.name for x in all_paths(folder / "keyframes", s.id, IMAGE_EXTS)]
            text = " ".join(l.subtitle for lid in s.line_ids if script and (l := script.line(lid)))
            out.append({"id": s.id, "start": s.start, "end": s.end, "framing": s.framing, "characters": s.characters,
                        "action": s.action, "text": text, "variants": variants, "approved": s.approved_keyframe})
        return {"shots": out, "folder": folder.name}

    @app.post("/api/projects/{p}/keyframes/{shot_id}/approve/{v}")
    def approve_keyframe(p: str, shot_id: str, v: str):
        return {"file": K.approve(folder_of(p), shot_id, parse_version(v))}

    @app.post("/api/projects/{p}/keyframes/{shot_id}/discard/{v}")
    def discard_keyframe(p: str, shot_id: str, v: str):
        return {"file": K.discard(folder_of(p), shot_id, parse_version(v))}

    # ---------- spend flow ----------

    def build_plan(req: RunRequest) -> RunPlan:
        cfg = pipeline_cfg(paths.root)
        if req.kind == "voice_preview":
            if not req.name:
                raise HTTPException(400, "name is required")
            text = (req.text or "").strip() or "你好，我是这个视频里的声音。今天我们聊聊保险。"
            return VO.build_preview(paths, req.name, text=text[:120], language=req.language, model_key=req.model)
        if req.kind in ("voice", "clips", "lipsync"):
            if not req.project:
                raise HTTPException(400, "project is required")
            folder = folder_of(req.project)
            if req.kind == "voice":
                return VO.build(paths, folder, line_ids=req.line_ids, model_key=req.model)
            if req.kind == "clips":
                return CL.build(paths, folder, shot_ids=req.shot_ids, n=req.n or int(cfg["clips"]["variants_per_shot"]),
                                model_key=req.model, include_approved=req.include_approved)
            return CL.build_lipsync(paths, folder, shot_ids=req.shot_ids, model_key=req.model)
        if req.kind == "character":
            if not req.name:
                raise HTTPException(400, "name is required")
            return C.build(paths, req.name, n=req.n or int(cfg["characters"]["variants"]),
                           model_key=req.model, use_approved=req.use_approved)
        if not req.project:
            raise HTTPException(400, "project is required")
        return K.build(paths, folder_of(req.project), shot_ids=req.shot_ids,
                       n=req.n or int(cfg["keyframes"]["variants_per_shot"]), model_key=req.model,
                       include_approved=req.include_approved)

    def describe(j) -> dict:
        if hasattr(j, "job"):  # image job
            return {"label": j.label, "endpoint": j.endpoint, "model": j.model_key, "n": j.job.num_images,
                    "references": len(j.job.reference_images), "prompt": j.job.prompt}
        return {"label": j.label, "endpoint": j.endpoint, "model": j.model_key, "n": 1,
                "references": len(j.files) or (2 if j.prepare else 0), "prompt": j.payload.get("prompt", "")}

    @app.post("/api/estimate")
    def estimate(req: RunRequest):
        plan = build_plan(req)
        s = settings()
        status = budget_status(plan.items, s, ledger)
        return {
            **status, "notes": plan.notes, "has_fal_key": bool(s.fal_key),
            "requests": [describe(j) for j in plan.jobs],
        }

    @app.post("/api/jobs")
    def start_job(req: RunRequest):
        plan = build_plan(req)
        if not plan.jobs:
            raise HTTPException(400, "Nothing to generate")
        if provider_factory is None and not settings().fal_key:
            raise HTTPException(400, "FAL_KEY is not set in .env")
        status = budget_status(plan.items, settings(), ledger)
        if status["blocked_reason"]:
            raise HTTPException(409, status["blocked_reason"])
        hooks = {"keyframes": K.after_run, "clips": CL.after_run, "voice": lambda f: proj.set_stage(f, "voice", "in_progress")}
        on_done = (lambda pl: hooks[pl.kind](pl.folder)) if plan.kind in hooks else None
        return jobs.submit(plan, make_provider, on_done).public()

    @app.get("/api/jobs")
    def list_jobs():
        return {"jobs": [j.public() for j in jobs.list()]}

    @app.get("/api/jobs/{job_id}")
    def get_job(job_id: str):
        job = jobs.get(job_id)
        if job is None:
            raise HTTPException(404, "No such job")
        return job.public()

    # ---------- storyboard ----------

    @app.get("/api/projects/{p}/storyboards")
    def storyboards(p: str):
        folder = folder_of(p)
        return {"storyboards": [x.name for x in all_paths(folder / "output", "storyboard", ".html")][::-1]}

    @app.post("/api/projects/{p}/storyboards")
    def render_storyboard(p: str):
        return {"file": SB.render(folder_of(p), paths).name}

    # ---------- voice ----------

    @app.get("/api/voices")
    def voice_catalog():
        v = voices(paths.root)
        return {"catalog": v.get("catalog", {}), "emotions": v.get("emotions", []), "narrator": v.get("narrator", {})}

    @app.get("/api/projects/{p}/voice")
    def voice_lines(p: str):
        folder = folder_of(p)
        if not (folder / "script.json").exists():
            return {"lines": None}
        script = proj.load_script(folder)
        approved = VO.load_approvals(folder)
        out = []
        for line in script.lines:
            try:
                voice = VO.voice_for(paths, line.speaker, script.language).model_dump()
                voice_error = None
            except UserError as e:
                voice, voice_error = None, str(e)
            tk = []
            for f in VO.takes(folder, line.id):
                try:
                    dur = VO.take_duration(f)
                except UserError:
                    dur = None
                tk.append({"file": f.name, "duration": dur})
            out.append({"id": line.id, "speaker": line.speaker, "text": line.text_voice, "subtitle": line.subtitle,
                        "emotion": line.emotion, "voice": voice, "voice_error": voice_error, "takes": tk,
                        "approved": approved.get(line.id)})
        track = VO.latest_track(folder)
        timing = proj.load_timing(folder)
        return {"lines": out, "language": script.language, "target_seconds": script.target_seconds,
                "track": track.name if track else None,
                "timing": timing.model_dump() if timing else None}

    @app.post("/api/projects/{p}/voice/{line_id}/approve/{v}")
    def approve_voice(p: str, line_id: str, v: str):
        return {"file": VO.approve(folder_of(p), line_id, parse_version(v))}

    @app.post("/api/projects/{p}/voice/approve-latest")
    def approve_voice_latest(p: str):
        folder = folder_of(p)
        return {"approved": VO.approve_latest(folder, proj.load_script(folder))}

    @app.post("/api/projects/{p}/voice/track")
    def build_voice_track(p: str):
        timing, track = VO.build_track(paths, folder_of(p))
        return {"timing": timing.model_dump(), "track": track.name}

    @app.post("/api/projects/{p}/retime")
    def retime(p: str):
        new, issues = RT.run(paths, folder_of(p))
        return {"shots": [{"id": s.id, "start": s.start, "end": s.end, "duration": s.duration} for s in new.shots],
                "issues": issues}

    # ---------- clips ----------

    @app.get("/api/projects/{p}/clips")
    def clips(p: str):
        folder = folder_of(p)
        if not (folder / "shotlist.json").exists():
            return {"shots": None}
        sl = proj.load_shotlist(folder)
        script = proj.load_script(folder) if (folder / "script.json").exists() else None
        templates = prompt_templates(paths.root)
        out = []
        for s in sl.shots:
            text = " ".join(l.subtitle for lid in s.line_ids if script and (l := script.line(lid)))
            out.append({
                "id": s.id, "start": s.start, "end": s.end, "duration": s.duration, "text": text,
                "keyframe": s.approved_keyframe, "on_camera_speech": s.on_camera_speech,
                "motion_prompt": s.motion_prompt, "camera": s.camera, "prompt": CL.compose_motion_prompt(templates, s),
                "clips": [x.name for x in CL.clip_takes(folder, s.id)],
                "lipsync": [x.name for x in CL.lipsync_takes(folder, s.id)],
                "approved": s.approved_clip,
            })
        return {"shots": out, "has_track": VO.latest_track(folder) is not None}

    @app.post("/api/projects/{p}/clips/{shot_id}/approve")
    def approve_clip(p: str, shot_id: str, body: TextBody):
        return {"file": CL.approve(folder_of(p), shot_id, body.text)}

    # ---------- assembly ----------

    @app.get("/api/projects/{p}/renders")
    def list_renders(p: str):
        folder = folder_of(p)
        return {"renders": AS.renders(folder), "folder": str(folder / "output")}

    @app.post("/api/projects/{p}/renders")
    def render_video(p: str):
        return AS.assemble(paths, folder_of(p))

    # ---------- costs & settings ----------

    @app.get("/api/costs")
    def costs():
        return dash.compute(paths, settings())

    @app.post("/api/costs/sync")
    def costs_sync(days: int = 30):
        from ..providers.fal import FalPlatform

        s = settings()
        if not s.fal_admin_key:
            raise HTTPException(400, "FAL_ADMIN_KEY is not set in .env (billing APIs need an ADMIN key)")
        start = (datetime.now(timezone.utc) - timedelta(days=min(days, 90))).isoformat(timespec="seconds")
        try:
            events = FalPlatform(s.fal_admin_key).billing_events(start)
        except ProviderError as e:
            raise HTTPException(502, str(e))
        return {"events": len(events), "updated": sync_actuals(ledger, events),
                "fal_total": round(sum(float(e.get("cost_total") or 0) for e in events), 4)}

    @app.get("/api/balance")
    def balance():
        from ..providers.fal import FalPlatform

        s = settings()
        if not s.fal_admin_key:
            return {"balance": None, "error": "FAL_ADMIN_KEY not set"}
        try:
            amount, currency = FalPlatform(s.fal_admin_key).balance()
            return {"balance": amount, "currency": currency, "error": None}
        except ProviderError as e:
            return {"balance": None, "error": str(e)[:200]}

    @app.get("/api/settings")
    def get_settings():
        s = settings()
        return {
            "max_spend_per_run": s.max_spend_per_run, "monthly_budget": s.monthly_budget, "currency": s.currency,
            "has_fal_key": bool(s.fal_key), "has_fal_admin_key": bool(s.fal_admin_key),
            "models": image_models(paths.root), "prices": prices(paths.root), "pipeline": pipeline_cfg(paths.root),
            "tts_models": stage_models(paths.root, "tts"), "video_models": stage_models(paths.root, "video"),
            "lipsync_models": stage_models(paths.root, "lipsync"),
            "system": system_status(pipeline_cfg(paths.root)["assembly"]["subtitle_fonts"]),
            "root": str(paths.root),
        }

    @app.post("/api/prices/check")
    def prices_check():
        from ..providers.fal import FalPlatform

        s = settings()
        key = s.fal_admin_key or s.fal_key
        if not key:
            raise HTTPException(400, "FAL_KEY is not set in .env")
        endpoints = sorted({m[k] for m in image_models(paths.root) for k in ("text_endpoint", "edit_endpoint") if m.get(k)})
        try:
            live = {x["endpoint_id"]: x for x in FalPlatform(key).pricing(endpoints)}
        except ProviderError as e:
            raise HTTPException(502, str(e))
        table = prices(paths.root)
        rows = []
        for ep in endpoints:
            ours = (table.get(ep) or {}).get("unit_price")
            theirs = live.get(ep, {}).get("unit_price")
            rows.append({"endpoint": ep, "ours": ours, "fal": theirs, "unit": live.get(ep, {}).get("unit"),
                         "match": ours is not None and theirs is not None and abs(float(ours) - float(theirs)) < 1e-9})
        return {"rows": rows}

    # ---------- media files ----------

    @app.get("/files/{area}/{rel:path}")
    def files(area: Literal["projects", "library"], rel: str):
        base = (paths.projects if area == "projects" else paths.library).resolve()
        target = (base / rel).resolve()
        if not target.is_relative_to(base) or not target.is_file():
            raise HTTPException(404, "Not found")
        return FileResponse(target)

    # ---------- built frontend (SPA) ----------

    dist = dist_dir(paths.root)

    @app.get("/{full:path}", include_in_schema=False)
    def spa(full: str):
        if full.startswith(("api/", "files/")):
            raise HTTPException(404, "Not found")
        if full:
            candidate = (dist / full).resolve()
            if candidate.is_relative_to(dist.resolve()) and candidate.is_file():
                return FileResponse(candidate)
        index = dist / "index.html"
        if index.exists():
            return FileResponse(index)
        return JSONResponse({"detail": "UI not built. Run: npm --prefix web install && npm --prefix web run build"}, status_code=503)

    return app
