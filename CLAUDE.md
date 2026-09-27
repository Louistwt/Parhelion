# Parhelion — AI short-video pipeline

Read this file and STATE.md at the start of every session. Update STATE.md at the end of every session.

> **Current scope: brief → script → voice → shot list → keyframes → storyboard → clips → lip-sync → rough cut → CapCut.**
> The storyboard is the approval checkpoint before any clip (video) money is spent. Final polish is manual in CapCut.
> Performance tracking (QR codes, forms, hosting) is *not* in scope until STATE.md says so.

## What Parhelion is

A local pipeline for producing short (30–90s), vertical (9:16) training videos for licensed insurance agents who sell Hong Kong medical/critical-illness insurance to mainland Chinese clients. Tone and format are set per video (skit, talking-head, explainer, Q&A…). Videos build understanding: why clients need cover, how HK and mainland cover differ, what illnesses and risks mean financially. They are NOT product or company adverts.

Current goal: 3 finished demo **videos** (rough cut from the pipeline, polished in CapCut) — see STATE.md.

The operator is a developer (me). My partner is an insurance veteran (20+ years) who supplies key points and fact-checks every script.

## Division of labour

| Who | Does | Does not |
|---|---|---|
| **Humans** (me + partner) | Brief, key points, facts, tone and all creative choices (including any humour), character approval, keyframe picks, client discussion, final say on every line | — |
| **Claude Code** (Claude Max, works in files) | Script working session: proposes an outline, drafts lines, offers 2–3 alternatives when asked. Runs checks and explains results against stated rules. Converts the agreed `script_vN.md` to `script.json`. Builds `shotlist.json` from timing. Fills prompt templates. Keeps STATE.md current. | Decide what is funny or "good"; invent facts or statistics; approve anything |
| **Pipeline code** (Python) | Deterministic checks, timing, retiming, cost estimates, paid image / voice / video / lip-sync calls, FFmpeg assembly, storyboard and cost dashboard | Call any LLM API (there is no Anthropic API key) |

## Production flow

Each stage writes versioned files into `projects/<YYYY-MM-DD-slug>/` and records status in `project.json`. Never skip a checkpoint.

| # | Stage | Who | Output | Checkpoint |
|---|---|---|---|---|
| 0 | Brief | Humans | `brief.md` (format, tone, beats, key point, language, length) | — |
| 1 | Script (loop) | Humans + Claude Code | `script_v1.md`, `script_v2.md`, … → `script.json` | `parhelion lint` clean → partner fact-checks claims → approve |
| 2 | Timing | Pipeline | `timing.json` (estimated from character count) | — |
| 3 | Characters | Humans write `character.yaml` → pipeline (image) | `library/characters/<name>/sheet_vN.png` (reused across videos) | `parhelion character <name> --approve vN` |
| 4 | Shot list | Claude Code | `shotlist.json` built from `timing.json` + prompt templates | `parhelion lint` clean → approve |
| 5 | Keyframes | Pipeline (image) | `keyframes/S01_v1.png` … (N variants per shot) | Pick one per shot (`parhelion approve`) |
| 6 | Storyboard | Pipeline | `output/storyboard_vN.html` (print to PDF) | Partner/client agrees → only then clips |
| 7 | Voice | Pipeline (TTS) + humans | `audio/L01_vN.mp3` per line → approve one take each (`voice.json`) | Listen → approve |
| 8 | Real timing | Pipeline | `audio/track_vN.wav` + `timing.json` (source `tts`) → `parhelion retime` moves shots onto it | Check shots stay 3–8 s |
| 9 | Clips | Pipeline (image-to-video) | `clips/S01_vN.mp4` from the approved keyframe + `motion_prompt` | Pick one per shot |
| 10 | Lip-sync | Pipeline | `clips/S03_lipsync_vN.mp4` (only `on_camera_speech` shots) | Pick one |
| 11 | Rough cut | Pipeline (FFmpeg, free) | `output/rough_cut_vN.mp4` (+ `_clean`, `subtitles_vN.srt`, `capcut_vN/`) | Polish in CapCut |

Voice (7–8) can run any time after the script is agreed — it is cheap and gives real timing early. A rough cut can be rendered
before clips exist: shots without a clip use their keyframe with a slow zoom (an animatic).

Key principle: images and voice are cheap, video is expensive. Agree the storyboard before clip spend; one take per shot,
regenerate only rejected shots.

### Script working session

