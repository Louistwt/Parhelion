# Parhelion — STATE

Living document. Claude Code updates this at the end of every session.

_Last updated: 2026-09-27_

## Current phase

**Phase 0 → 1: pipeline built through to video; no paid generation run yet.** Voice, clips, lip-sync and rough-cut assembly
are built and tested with fake providers (2026-09-24). Next: add fal credit, pick voices, smoke test, then Demo B.

## Decisions made

- **Demo A delivered as `projects/2026-09-24-demo-a/output/rough_cut_v2.mp4` (2026-09-28)** — no CapCut for the demo, no more spend on it. Lessons (fixed in code for the next video, $0): 小朱 aged in S02/S04 because only his full-body sheet (tiny face) was sent → per-character `face_ref` (his photo) now sent too; no lip-sync had run (S04's mouth moved only because the motion prompt said "while speaking") and lip-sync would have heard the narrator → lip-sync audio now keeps only on-screen speakers, lint warns on two-face lip-sync shots and on "speaking" motion prompts; fake/inconsistent background → realistic style asks for candid, lived-in, out-of-focus backgrounds, plus an optional **Room reference** (`location_ref`); voice line lengths now come from the decoded audio (subtitle drift gone). Applying all this to Demo A later ≈ $1.7.
- **小朱's face comes from a real photo (2026-09-28):** `library/characters/smallpig/sheet_v11.jpg`, supplied by the operator; the person agreed to their likeness being used in these videos (keep that consent on record; re-check before any new client/use). The photo is approved as a reference; a full-body turnaround sheet is generated from it with "refine from approved sheets" (the prompt keeps the face and ignores the photo's clothes). Look text now includes his build and outfit (white shirt, navy trousers).
- **Keyframe consistency (2026-09-28):** first keyframes mixed up the two men (glasses, clothes, build) because 4 unlabelled sheets were sent per shot and the sheets disagreed (小朱's both have orange-tinted lenses; 小明 v5 goatee vs v6 mustache). Now: one reference sheet per character (latest approved) + a "image 1 = 小明, image 2 = 小朱" legend; look text is appearance only; mood lives in each shot. Default is **1 image per run** (keyframes and sheets); regenerate or discard instead of generating pairs.
- **Work directly on `main` in `~/Projects/Parhelion` for now (2026-09-27)** — no Claude worktrees; side branches later, created deliberately. The old worktree `claude/review-claude-state-docs-72282e` is fully merged and can be deleted.
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
  - [ ] Pick voices for 小王 / 张叔 on the Characters page (preview ≈ $0.003 each)
  - [x] fal credit added; first paid runs 2026-09-27: 2 character sheet runs for `siuming` (小明) and `smallpig` (小朱), 2 images each on Seedream v4 (est. $0.12; 1 failed run at $0). Result: cartoon + messy layout → fixed by the per-character style + landscape sheets
  - [x] Per-character style (cartoon / realistic) + landscape sheets + markdown-safe look text; 45 tests pass (2026-09-27)
  - [x] Discard unwanted character sheets (UI: Discard in the image viewer; CLI: `--discard vN`); moved to `discarded/`, never deleted; 47 tests pass (2026-09-27)
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
- Key points for Demos B and C from partner. **Demo B draft brief** is in `docs/briefs/demo-b-oesophageal.md` (key-point options A–D; suggestion A = guaranteed renewal vs one-year plans). Waiting on partner: pick key point, confirm facts F1–F5, pick "what to say".
- `PARHELION_MONTHLY_BUDGET` is not set in `.env` (defaults to $30).
- Tracking/measurement: which channel will the broker use (WhatsApp / WeChat / LMS)? Does the insurer accept a form + QR end card, or want a hosted player? Who pays for hosting?
- Voices: which MiniMax voices suit 小王 / 张叔 / narrator (human choice)?
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
- Language: Mandarin
- Style (draft): animated skit, two recurring cartoon characters
- Characters (draft): agent 小王 (Xiao Wang), client 张叔 (Uncle Zhang) who drinks scalding tea and insists "I'm healthy, my family lives long."
- Key point: TBD by partner.

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
5. Type up the partner's Demo B inspiration as a brief (format: `docs/briefs/demo-b-oesophageal.md`), create project `demo-b`, and start the script working session.
6. After the storyboard is agreed: voice → retime → clips → Video tab → CapCut.
