# Parhelion — STATE

Living document. Claude Code updates this at the end of every session.

_Last updated: 2026-09-24_

## Current phase

**Phase 0: setup plus image-provider smoke test (storyboard scope).** The scaffold is built. The smoke test has not been run.

## Decisions made

- **Name: Parhelion** (renamed from Mirage on 2026-09-24 because Mirage is used by existing companies).
- Local pipeline. No web server, database or hosting. Reports (storyboard, cost dashboard) are static HTML files.
- **Scope is storyboard only** for now: brief → script → timing → characters → shot list → keyframes → storyboard. Voice, video, lip-sync and assembly are future stages.
- **The script is a human + AI discussion.** Claude proposes, drafts and checks; humans decide content, tone and creative choices. Humour is optional and set per video. AI does not judge subjective quality.
- **Timing is estimated** from character count until TTS exists (Mandarin 4.5 chars/s, Cantonese 5.0, set in `config/pipeline.yaml`).
- **Models are undecided.** `config/models.yaml` lists candidates (first = default). They will be chosen by a smoke-test comparison.
- **fal.ai is the first provider**: one key, pay per successful output, billing events API for actual spend, pricing API for price checks.
- The pipeline never calls an LLM API. Claude Code does the LLM work in files.
- Stack: Python 3.11+, uv, Typer, Pydantic, httpx, PyYAML, Jinja2, Pillow.
- The cost ledger is global, `data/costs.jsonl`, and the dashboard is `output/dashboard.html`.

## Roadmap

- [ ] **Phase 0: setup and smoke test**
  - [x] Docs rewritten for storyboard scope and the Parhelion name
  - [x] Scaffold: pyproject, config, schemas, cost guard + ledger, fal provider, lint, timing, keyframes, storyboard, dashboard, tests
  - [x] Tests pass (18, run 2026-09-24 in a temporary venv); CLI checked end to end on a sample project
  - [ ] Install `uv`, then `uv sync && uv run pytest` on your machine
  - [x] Folder moved to `~/Projects/Parhelion`
  - [ ] GitHub private repo created (see `docs/setup.md`)
  - [ ] fal account with $5–10 credit; `FAL_KEY` (and optional `FAL_ADMIN_KEY`) in `.env`
  - [ ] `parhelion prices check`: confirm the prices in `config/prices.yaml`
  - [ ] Smoke test (≈ $0.25, confirm first): 1 test character, 3 candidate models × 2 images, then 1 keyframe using the sheet as reference
  - [ ] `parhelion cost sync` and check that the dashboard matches the fal console
- [ ] **Phase 1: Demo B storyboard**: brief → script discussion → fact-check → characters → shot list → keyframes → storyboard
- [ ] **Phase 2: storyboards for Demos A and C**
- [ ] **Phase 3: client discussion and quote** (to be drafted together; you'll explain the business situation first)
- [ ] **Phase 4+ (future):** voice (TTS), image-to-video, lip-sync, assembly, CapCut hand-off

## Candidate tools (unverified until smoke test)

| Need | Candidate | Price read 2026-09-23 | Notes |
|---|---|---|---|
| Keyframes / character sheets | fal `fal-ai/bytedance/seedream/v4/edit` (+ `/text-to-image`) | $0.03/image | Up to 10 reference images. Seedream 5.0 also exists on fal; check it. |
| | fal `fal-ai/nano-banana/edit` (+ `fal-ai/nano-banana`) | $0.0398/image | `aspect_ratio` "9:16". Nano Banana 2 / Pro also exist. |
| | fal FLUX Kontext Pro | $0.04/image | Endpoint id not yet verified |
| | Gemini API direct `gemini-3.1-flash-lite-image` | ~$0.034/image (1K) | Only if fal models aren't good enough |
| | Local ComfyUI on RTX 4060 (8 GB) | $0 | Possible draft provider later |
| TTS (future) | Azure Speech neural (zh-CN, zh-HK) | Free F0: 0.5M chars/month | Covers hundreds of videos free |
| | MiniMax Speech HD / Turbo | ~$100 / $60 per 1M chars | Cantonese supported |
| Image-to-video (future) | Kling 2.5 Turbo Pro on fal | $0.07/s | |
| | Veo 3 on fal | $0.40/s | Premium tier |

A 60s storyboard is estimated at about 50 images ≈ $1.5–2.0.

## Verified model facts

_(model id, provider, key params, price, date verified, source URL)_

- 2026-09-24, fal queue API: `POST https://queue.fal.run/{endpoint_id}` with header `Authorization: Key $FAL_KEY`. The response includes `request_id`, `status_url` and `response_url`. Statuses are `IN_QUEUE`, `IN_PROGRESS` and `COMPLETED`. Source: fal.ai/docs/model-apis/model-endpoints/queue
- 2026-09-24, fal billing: `GET https://api.fal.ai/v1/account/billing?expand=credits` returns `credits.current_balance`. `GET https://api.fal.ai/v1/models/billing-events` (params `start`, `end`, `request_id`, `cursor`, `limit`) returns `billing_events[].cost_total`. Both **need an ADMIN API key**. Source: fal.ai/docs/platform-apis/v1/…
- 2026-09-24, fal pricing: `GET https://api.fal.ai/v1/models/pricing?endpoint_id=…` returns `prices[].unit_price` and `unit`.
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

- none yet

## Open questions

- Which image model keeps our characters most consistent (Seedream vs Nano Banana vs Kontext vs newer versions)?
- Is a local ComfyUI draft mode on the RTX 4060 worth setting up?
- Budget numbers: `PARHELION_MAX_SPEND_PER_RUN` (suggested $2) and `PARHELION_MONTHLY_BUDGET` (suggested $30).
- Display currency: USD only, or USD + HKD?
- Client quote: pending your explanation of the business situation.
- Demo A (partner's AI twin): tool, consent and likeness terms. Out of storyboard scope for now.
- Key points for Demos B and C from partner.
- Background music/SFX licensing (future).

## Demo videos

All: 60–90s target (30s acceptable for early tests), 9:16, one key HK vs mainland point each unless the brief says otherwise. All medical/insurance facts must be verified by partner. **Concepts below are drafts to discuss, not fixed.**

**Demo A: Thyroid cancer**
- Language: Mandarin
- Style (draft): partner's AI twin (avatar tool, decided later; outside the storyboard pipeline)
- Concept (draft): a veteran responds to a rookie who told a client "thyroid cancer is a small illness, don't worry."
- Key point (to verify): how early-stage thyroid cancer is classified/paid under mainland standardised CI definitions vs typical HK cover.

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

1. Install `uv`, then `uv sync && uv run pytest` (see `docs/setup.md`).
2. Reopen Claude Code in `~/Projects/Parhelion`. Create the GitHub repo (see `docs/setup.md`).
3. Create a fal account, add credit, put the keys in `.env`, and run `parhelion prices check`.
4. Run the smoke test (confirm cost first).
5. Write `brief.md` for Demo B together, then start the script working session.
