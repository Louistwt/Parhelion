# Parhelion — STATE

Living document. Claude Code updates this at the end of every session.

_Last updated: 2026-09-29_

## Current phase

**Phase 0 → 1: pipeline built through to video; no paid generation run yet.** Voice, clips, lip-sync and rough-cut assembly
are built and tested with fake providers (2026-09-24). Next: add fal credit, pick voices, smoke test, then Demo B.

## Decisions made

- **Demo B clips + lip-sync (2026-09-29):** 7 Kling standard clips ($1.68). Lip-sync looked "stalled at queued": the first LatentSync job had actually finished S04–S06 (`clips/S0{4,5,6}_lipsync_v1.mp4`, 14:47–14:48 UTC); two duplicate jobs from repeated clicks were queued behind it and never sent anything. Claude force-stopped the API (the queue is in memory) and added: a **Stop** button on job panels (`POST /api/jobs/{id}/cancel`; queued = dropped, running = no further requests) and a guard that refuses a second job of the same kind for the same project while one is queued/running. **LatentSync costs $0.20 per request for videos up to 40 s** (fal model page; billing confirmed 3 × $0.20 = $0.60), not $0.005/s as the pricing API suggests: `prices.yaml` now has `minimum_per_request: 0.20` and estimates use it. 77 tests pass. Next: approve the three lip-sync takes on the Clips tab → rebuild the rough cut (Video tab).
- **Demo B motion prompts (2026-09-29):** all 7 keyframes approved (v1 each); Claude wrote one simple motion per shot (speaking only in S04–S06, the lip-sync shots), static camera except S03 slow push in; previous shot list in `.history/`. Lint 0/0. Continuity notes: tablecloth blue-check in S01 vs red-check in S03/S07; S02 background signs may hold fake lettering. Next: Clips → Animate all (Kling 2.5 Turbo standard ≈ $1.68; S03 needs a 10 s clip) → approve → Lip-sync all (3) ≈ $0.07 → Video tab rough cut; on-screen text (hook, panel, L07) in CapCut.
- **Demo B shot list (2026-09-29):** voice takes were approved by the operator, so `timing.json` is real (tts, 30.2 s). `shotlist.json`: 7 shots (3.0–5.9 s), three locations each described once and reused word for word (home dining corner, hotpot restaurant, plain presenter studio); 小朱 on camera with lip-sync in S04–S06 (single face; the 内地/香港 panel is added in editing), 小晶 in S01–S03 and S07, 小朱 as voiceover. No room reference yet (three locations). Lint 0/0. Keyframes would send 小朱 `sheet_v11` + `sheet_v16`, 小晶 `sheet_v7` + `sheet_v8`. Next: Keyframes, 1 per shot ≈ $0.21 on Seedream (confirm first); check the first one before the rest (the realistic keyframe wording is untested since 2026-09-28).
- **Demo B L07 + claims (2026-09-29):** operator removed L07's lead-in 跟客户这样说： → L07 = 发现得早是好事，保障也要从原位癌就管用。 (`script_v3.md`, `script.json` updated). Claims C01–C05 were approved in the Script tab. `parhelion lint`: 0 errors, 0 warnings. Timing estimate now 27.9 s.
- **Demo B script agreed (2026-09-29):** humans agreed `script_v2.md` → `script.json` written (8 lines, all spoken by 小朱; 小晶 on screen only). Stages brief/script `agreed`, approval recorded. `parhelion lint`: 0 errors, 5 warnings (claims C01–C05 unverified, partner review non-blocking). `timing.json` estimated: 29.2 s. Next (free): voice takes for 小朱 (≈ $0.01) or the shot list (Claude); then keyframes with the cast 小朱 → 主播 (`sheet_v16`), 小晶 → main look.
- **Demo B script v2 (2026-09-29):** operator's answers: L08 = 及早有保障，求医更安心，病向浅中医 (the alternative); 小晶 is a man; brief updated 小明 → 小晶 (old version in `.history/`, docs copy updated). `script_v2.md`: 122 characters ≈ 29.5 s, lint clean, claims C01–C05 unverified. Next: humans agree v2 → Claude writes `script.json`.
- **Demo B script v1 (2026-09-29):** `projects/2026-09-28-demo-b/script_v1.md`, 8 lines, 123 spoken characters ≈ 29.7 s; lint clean. Operator chose L01 早发现，却赔不了？, L02 (alcohol, claim C01), L07 (what to say) and L08 及早有保障支援，求医才能病向浅中医 (converted to Simplified; new claim C05; Claude flagged that "有保障…才能…" can read as "no cover, no early treatment" and offered 及早有保障，求医更安心，病向浅中医). Other lines trimmed to fit 30 s. Claims C01–C05 unverified. `siuming` is now displayed as 小晶 ("a Chinese man" in the look text; lines use 他); the brief still says 小明. Next: humans settle L08 / 小晶's gender, then agree the script → `script.json`.
- **Characters page = one folder per character; Demo B cast (2026-09-29):** the Characters page is a grid of tiles, each opening `/characters/<name>` (1 Face · 2 Voice · 3 Looks). Looks are tiles showing their reference image and style; images are 16:9 and can be **named** (the file keeps its version name) and **pinned** as a look's reference. Each project has a **Cast** (Brief tab; `project.json` `cast`), usable before a shot list exists. Demo B cast: 小朱 → 主播 (reference pinned to `sheet_v16.png`, Nano Banana, operator's pick) and 小明 → main look (`sheet_v6`). 75 tests pass.
- **Character workflow (2026-09-29, operator's idea):** characters based on real, recognisable people (with consent) are more useful than random faces, and one character should be reusable across genres. New-character wizard: name → face (photo upload or description) → voice (catalog pick) → outfit & style → one Generate at the end (photo: 1 sheet ≈ $0.03; described face: face portrait then a sheet that uses it ≈ $0.06). Cards are ordered the same way (1 Face · 2 Voice · 3 Looks); looks can have their own style (new style `cartoon3d`, draft wording) and can skip the face photo. 小朱 now has look `anchor_cartoon` (卡通主播, cartoon3d, no face photo) with `sheet_v14` approved. Voice upload is shown as "coming soon". 73 tests pass.
- **Realistic sheets were 3D toys (2026-09-29):** `smallpig/sheet_v14` (主播, face photo sent, `/edit`) came out a 3D toy like `sheet_v13`. Every sheet with the older realistic wording was photoreal (smallpig v12 from the photo, siuming v5/v6); both sheets after the 2026-09-28 keyframe wording (candid, lived-in background, "no CGI look") were toys. Character sheets now use `sheet_styles.realistic` in `prompt_templates.yaml` (the older wording); keyframes keep the new wording, which is **untested on keyframes** too — watch Demo B's first keyframe. Two wasted sheets ≈ $0.06.
- **Person + outfit, face photo upload (2026-09-29):** after a wasted $0.03 sheet (`smallpig/discarded/sheet_v13`: Main look, refine unticked, so **no face photo was sent** and Seedream text-to-image drew a 3D-toy figure; the same model with the photo, `sheet_v12`, is photoreal), (1) a character's face photo is now sent on **every** sheet run, and a run with no reference warns "the model will invent this person's face"; (2) the Generate button always names the look; (3) character text is split into `prompt_block` = the person (shared) and `outfit` per look, so a new look only needs clothes; (4) **Upload photo** on the Characters page (consent tick required; saved as the next `sheet_vN`, becomes `face_ref`, consent noted in `description.md`). 小朱 and 小明 were split into person + outfit (backups `character_before_outfits_20260929.yaml.bak`). 68 tests pass.
- **Character looks (2026-09-29):** a character can have several looks (outfit/build) sharing one face reference; `character.yaml` `looks:`, chosen per video in `shotlist.json` `looks` with per-shot override (Shots tab), generated with `--look` / the look picker on the Characters page. 小朱 has a draft look `anchor` (主播, navy suit and tie; text only, no sheet yet). 66 tests pass; typecheck + i18n clean.
- **Demo B concept (2026-09-29):** 食管癌, Mandarin, 30 s, **news presenter**: 小朱 (`smallpig`) as a fictional anchor + 小明 (`siuming`), who loves spicy food and drinking; for the key point the anchor sits centred with a mainland | HK comparison in words on either side (text added in editing). Key point = **原位癌 (stage 0)** in critical-illness cover: not covered by the mainland 2020 standard unless the product adds it; many HK plans pay part. The earlier skit concept is retired. Brief: `projects/2026-09-28-demo-b/brief.md` (same text in `docs/briefs/demo-b-oesophageal.md`).
- **Partner confirmation is non-blocking for now (2026-09-29):** Claude researches and cites facts itself and work continues without waiting; claims still carry `status: "unverified"` in script.json (lint reports them) until the partner reviews. CLAUDE.md is unchanged.
- **UI redesign (2026-09-29):** theme **Parhelion gold** (gold main colour with navy text, cool navy/grey neutrals, violet only for paid actions), chosen from the palette explorer (`docs/design/palettes.html`, palette 3) **without per-stage colours**: every stage uses one status scheme (to do ring · in progress half · done filled green · needs attention red "!"). Blend of Stripe (calm surfaces), CapCut (media first) and VS Code (status bar). Rules in `DESIGN.md`.
- **UI languages (2026-09-29):** English + **繁體中文 (Hong Kong)** via react-i18next; switch in the status bar. Not yet translated: backend error messages, static storyboard/dashboard HTML.
- **Product idea (2026-09-29, idea only):** Parhelion could become a usage-based ("consumption-based") video pipeline that other people use — hence the multilingual UI. No hosting, accounts or billing until STATE.md says so.
- **Demo A delivered as `projects/2026-09-24-demo-a/output/rough_cut_v2.mp4` (2026-09-28)** — no CapCut for the demo, no more spend on it. Lessons (fixed in code for the next video, $0): 小朱 aged in S02/S04 because only his full-body sheet (tiny face) was sent → per-character `face_ref` (his photo) now sent too; no lip-sync had run (S04's mouth moved only because the motion prompt said "while speaking") and lip-sync would have heard the narrator → lip-sync audio now keeps only on-screen speakers, lint warns on two-face lip-sync shots and on "speaking" motion prompts; fake/inconsistent background → realistic style asks for candid, lived-in, out-of-focus backgrounds, plus an optional **Room reference** (`location_ref`); voice line lengths now come from the decoded audio (subtitle drift gone). Applying all this to Demo A later ≈ $1.7.
- **小朱's face comes from a real photo (2026-09-28):** `library/characters/smallpig/sheet_v11.jpg`, supplied by the operator; the person agreed to their likeness being used in these videos (keep that consent on record; re-check before any new client/use). The photo is approved as a reference; a full-body turnaround sheet is generated from it with "refine from approved sheets" (the prompt keeps the face and ignores the photo's clothes). Look text now includes his build and outfit (white shirt, navy trousers).
- **Keyframe consistency (2026-09-28):** first keyframes mixed up the two men (glasses, clothes, build) because 4 unlabelled sheets were sent per shot and the sheets disagreed (小朱's both have orange-tinted lenses; 小明 v5 goatee vs v6 mustache). Now: one reference sheet per character (latest approved) + a "image 1 = 小明, image 2 = 小朱" legend; look text is appearance only; mood lives in each shot. Default is **1 image per run** (keyframes and sheets); regenerate or discard instead of generating pairs.
- **Work in the main codebase folder `~/Projects/Parhelion` (2026-09-27, clarified 2026-09-29)** — on whatever branch is checked out there (today `main`; side branches later, created deliberately). Never in `.claude/worktrees/` (rule in CLAUDE.md). The old worktree `claude/review-claude-state-docs-72282e` (2026-09-29 Demo B drafts were copied from it to the main folder) can be removed: `git worktree remove .claude/worktrees/review-claude-state-docs-72282e --force` then `git branch -D claude/review-claude-state-docs-72282e`.
- **Image style is chosen per character (2026-09-27)**: `character.yaml` `style:` picks a named block in `library/prompt_templates.yaml` `styles:` (`cartoon` = the old placeholder and the default, `realistic` = photoreal draft wording, a human choice to refine). Set on the Characters page. Shots take their characters' style; one style per video (lint). Character sheets are now generated landscape (`sheet_params`, Seedream 1920×1080 / others 16:9) so the three full-body views fit in one row; the first sheets were cartoon and stacked because the only style was cartoon and the canvas was 9:16.
- **Demo A changed (2026-09-27)**: no longer thyroid cancer / AI twin. Now a 30 s Mandarin skit, "what if" story: 小明 (client, owns cars) and 小朱 (agent); key point = mainland basic insurance only partly reimburses a child's treatment vs HK medical cover arranged while healthy. Draft brief: `docs/briefs/demo-a-cars.md`.
- **Name: Parhelion** (renamed from Mirage on 2026-09-24 because Mirage is used by existing companies).
- Local pipeline. **Local UI (2026-09-24):** `parhelion ui` = React + Vite + TS frontend (`web/`) on a FastAPI JSON API (`parhelion/api/`), bound to 127.0.0.1, single user, no login. Chosen over server-rendered HTMX for better UX and as a base for a future product. Components are **shadcn/ui** (Tailwind v4, radix base, nova preset, brand blue as `--primary`, light/dark/system toggle). `npm run dev` at the repo root runs API + UI together (npm workspace + concurrently). No hosting or database. The storyboard is still a static HTML file (print to PDF).
- **Scope changed 2026-09-24: the demos are finished videos**, not storyboards only (partner's request). Pipeline output is a rough cut + CapCut folder; polish is manual in CapCut. The storyboard stays as the checkpoint before clip spend.
- **Business model (as understood 2026-09-24):** the insurer (partner's employer) persuades and subsidises a broker to buy the videos; the broker sends them regularly to its agents (the viewers). No company names ever appear in videos.
- **Tracking is out of scope for now** — to be discussed with the partner. Zero-cost idea on file: end card with QR/short code → free form with a 3-question quiz + usefulness rating, one video version per broker, CSV import into a local Performance page. Plain MP4s forwarded in chat apps cannot report views.
- **The script is a human + AI discussion.** Claude proposes, drafts and checks; humans decide content, tone and creative choices. Humour is optional and set per video. AI does not judge subjective quality.
- **Timing:** estimated from character count (Mandarin 4.5 chars/s, Cantonese 5.0) until the voice track exists; then `timing.json` comes from the approved takes (`source: tts`) and `parhelion retime` moves shots onto it.
- **TTS = MiniMax Speech 2.8 on fal** (not Azure): same key and billing, Mandarin + Cantonese, ~$0.03 per 60 s video. Voices are chosen by humans per character (`character.yaml`) and for the narrator (`library/voices.yaml`).
- **Video = Kling 2.5 Turbo standard on fal** by default ($0.042/s; pro $0.07/s and Hailuo-02 $0.045/s as alternatives), one take per shot. **Lip-sync = LatentSync** ($0.005/s) by default, only for `on_camera_speech` shots.
- **Assembly is local FFmpeg** (bundled via `imageio-ffmpeg`, so no apt install needed); subtitles are Pillow-rendered PNG overlays using a CJK font (WSL uses Windows' Microsoft YaHei if `fonts-noto-cjk` isn't installed).
- **Models are undecided.** `config/models.yaml` lists candidates (first = default). They will be chosen by a smoke-test comparison.
- **fal.ai is the first provider**: one key, pay per successful output, billing events API for actual spend, pricing API for price checks.
- **Provider choice for storyboard stage (2026-09-24): stay on fal, default Seedream v4 ($0.03/img), 2 variants per shot** (≈ 35 images ≈ $1.05 per 60s storyboard). Cheaper options save < $0.50 per storyboard: Gemini Batch ~$0.02/img (slow, async); BytePlus Seedream 200 free trial images; Alibaba Model Studio 100 free images (Singapore region). None has a spend API like fal's. Revisit at daily volume.
- The pipeline never calls an LLM API. Claude Code does the LLM work in files.
- Stack: Python 3.11+, uv, Typer, Pydantic, httpx, PyYAML, Jinja2, Pillow, FastAPI, imageio-ffmpeg; React + Vite + shadcn/ui.
- The cost ledger is global, `data/costs.jsonl`, and the dashboard is `output/dashboard.html`.

## Roadmap

- [ ] **Phase 0: setup and smoke test**
  - [x] Docs rewritten for storyboard scope and the Parhelion name
  - [x] Scaffold: pyproject, config, schemas, cost guard + ledger, fal provider, lint, timing, keyframes, storyboard, dashboard, tests
  - [x] Tests pass (18, run 2026-09-24 in a temporary venv); CLI checked end to end on a sample project
  - [x] Local UI built: React frontend + FastAPI API, spend modal + background jobs, script drafts/feedback, claims approval, keyframe compare/approve, costs page (28 tests pass; screenshots checked on sample data)
  - [x] `uv sync && uv run pytest` on your machine (28 pass, 2026-09-24)
  - [x] UI built (`web/dist`); start with `uv run parhelion ui`
  - [x] UI moved to shadcn/ui + Tailwind; `npm run dev` at repo root starts API + UI (checked: proxy, Ctrl+C stops both, spend dialog opens without spending)
  - [x] Folder moved to `~/Projects/Parhelion`
  - [ ] GitHub private repo created (see `docs/setup.md`)
  - [ ] fal account with $5–10 credit; `FAL_KEY` (and optional `FAL_ADMIN_KEY`) in `.env`
  - [x] fal keys added (FAL_KEY + FAL_ADMIN_KEY); `parhelion prices check` 2026-09-24: all 6 endpoint prices match (incl. FLUX Kontext endpoint ids)
  - [ ] **Add fal credit** — balance was $0.00 on 2026-09-24; generation will fail until topped up ($5–10 suggested)
  - [x] Video stages built (2026-09-24): voice (TTS) + voice track + retime, clips (image-to-video), lip-sync, rough-cut assembly + CapCut folder; CLI + UI tabs Voice / Clips / Video; 36 tests pass (fake providers + real ffmpeg on generated media)
  - [ ] Raise `PARHELION_MAX_SPEND_PER_RUN` to ~$10 (a full clip run for 12 shots is ~$2.50) and set `PARHELION_MONTHLY_BUDGET` (suggest $50)
  - [x] Voices picked: 小朱 *Reliable executive*, 小明 *Sincere adult* (reused for Demo B)
  - [x] fal credit added; first paid runs 2026-09-27: 2 character sheet runs for `siuming` (小明) and `smallpig` (小朱), 2 images each on Seedream v4 (est. $0.12; 1 failed run at $0). Result: cartoon + messy layout → fixed by the per-character style + landscape sheets
  - [x] Per-character style (cartoon / realistic) + landscape sheets + markdown-safe look text; 45 tests pass (2026-09-27)
  - [x] Discard unwanted character sheets (UI: Discard in the image viewer; CLI: `--discard vN`); moved to `discarded/`, never deleted; 47 tests pass (2026-09-27)
  - [ ] Optional: Nano Banana vs Seedream on 小朱's 主播 look, one each with the face photo (≈ $0.07)
  - [ ] Smoke test (≈ $0.50, confirm first): 1 character on 2–3 image models, 1 keyframe, 2 voice lines, 1 clip — check quality and that billing matches the ledger
  - [ ] `parhelion cost sync` and check that the dashboard matches the fal console
- [ ] **Phase 1: Demo B video**: brief (partner inspiration) → script → fact-check → voice → shots → keyframes → storyboard (partner OK) → clips → rough cut → CapCut
- [ ] **Phase 2: Demos A and C** (A may use an AI-twin tool instead — decide with partner)
- [ ] **Phase 3: client pitch and quote** (drafted together; per-video price with a minimum volume)
- [ ] **Later:** performance tracking (see Decisions); hosted player only if a client funds it

## Candidate tools (prices re-checked live 2026-09-24; quality unverified until smoke test)

**Estimated cost per 60 s video (standard tier):** images ~$1 · clips ~$4 (12 shots × 5 s × 1.5 takes × $0.042) · voice ~$0.03 · lip-sync <$1 → **~$6–8**; all 3 demos with retakes **~$20–30**.

| Need | Candidate | Price read 2026-09-23 | Notes |
|---|---|---|---|
| Keyframes / character sheets | fal `fal-ai/bytedance/seedream/v4/edit` (+ `/text-to-image`) | $0.03/image | Up to 10 reference images. Seedream 5.0 also exists on fal; check it. |
| | fal `fal-ai/nano-banana/edit` (+ `fal-ai/nano-banana`) | $0.0398/image | `aspect_ratio` "9:16". Nano Banana 2 / Pro also exist. |
| | fal FLUX Kontext Pro | $0.04/image | Endpoint id not yet verified |
| | Gemini API direct `gemini-3.1-flash-lite-image` | ~$0.034/image (1K) | Only if fal models aren't good enough |
| | Local ComfyUI on RTX 4060 (8 GB) | $0 | Possible draft provider later |
| TTS | **fal `fal-ai/minimax/speech-2.8-hd`** (default) / `-turbo` | $0.10 / $0.06 per 1,000 chars | Mandarin + Cantonese (`language_boost`), 6 Cantonese + ~30 Mandarin system voices |
| Image-to-video | **fal Kling 2.5 Turbo standard** (default) | $0.042/s | 5 or 10 s; prompt + image_url + negative_prompt |
| | fal Kling 2.5 Turbo pro | $0.07/s | |
| | fal Hailuo-02 standard | $0.045/s | 6 or 10 s; no negative prompt |
| | fal Wan 2.2 / Veo3 fast | $0.08/s / $0.15/s | not configured |
| Lip-sync | **fal LatentSync** (default) | $0.005/s | video_url + audio_url |
| | fal Kling lipsync | $0.014/unit (unit undocumented) | video 2–10 s, 720–1920 px |
| | fal Sync v2 | $3/min | premium |

A 60s storyboard is estimated at about 50 images ≈ $1.5–2.0.

## Verified model facts

_(model id, provider, key params, price, date verified, source URL)_

- 2026-09-29, `fal-ai/minimax/voice-clone`: $1.50 per clone (fal pricing API). Input `audio_url` (≥ 10 s), output `custom_voice_id`; the voice is deleted unless used by a TTS call within 7 days (fal model page). fal's speech-2.8-hd page describes `voice_id` as "Predefined voice ID", so cloned voices on speech-2.8 are **unconfirmed** — test once before building upload.

- 2026-09-24, fal queue API: `POST https://queue.fal.run/{endpoint_id}` with header `Authorization: Key $FAL_KEY`. The response includes `request_id`, `status_url` and `response_url`. Statuses are `IN_QUEUE`, `IN_PROGRESS` and `COMPLETED`. Source: fal.ai/docs/model-apis/model-endpoints/queue
- 2026-09-24, fal billing: `GET https://api.fal.ai/v1/account/billing?expand=credits` returns `credits.current_balance`. `GET https://api.fal.ai/v1/models/billing-events` (params `start`, `end`, `request_id`, `cursor`, `limit`) returns `billing_events[].cost_total`. Both **need an ADMIN API key**. Source: fal.ai/docs/platform-apis/v1/…
- 2026-09-27, sheet sizes (fal model API pages): Seedream v4 `image_size` enum `square_hd, square, portrait_4_3, portrait_16_9, landscape_4_3, landscape_16_9, auto, auto_2K, auto_4K`, or custom `{width,height}` with total pixels between 960×960 and 4096×4096 (1920×1080 OK). Nano Banana `aspect_ratio`: 21:9 16:9 3:2 4:3 5:4 1:1 4:5 3:4 2:3 9:16. FLUX Kontext pro `aspect_ratio`: 21:9 16:9 4:3 3:2 1:1 2:3 3:4 9:16 9:21.
- 2026-09-24, fal pricing: `GET https://api.fal.ai/v1/models/pricing?endpoint_id=…` returns `prices[].unit_price` and `unit`. Live check with our key: seedream v4 text-to-image/edit $0.03, nano-banana (+/edit) $0.0398, flux-pro/kontext text-to-image + multi $0.04 per image — all match config/prices.yaml.
- 2026-09-24, `fal-ai/bytedance/seedream/v4/edit`:
  - inputs: `prompt`, `image_urls` (≤10), `image_size` (enum or `{width,height}`), `num_images`, `seed`, `enable_safety_checker`
  - output: `images[].url`, `seed`
  - price not shown on the model page; the pricing page says $0.03
- 2026-09-24, `fal-ai/nano-banana/edit`:
  - inputs: `prompt`, `image_urls`, `num_images`, `aspect_ratio` (incl. "9:16"), `output_format`, `seed`
  - output: `images[].url`
  - pricing page says $0.0398

## Cost log summary

_(per test / per video, actual)_

- 2026-09-27 character sheets (siuming ×2 runs, smallpig ×1), Seedream v4, still the old cartoon/9:16 code: est. $0.18 (actual not synced yet: run `parhelion cost sync`)

## Open questions

- Which image model keeps our characters most consistent (Seedream vs Nano Banana vs Kontext vs newer versions)?
- Is a local ComfyUI draft mode on the RTX 4060 worth setting up?
- Worth integrating a free-trial provider (BytePlus 200 images / Alibaba 100 images) for the demos? Only if Seedream wins the smoke test.
- Budget numbers: `PARHELION_MAX_SPEND_PER_RUN` (suggested $2) and `PARHELION_MONTHLY_BUDGET` (suggested $30).
- Display currency: USD only, or USD + HKD?
- Client quote: pending your explanation of the business situation.
- Demo A (new story): partner to confirm the key point wording and facts F1–F6 in `docs/briefs/demo-a-cars.md`, and whether "medical fees" means medical cover, CI cover or both. Humans: hook line, closing line, "what to say" line, 小明's and the child's ages.
- Character ids: the brief says `xiaoming`/`xiaozhu` but the library folders are `siuming`/`smallpig`. The script must use the folder names (or rename the folders).
- Key point for Demo C from partner. **Demo B** brief drafted 2026-09-29 (facts F1–F5, F7 sourced, unverified). For the partner, non-blocking: panel wording and whether HK in-situ payouts of 10–30% (Consumer Council, 2017) are still typical; keep the spicy-food visual (spicy food is not an established cause; no claim is made); is a mock-news format acceptable; mandatory wording. Humans: check 小朱's anchor look text, close payoff, "what to say".
- `PARHELION_MONTHLY_BUDGET` is not set in `.env` (defaults to $30).
- Tracking/measurement: which channel will the broker use (WhatsApp / WeChat / LMS)? Does the insurer accept a form + QR end card, or want a hosted player? Who pays for hosting?
- Voices: is *Reliable executive* right for 小朱 as a news anchor (the catalog also has *News anchor*)? Human choice.
- **Idea — custom voice (not built):** MiniMax voice cloning on fal (`fal-ai/minimax/voice-clone`, read 2026-09-29): `audio_url` ≥ 10 s → `custom_voice_id`; the voice is deleted unless used by a TTS call within 7 days. Price and Speech 2.8 compatibility unverified. Could go in `character.yaml` `voice.voice_id`. **Only with the speaker's written consent** — never a celebrity's or anyone else's voice without it.
- **Idea — custom background:** already possible with the Room reference (`shotlist.json` `location_ref`, any image in the project folder, Shots tab). Limit: one reference per video; a per-shot reference is not built.
- Background music/SFX licensing (future).

## Demo videos

All: 60–90s target (30s acceptable for early tests), 9:16, one key HK vs mainland point each unless the brief says otherwise. All medical/insurance facts must be verified by partner. **Concepts below are drafts to discuss, not fixed.**

**Demo A: 「第二次机会」** (story changed again 2026-09-27)
- Language: Mandarin, 30 s, skit, realistic style
- Characters: 小明 (`siuming`, father, late 30s, voice *Sincere adult*) and 小朱 (`smallpig`, his friend **and the car dealer**, late 40s, not an agent, voice *Gentle senior*); narrator *Male announcer*. Both have approved realistic sheets (v5, v6).
- Story: 小明 sells his two cars to 小朱 to pay his child's HK$100,000 medical bill; narrator gives the HK vs mainland point; 小朱 hands over the cheque for the cars: 「不是每次都有第二次机会，以后怎么做，你心里有数」; 小明: 「真正的宝贝，要这样护着」.
- **script_v2 agreed by humans + script.json written 2026-09-27**: 7 lines, 119 chars, estimated 28.3 s, lint 0 errors. Claims C01–C04 unverified, waiting for the partner (C04 = the HK$100,000 amount).
- 2026-09-27: brief.md rewritten to match v2 (old one in `.history/`); project stages brief/script `agreed`; `timing.json` estimated 28.2 s; lint 0 errors; voice dry run $0.014. **Ready for Voice** (app → Demo A → Voice tab). 2026-09-28: shot list written: 6 shots on the estimated timing; L02/L07 share shots with neighbours so retime keeps every shot within 3–8 s; people are described by look, and the bill/cheque as blank paper so the model doesn't print text, then shot list → keyframes → storyboard → clips → rough cut. Whole demo ≈ $1.5–2. Purpose: a finished demo for the partner to see.

**Demo B: Oesophageal cancer** ← build first
- Language: Mandarin, 30 s, news presenter, realistic style
- Characters: 小朱 (`smallpig`) = fictional news anchor in look `anchor` (not modelled on any real presenter/channel); 小明 (`siuming`) = loves spicy hotpot and drinking. Approved sheets and voices from Demo A.
- Hook (humans, 2026-09-29): 「早发现，却赔不了？」 over 小明 frowning at a blank letter — found at 0期 (原位癌), his mainland CI policy only pays once it is invasive. The payout waits, never the treatment. Term: **食管癌** (mainland) in voice and subtitles.
- Key point (draft, CI cover only): 原位癌 (stage 0) — not covered by the mainland 2020 standard unless the product adds it; many HK plans pay part of the sum insured. (Both sides pay 100% from invasive stage I; repeat claims dropped to keep one point.) One-row comparison panel in the brief.
- Research 2026-09-29 (all unverified, sources in the brief): mainland 中保协 2020 standard (28 severe + 3 mild; 原位癌 excluded from both; mild payout capped at 30%); HKFI voluntary CI definitions for new products from 1 Sep 2026 (16 major + 5 minor, CIS a minor condition); Consumer Council 2017: HK CIS/early-stage payouts 10–30%; alcohol IARC Group 1 (oesophagus); spicy food not an established cause.
- Project folder: `projects/2026-09-28-demo-b/`, fixed to Mandarin (it was created as Cantonese).

**Demo C: Pancreatic cancer**
- Language: Cantonese (subtitles in written Simplified Chinese)
- Style (draft): fast Douyin-style talking-head, fictional presenter
- Concept (draft): "the quiet one", often found late.
- Key point: TBD by partner (e.g. access to treatment/drugs in HK).

## Next steps

0. (2026-09-28, rough cut) `rough_cut_v2.mp4` has the voice (v1 was silent: the Timing tab's Estimate button had overwritten the real voice timing 9 s after the voice track was built; now blocked in API, UI and CLI). Voice track v2 = 30.8 s; shots retimed to it (old shot list in `.history/`); S06's clip is 0.19 s short, so assembly holds its last frame. Known: provider line durations run ~0.05 s long each, so late subtitles can be ~0.3 s late. Next: watch v2 → polish in CapCut (`output/capcut_v2/`).
0. (2026-09-28, latest) 小朱: Characters page → tick "refine from approved sheets" → Generate 1 sheet (≈ $0.03, uses the photo) → approve it if it's right (it becomes his keyframe reference). Then Keyframes as below. His voice is still *Gentle senior* (an older voice); he now looks mid-30s–40s, so consider re-picking.
0. (2026-09-28, later) Keyframe consistency fixes done (one reference sheet per character + legend, look text cleaned, serious mood in the shot list, 1 image per run, discard keyframes, new Shots tab). **Next:** Characters → 小朱 → generate 1 new sheet (clear lenses, ≈ $0.03) and approve it (it becomes his reference); Keyframes → approve S03, discard unwanted ones, generate the rest at 1 each (≈ $0.15). Earlier: Next: review the Shots tab → Keyframes (6 × 2 ≈ $0.36) → pick one per shot → Storyboard. Voice any time (≈ $0.01); after Build voice track, run retime before clips.
0. (2026-09-27) Merge branch `claude/review-claude-state-docs-72282e` into `main`, then on the Characters page set Style = realistic for 小明 and 小朱, rewrite their look text as plain sentences (age, ethnicity, build, outfit incl. shoes), and regenerate sheets (≈ $0.12 on Seedream; confirm first). Copy `docs/briefs/demo-a-cars.md` into the Demo A project's `brief.md`.
1. Start the UI: `npm install` once, then `npm run dev` → http://127.0.0.1:5173 (or `npm start` for the single-server build on :8765). See `docs/setup.md`.
2. Reopen Claude Code in `~/Projects/Parhelion`. Create the GitHub repo (see `docs/setup.md`).
3. Create a fal account, add credit, put the keys in `.env`, and run `parhelion prices check`.
4. Run the smoke test (confirm cost first).
5. Demo B: Characters → 小朱 → Look: 主播 → check the outfit text → Generate 1 sheet · 主播 (≈ $0.03; the spend dialog should show 1 reference on `seedream/v4/edit`) → approve it into the look. Fill the brief's remaining `[TODO: humans]` (close payoff, "what to say"), then the script working session (Claude proposes an outline → `script_v1.md`). When the shot list exists, set Looks: 小朱 → 主播 on the Shots tab.
6. After the storyboard is agreed: voice → retime → clips → Video tab → CapCut.
