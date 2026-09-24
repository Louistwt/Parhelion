# Parhelion

Local pipeline that turns a human-written brief into a client-ready **storyboard** for short
(30–90s) vertical training videos: brief → script → timing → characters → shot list → keyframes → storyboard.

- Project rules and roles: [CLAUDE.md](CLAUDE.md)
- Current status and decisions: [STATE.md](STATE.md)
- Setup (uv, API keys, GitHub): [docs/setup.md](docs/setup.md)

```bash
uv sync && uv run pytest
uv run parhelion --help
```
