# Parhelion — AI short-video pipeline

Read this file and STATE.md at the start of every session. Update STATE.md at the end of every session.

> **Current scope: brief → script → shot list → keyframes → storyboard.**
> Voice, clips, lip-sync, assembly and CapCut polish are *future* stages. Do not build them until STATE.md says so.

## What Parhelion is

A local pipeline for producing short (30–90s), vertical (9:16) training videos for licensed insurance agents who sell Hong Kong medical/critical-illness insurance to mainland Chinese clients. Tone and format are set per video (skit, talking-head, explainer, Q&A…). Videos build understanding: why clients need cover, how HK and mainland cover differ, what illnesses and risks mean financially. They are NOT product or company adverts.

Current goal: 3 demo **storyboards** to discuss with the client before any video is generated (see STATE.md).

The operator is a developer (me). My partner is an insurance veteran (20+ years) who supplies key points and fact-checks every script.

## Division of labour

| Who | Does | Does not |
|---|---|---|
| **Humans** (me + partner) | Brief, key points, facts, tone and all creative choices (including any humour), character approval, keyframe picks, client discussion, final say on every line | — |
| **Claude Code** (Claude Max, works in files) | Script working session: proposes an outline, drafts lines, offers 2–3 alternatives when asked. Runs checks and explains results against stated rules. Converts the agreed `script_vN.md` to `script.json`. Builds `shotlist.json` from timing. Fills prompt templates. Keeps STATE.md current. | Decide what is funny or "good"; invent facts or statistics; approve anything |
| **Pipeline code** (Python) | Deterministic checks, timing estimates, cost estimates, paid image calls, rendering the storyboard and cost dashboard | Call any LLM API (there is no Anthropic API key) |

## Production flow (storyboard scope)

Each stage writes versioned files into `projects/<YYYY-MM-DD-slug>/` and records status in `project.json`. Never skip a checkpoint.

| # | Stage | Who | Output | Checkpoint |
|---|---|---|---|---|
| 0 | Brief | Humans | `brief.md` (format, tone, beats, key point, language, length) | — |
| 1 | Script (loop) | Humans + Claude Code | `script_v1.md`, `script_v2.md`, … → `script.json` | `parhelion lint` clean → partner fact-checks claims → approve |
| 2 | Timing | Pipeline | `timing.json` (estimated from character count) | — |
| 3 | Characters | Humans write `character.yaml` → pipeline (image) | `library/characters/<name>/sheet_vN.png` (reused across videos) | `parhelion character <name> --approve vN` |
| 4 | Shot list | Claude Code | `shotlist.json` built from `timing.json` + prompt templates | `parhelion lint` clean → approve |
| 5 | Keyframes | Pipeline (image) | `keyframes/S01_v1.png` … (N variants per shot) | Pick one per shot (`parhelion approve`) |
| 6 | Storyboard | Pipeline | `output/storyboard_vN.html` (print to PDF) | Client discussion |

**Future** (not built): voice (TTS) → real timing → clips (image-to-video) → lip-sync → assembly (FFmpeg) → CapCut polish.

Key principle: images are cheap, video is expensive. Agree the storyboard with the client before any video spend.

### Script working session

1. Claude reads `brief.md` and proposes an outline using the beats the brief declares.
2. Humans and Claude discuss. Claude drafts or revises lines on request and saves each round as a new `script_vN.md`, so there is a history.
3. Lines that humans still need to write are marked `[TODO: …]`.
4. When humans say the script is agreed: run `parhelion lint`, fix what it reports, and send the claims to the partner. After approval, write `script.json`.

## Content rules (apply to every script and prompt)

1. **No company names, product names, or policy names.** Generic concepts only. Terms to avoid go in `library/banned_terms.txt` (checked by lint).
2. **Every medical or insurance fact** goes in the script's `claims` list with `status: "unverified"` until my partner approves it. Never present unverified claims as final. Do not invent statistics; if a number is needed and unknown, write `[TODO: number]` and flag it.
3. **If a video uses humour**, it targets behaviour (excuses, habits, awkward sales moments), never patients, symptoms or death.
4. No fear-mongering or misleading pressure tactics. Consequences must be factual.
5. **Structure** is declared per video in `brief.md`. Default template, used when the brief doesn't override it:
   - Hook (0–3s)
   - Setup: client objection or relatable scenario
   - Key point: one HK vs mainland difference (one per video unless the brief says otherwise)
   - What to say: one sentence the agent can reuse with a client
   - Close / recap
6. Speech budget: roughly 4–5 Chinese characters per second (see `config/pipeline.yaml`).

## Language rules

- Voice: Mandarin (普通话) or Cantonese (粤语), set per video.
- Subtitles and on-screen text: Simplified Chinese by default.
- Cantonese videos need two text tracks per line: `text_voice` in colloquial spoken Cantonese (口语) and `text_subtitle` in standard written Chinese (书面语, Simplified). Mandarin uses the same text for both.
- `library/pronunciation.json` (term → phonetic hint) will be applied before TTS (future stage).

## Visual rules

- 9:16, 1080×1920 final output.
- **Never generate text inside images or video.** All text is added later. Every image prompt includes the negative block from `library/prompt_templates.yaml` (checked by lint).
- Shots are 3–8 seconds, one generated clip per shot (future).
- Prefer voiceover, cutaways, over-the-shoulder and props over on-camera speech. `on_camera_speech` stays in the schema (default `false`) for the future lip-sync stage.
- Simple camera moves. Complex motion causes character drift.
- Always pass character sheet images as references for consistency.
- **Prompts come from templates.** `library/prompt_templates.yaml` holds the style block, character blocks, framing vocabulary and negative block. Claude fills only the per-shot `action` and `setting` fields; `parhelion` composes the final prompt.