1. Claude reads `brief.md` and proposes an outline using the beats the brief declares.
2. Humans and Claude discuss. Claude drafts or revises lines on request and saves each round as a new `script_vN.md`, so there is a history.
3. Lines that humans still need to write are marked `[TODO: …]`.
4. Before writing a new draft, read the latest `script_vN.md` **and** `script_vN.feedback.md` if it exists (feedback written in the UI). Never edit an existing draft; always write `script_v(N+1).md`. Drafts whose first line is `<!-- edited by human in Parhelion UI … -->` were edited by a human; keep their wording unless asked.
5. When humans say the script is agreed: run `parhelion lint`, fix what it reports, and send the claims to the partner (they can approve/reject claims in the UI Script tab). After approval, write `script.json`.

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
- TTS: MiniMax Speech via fal (`config/models.yaml` → `tts`). `language_boost` is `Chinese` (Mandarin) or `Chinese,Yue` (Cantonese). Voices are a **human choice**: per character in `character.yaml` (`voice:`), narrator in `library/voices.yaml`. `line.emotion` is used when it is one of MiniMax's emotions.
- `library/pronunciation.json` (`terms`: word → tone hint like `(chu3)(li3)`) is sent as MiniMax `pronunciation_dict` on every TTS call.

## Visual rules

- 9:16, 1080×1920 final output.
- **Never generate text inside images or video.** All text is added later. Every image prompt includes the negative block from `library/prompt_templates.yaml` (checked by lint).
- Shots are 3–8 seconds, one generated clip per shot. A clip is generated at the model's nearest length (Kling 5/10 s, Hailuo 6/10 s) and trimmed in assembly.
- Prefer voiceover, cutaways, over-the-shoulder and props over on-camera speech. Only shots with `on_camera_speech: true` go to lip-sync.
- **Motion prompts come from templates too**: `prompt_templates.yaml` → `motion` / `default_camera` / `motion_negative`. Claude fills a shot's `motion_prompt` (what moves, one simple action) and optionally `camera` (e.g. "slow push in"); nothing else.
- Subtitles are burned in assembly from `text_subtitle` (Pillow-rendered PNG overlays, CJK font from `config/pipeline.yaml` → `assembly.subtitle_fonts`); a clean version and an SRT are always produced for CapCut.
- Simple camera moves. Complex motion causes character drift.
- Always pass character sheet images as references for consistency.
- **Style is chosen per character** (`character.yaml` `style:` → a key under `styles:` in `prompt_templates.yaml`, e.g. `cartoon`, `realistic`; human choice, set on the Characters page). Shots use their characters' style; shots with nobody in frame use the style of the script's characters. One style per video (lint errors on a mixed shot, warns on a mixed script).
- Character sheets are generated landscape (`sheet_params` in `config/models.yaml`) so the three full-body views fit in one row. Write `prompt_block` as plain sentences: age, ethnicity, build, hair, full outfit down to the shoes (markdown is flattened, but headings are dropped).
- **Prompts come from templates.** `library/prompt_templates.yaml` holds the named styles, character blocks, framing vocabulary and negative block. Claude fills only the per-shot `action` and `setting` fields; `parhelion` composes the final prompt.

## Checks (`parhelion lint <project>`)

Deterministic, no AI. Run before every checkpoint.
- Speech budget per line and total vs `target_seconds`
- Every beat declared in the script has lines
- No `[TODO` placeholders left
- No banned terms
- Every claim linked to existing lines; unapproved claims reported
- Every line id referenced by a beat exists
- Shots 3–8 s; shot line ids exist; shots have `action` filled; approved-keyframe shots have a `motion_prompt`
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
  "motion_prompt": "", "camera": "", "approved_keyframe": null, "approved_clip": null
}]}
```

`project.json`: slug, language, target seconds, stage statuses, approvals (who/when), chosen models.
`voice.json`: `{"approved": {"L01": "L01_v2.mp3"}}`. `timing.json`: `source` is `estimate` or `tts`.

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
    media.py                  # ffmpeg helpers (system ffmpeg, else bundled imageio-ffmpeg)
    stages/lint.py  timing.py  prompts.py  imagegen.py  mediagen.py  characters.py  keyframes.py  storyboard.py
    stages/voice.py  retime.py  clips.py  assemble.py
    templates/storyboard.html.j2  dashboard.html.j2
  library/
    characters/<name>/character.yaml (prompt_block, style, approved_sheets, voice) + description.md + sheet_vN.png
    props/  pronunciation.json  banned_terms.txt  prompt_templates.yaml  voices.yaml
  parhelion/api/app.py  jobs.py  drafts.py   # local JSON API for the UI
  web/                          # React + Vite + TS frontend (web/dist, node_modules gitignored)
  docs/setup.md
  tests/
  projects/<YYYY-MM-DD-slug>/   # gitignored media
  data/                         # gitignored cost ledger
  output/                       # gitignored dashboard
```

