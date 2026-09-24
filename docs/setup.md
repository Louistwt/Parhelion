# Parhelion — setup guide

Everything runs locally in WSL2 (Ubuntu). Nothing here spends money.

## 1. Tools

```bash
# uv (Python package manager)
curl -LsSf https://astral.sh/uv/install.sh | sh
exec $SHELL            # reload PATH

# GitHub CLI
sudo apt update && sudo apt install gh
```

(If `apt install gh` gives an old version, use the official apt repo: https://github.com/cli/cli/blob/trunk/docs/install_linux.md)

FFmpeg is not needed until the future video/assembly stages.

## 2. Python environment

```bash
cd ~/Projects/Parhelion
uv sync                       # creates .venv and installs dependencies
uv run pytest                 # should pass
uv run parhelion --help       # or: uv run ph --help
```

## 3. API keys (`.env`)

Copy `.env.example` to `.env` if you haven't already, then fill in:

| Variable | Where | Needed for |
|---|---|---|
| `FAL_KEY` | https://fal.ai/dashboard/keys (API key) | character sheets, keyframes, `prices check` |
| `FAL_ADMIN_KEY` | same page, scope **ADMIN** | `cost sync` (actual cost), dashboard balance (`--online`) |
| `PARHELION_MAX_SPEND_PER_RUN` | you decide (suggest `2`) | blocks any single run above this (USD) |
| `PARHELION_MONTHLY_BUDGET` | you decide (suggest `30`) | warns at 80%, blocks at 100% (USD) |
| `PARHELION_CURRENCY` | `USD` or `HKD` | display only |

Add ~$5–10 credit on fal (billing page). Then check prices:

```bash
uv run parhelion prices check
```

## 4. GitHub repository (private)

The folder is already a git repository (no commits yet). `.gitignore` excludes `.env`,
`projects/`, `data/`, `output/` — media, costs and secrets never leave your machine.

```bash
gh auth login                 # GitHub.com → HTTPS → Login with a web browser
cd ~/Projects/Parhelion
git status                    # confirm .env is NOT listed
git add -A
git commit -m "Initial scaffold: script → storyboard pipeline"
gh repo create Parhelion --private --source=. --remote=origin --push
```

- If `Parhelion` is taken in your account, pick another name (`gh repo create parhelion-pipeline ...`).
- For an organisation account later: `gh repo create <org>/Parhelion --private --source=. --push`.
- Afterwards: `git push` after each commit. Claude Code only commits/pushes when you ask.

## 5. Daily loop (storyboard scope)

```bash
uv run ph new demo-b --lang mandarin --seconds 60      # then fill in brief.md with your partner
# script working session with Claude Code → script_v1.md, v2… → script.json
uv run ph lint demo-b
uv run ph timing demo-b
uv run ph character xiaowang --dry-run                  # then without --dry-run
uv run ph character xiaowang --approve v2
# Claude Code writes shotlist.json from timing.json
uv run ph lint demo-b
uv run ph keyframes demo-b --dry-run                    # then without --dry-run
uv run ph approve demo-b keyframe S01 v2
uv run ph storyboard demo-b                             # open HTML → print → Save as PDF
uv run ph cost sync && uv run ph dashboard --online     # open output/dashboard.html
```

On Windows, open generated HTML from WSL with `explorer.exe output/dashboard.html`
(or `wslview` if installed).