## Checks (`parhelion lint <project>`)

Deterministic, no AI. Run before every checkpoint.
- Speech budget per line and total vs `target_seconds`
- Every beat declared in the script has lines
- No `[TODO` placeholders left
- No banned terms
- Every claim linked to existing lines; unapproved claims reported
- Every line id referenced by a beat exists
- Shots 3–8 s; shot line ids exist; shots have `action` filled
- Composed image prompts contain the negative block

## Data schemas (Pydantic models in `parhelion/schemas.py`)

`script.json`:
```json
{
  "title": "", "language": "mandarin|cantonese", "target_seconds": 60,
  "format": "skit", "characters": ["xiaowang", "zhangshu"],
  "beats": [{ "name": "hook", "line_ids": ["L01"] }],
  "lines": [{
    "id": "L01", "speaker": "zhangshu|narrator",
    "text_voice": "", "text_subtitle": "",
    "emotion": "", "on_screen_text": "", "sfx": ""
  }],
  "claims": [{ "id": "C01", "text": "", "line_ids": ["L05"], "status": "unverified|approved|rejected", "note": "" }]
}
```

`shotlist.json`:
```json
{ "shots": [{
  "id": "S01", "start": 0.0, "end": 4.2, "line_ids": ["L01"],
  "framing": "medium close-up", "characters": ["zhangshu"], "props": ["teacup"],
  "setting": "", "action": "", "on_camera_speech": false, "notes": "",
  "motion_prompt": "", "approved_keyframe": null, "approved_clip": null
}]}
```

`project.json`: slug, language, target seconds, stage statuses, approvals (who/when), chosen models.

Cost ledger `data/costs.jsonl` (one JSON object per line): `ts, project, stage, provider, model, units, unit, est_cost_usd, actual_cost_usd, request_id, status`.

## Repository layout

```
Parhelion/
  CLAUDE.md  STATE.md  README.md  pyproject.toml  .env  .env.example
  config/
    models.yaml       # stage -> candidate models (first = default) + params
    prices.yaml       # model -> unit price, source URL, date verified
    pipeline.yaml     # speech rates, shot limits, variants per shot
  parhelion/
    cli.py  schemas.py  config.py  cost.py  dashboard.py  versioning.py  project.py
    providers/base.py  providers/fal.py
    stages/lint.py  timing.py  prompts.py  imagegen.py  characters.py  keyframes.py  storyboard.py
    templates/storyboard.html.j2  dashboard.html.j2
  library/
    characters/<name>/character.yaml (prompt_block, approved_sheets) + description.md + sheet_vN.png
    props/  pronunciation.json  banned_terms.txt  prompt_templates.yaml
  docs/setup.md
  tests/
  projects/<YYYY-MM-DD-slug>/   # gitignored media
  data/                         # gitignored cost ledger
  output/                       # gitignored dashboard
```

## CLI (storyboard scope)

```
parhelion new <slug> --lang mandarin|cantonese --seconds 60
parhelion status <project>
parhelion lint <project>
parhelion timing <project>
parhelion character <name> [--n 2] [--model ...] [--dry-run] [--yes]
parhelion keyframes <project> [--shot S03] [--n 3] [--model ...] [--dry-run] [--yes]
parhelion approve <project> keyframe S03 v2
parhelion storyboard <project>
parhelion cost [--project p]            # ledger summary
parhelion cost sync                     # pull actual costs from fal billing events
parhelion prices check                  # compare config/prices.yaml with fal pricing API
parhelion dashboard                     # writes output/dashboard.html
```
`ph` is a short alias for `parhelion`. Future: `voice`, `clips`, `assemble`.

## Engineering rules

- Python 3.11+, managed with `uv`. Typer, Pydantic, httpx, python-dotenv, PyYAML, Jinja2, Pillow.
- All providers behind the interfaces in `providers/base.py`. **Models are not decided**: `config/models.yaml` lists candidates per stage (first = default); switching model is a config edit or `--model`, never a code change.
- **Verify model IDs, parameters and prices from current official docs before using them.** Record what you verified and when in STATE.md and `config/prices.yaml`. `parhelion prices check` compares against fal's pricing API.
- **Cost guard:** before any paid call, print an itemised estimate and require confirmation (`--yes` to skip). Enforce `PARHELION_MAX_SPEND_PER_RUN` (block) and `PARHELION_MONTHLY_BUDGET` (warn at 80%, block at 100%). Log every paid call to `data/costs.jsonl`.
- Never overwrite generated media. Always write a new version (`_v2`, `_v3`).
- Save the exact prompt, model, seed and parameters next to every generated file (`*.json` sidecar).
- Async jobs: use the provider's queue API with timeouts and retries; a failed job must not crash the run or lose completed work.
- `--dry-run` on every paid command.
- Never commit `.env` or project media. Keep `.gitignore` updated.
- Keep it simple. No web server, database or cloud deployment until STATE.md says so. Reports are static HTML files.

## Session habits

- Start: read STATE.md, summarise where we are, propose the next step, wait for my go-ahead on anything that spends money.
- End: update STATE.md (done, decisions, open questions, next steps, verified model facts).