## CLI

```
parhelion new <slug> --lang mandarin|cantonese --seconds 60
parhelion status <project>
parhelion lint <project>
parhelion timing <project>
parhelion character <name> [--n 2] [--model ...] [--dry-run] [--yes]   # also --approve vN / --discard vN
parhelion keyframes <project> [--shot S03] [--n 3] [--model ...] [--dry-run] [--yes]
parhelion approve <project> keyframe|audio|clip|lipsync <S03|L01> v2
parhelion storyboard <project>
parhelion voice <project> [--line L03] [--model ...] [--dry-run] [--yes]
parhelion voice-track <project> [--approve-latest]   # real timing + audio/track_vN.wav (free)
parhelion retime <project>                           # shots onto real timing (free)
parhelion clips <project> [--shot S03] [--n 1] [--model ...] [--dry-run] [--yes]
parhelion lipsync <project> [--shot S03] [--model ...] [--dry-run] [--yes]
parhelion assemble <project>                         # rough cut + CapCut folder (free)
parhelion cost [--project p]            # ledger summary
parhelion cost sync                     # pull actual costs from fal billing events
parhelion prices check                  # compare config/prices.yaml with fal pricing API
parhelion dashboard                     # writes output/dashboard.html
parhelion ui [--port 8765] [--no-browser] [--reload]   # local UI at http://127.0.0.1:8765
npm run dev                             # (repo root) API + UI with hot reload at http://127.0.0.1:5173
```
`ph` is a short alias for `parhelion`.

## Engineering rules

- Python 3.11+, managed with `uv`. Typer, Pydantic, httpx, python-dotenv, PyYAML, Jinja2, Pillow, FastAPI, imageio-ffmpeg (bundled ffmpeg; a system ffmpeg is used if installed).
- One paid-run shape for every stage: a `RunPlan` of jobs (`stages/imagegen.py` images, `stages/mediagen.py` audio/video), estimated with no side effects, executed after confirmation. Input files are uploaded to fal storage at run time.
- All providers behind the interfaces in `providers/base.py`. **Models are not decided**: `config/models.yaml` lists candidates per stage (first = default); switching model is a config edit or `--model`, never a code change.
- **Verify model IDs, parameters and prices from current official docs before using them.** Record what you verified and when in STATE.md and `config/prices.yaml`. `parhelion prices check` compares against fal's pricing API.
- **Cost guard:** before any paid call, print an itemised estimate and require confirmation (`--yes` to skip). Enforce `PARHELION_MAX_SPEND_PER_RUN` (block) and `PARHELION_MONTHLY_BUDGET` (warn at 80%, block at 100%). Log every paid call to `data/costs.jsonl`.
- Never overwrite generated media. Always write a new version (`_v2`, `_v3`). Unwanted outputs are discarded, not deleted: moved with their sidecar to a `discarded/` subfolder, and their version number is never reused (`versioning.discard`).
- Save the exact prompt, model, seed and parameters next to every generated file (`*.json` sidecar).
- Async jobs: use the provider's queue API with timeouts and retries; a failed job must not crash the run or lose completed work.
- `--dry-run` on every paid command.
- Never commit `.env` or project media. Keep `.gitignore` updated.
- Keep it simple. **Local UI on localhost only**: React + Vite + TypeScript + Tailwind v4 + **shadcn/ui** in `web/` (npm workspace; `npm run dev` at the root runs API + UI), FastAPI JSON API in `parhelion/api/`. Use shadcn components (`npx shadcn@latest add <name>` in `web/`) rather than hand-rolled ones; theme tokens live in `web/src/index.css`. No hosting, auth, database or cloud deployment until STATE.md says so. The API is a thin layer: all pipeline logic stays in `parhelion/stages/` and `parhelion/cost.py`, shared with the CLI.
- Paid runs in the UI follow the same guard as the CLI: estimate → budget check → explicit confirm → one background job at a time.

## Session habits

- Start: read STATE.md, summarise where we are, propose the next step, wait for my go-ahead on anything that spends money.
- End: update STATE.md (done, decisions, open questions, next steps, verified model facts).
