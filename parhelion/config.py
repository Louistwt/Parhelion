"""Load config files, library data and .env settings."""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import yaml
from dotenv import load_dotenv


class UserError(Exception):
    """A problem the operator can fix (bad name, missing file, unknown model). Shown as a message, not a traceback."""


def find_root(start: Path | None = None) -> Path:
    """Repo root = PARHELION_ROOT, else the nearest parent containing config/models.yaml."""
    if env := os.environ.get("PARHELION_ROOT"):
        return Path(env).resolve()
    here = (start or Path.cwd()).resolve()
    for p in [here, *here.parents]:
        if (p / "config" / "models.yaml").exists():
            return p
    return Path(__file__).resolve().parent.parent


@dataclass
class Paths:
    root: Path

    @property
    def config(self) -> Path:
        return self.root / "config"

    @property
    def library(self) -> Path:
        return self.root / "library"

    @property
    def characters(self) -> Path:
        return self.library / "characters"

    @property
    def projects(self) -> Path:
        return self.root / "projects"

    @property
    def ledger(self) -> Path:
        return self.root / "data" / "costs.jsonl"

    @property
    def output(self) -> Path:
        return self.root / "output"


@dataclass
class Settings:
    fal_key: str | None
    fal_admin_key: str | None
    max_spend_per_run: float
    monthly_budget: float
    currency: str


def _float_env(name: str, default: float) -> float:
    raw = os.environ.get(name, "").strip()
    try:
        return float(raw) if raw else default
    except ValueError:
        raise UserError(f"{name} must be a number, got {raw!r}")


def load_settings(root: Path) -> Settings:
    load_dotenv(root / ".env")
    return Settings(
        fal_key=os.environ.get("FAL_KEY") or None,
        fal_admin_key=os.environ.get("FAL_ADMIN_KEY") or None,
        max_spend_per_run=_float_env("PARHELION_MAX_SPEND_PER_RUN", 2.0),
        monthly_budget=_float_env("PARHELION_MONTHLY_BUDGET", 30.0),
        currency=(os.environ.get("PARHELION_CURRENCY") or "USD").upper(),
    )


def read_yaml(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


@lru_cache(maxsize=8)
def _cached_yaml(path_str: str, mtime: float) -> dict:
    return read_yaml(Path(path_str))


def config_yaml(root: Path, name: str) -> dict:
    path = root / "config" / name
    return _cached_yaml(str(path), path.stat().st_mtime)


def pipeline_cfg(root: Path) -> dict:
    return config_yaml(root, "pipeline.yaml")


def prices(root: Path) -> dict:
    return config_yaml(root, "prices.yaml")


def image_models(root: Path) -> list[dict]:
    return config_yaml(root, "models.yaml").get("image", [])


def image_model(root: Path, key: str | None) -> dict:
    models = image_models(root)
    if not models:
        raise UserError("No image models configured in config/models.yaml")
    if key is None:
        return models[0]
    for m in models:
        if m["key"] == key:
            return m
    raise UserError(f"Unknown model {key!r}. Options: {', '.join(m['key'] for m in models)}")


def stage_models(root: Path, kind: str) -> list[dict]:
    """Candidates for a stage: image | tts | video | lipsync. First entry is the default."""
    return config_yaml(root, "models.yaml").get(kind, [])


def stage_model(root: Path, kind: str, key: str | None) -> dict:
    models = stage_models(root, kind)
    if not models:
        raise UserError(f"No {kind} models configured in config/models.yaml")
    if key is None:
        return models[0]
    for m in models:
        if m["key"] == key:
            return m
    raise UserError(f"Unknown {kind} model {key!r}. Options: {', '.join(m['key'] for m in models)}")


def voices(root: Path) -> dict:
    path = root / "library" / "voices.yaml"
    return read_yaml(path) if path.exists() else {}


def prompt_templates(root: Path) -> dict:
    return read_yaml(root / "library" / "prompt_templates.yaml")


def banned_terms(root: Path) -> list[str]:
    path = root / "library" / "banned_terms.txt"
    if not path.exists():
        return []
    terms = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        t = raw.strip()
        if t and not t.startswith("#"):
            terms.append(t)
    return terms
