"""A paid run = a list of planned requests + notes. Built without side effects, executed later."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

from ..cost import EstimateItem, Ledger
from ..providers.base import ImageProvider
from .imagegen import PlannedJob, Progress, _noop
from .mediagen import MediaJob


@dataclass
class RunPlan:
    kind: str  # "keyframes" | "character" | "voice" | "voice_preview" | "clips" | "lipsync"
    project: str  # project slug or "library"
    stage: str
    jobs: list[PlannedJob | MediaJob]
    notes: list[str] = field(default_factory=list)
    folder: Path | None = None  # project folder (keyframes only)

    @property
    def items(self) -> list[EstimateItem]:
        return [j.estimate for j in self.jobs]


def execute(
    plan: RunPlan, provider: ImageProvider, ledger: Ledger, on_progress: Progress = _noop,
    should_stop: Callable[[], bool] | None = None,
) -> dict[str, list[Path]]:
    """Run every planned request in order. Failures are logged and skipped, never raised. `should_stop` is checked
    before each request (a request already sent to the provider can't be recalled)."""
    results: dict[str, list[Path]] = {}
    for job in plan.jobs:
        if should_stop is not None and should_stop():
            on_progress("cancelled", f"{job.label}: not sent — job stopped", {"label": job.label})
            continue
        results[job.label] = job.execute(provider, ledger, project=plan.project, stage=plan.stage, on_progress=on_progress)
    return results
