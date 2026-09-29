"""Paid audio/video jobs (speech, image-to-video, lip-sync): same ledger, versioning and sidecars as images."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

from ..config import UserError
from ..cost import EstimateItem, Ledger
from ..providers.base import MediaProvider, ProviderError
from ..schemas import CostEntry, utcnow
from ..versioning import next_version
from .imagegen import Progress, _noop


@dataclass
class MediaJob:
    label: str  # e.g. "L03 voice", "S04 clip"
    out_dir: Path
    stem: str  # e.g. "L03", "S04", "S04_lipsync"
    endpoint: str
    model_key: str
    payload: dict
    expect: str  # response field: "audio" | "video"
    ext: str  # ".mp3" | ".mp4"
    units: float  # in the price's billing unit
    unit: str
    unit_price: float
    files: dict[str, Path] = field(default_factory=dict)  # payload field -> local file to upload
    meta: dict = field(default_factory=dict)  # stored in the sidecar (line_id, shot_id, durations…)
    prepare: Callable[[], dict[str, Path]] | None = None  # builds input files at run time (keeps planning side-effect free)
    minimum: float = 0.0  # per-request minimum charge (prices.yaml `minimum_per_request`)

    @property
    def estimate(self) -> EstimateItem:
        return EstimateItem(self.label, self.endpoint, round(self.units, 4), self.unit, self.unit_price, self.minimum)

    def execute(self, provider, ledger: Ledger, *, project: str, stage: str, on_progress: Progress = _noop) -> list[Path]:
        """Run one request. Never raises on provider failure: logs it and returns []."""
        on_progress("start", f"{self.label}: generating", {"label": self.label})
        if not isinstance(provider, MediaProvider):
            raise TypeError("provider does not support audio/video jobs")
        try:
            if self.prepare is not None:
                self.files = {**self.files, **self.prepare()}
            result = provider.run_media(self.endpoint, self.payload, self.files, self.expect)
        except (ProviderError, UserError) as e:
            ledger.append(CostEntry(project=project, stage=stage, provider=provider.name, model=self.endpoint,
                                    units=0, unit=self.unit, est_cost_usd=0.0, request_id=getattr(e, "request_id", None),
                                    status="failed", note=str(e)[:500]))
            on_progress("failed", f"{self.label}: FAILED — {e}", {"label": self.label, "error": str(e)})
            return []
        ledger.append(CostEntry(project=project, stage=stage, provider=provider.name, model=result.endpoint,
                                units=round(self.units, 4), unit=self.unit, est_cost_usd=self.estimate.cost,
                                request_id=result.request_id))
        self.out_dir.mkdir(parents=True, exist_ok=True)
        saved: list[Path] = []
        for out in result.outputs:
            ext = out.ext if out.ext in (".mp3", ".wav", ".flac", ".mp4", ".mov", ".webm", ".m4a") else self.ext
            v = next_version(self.out_dir, self.stem, (ext,) if ext == self.ext else (ext, self.ext))
            path = self.out_dir / f"{self.stem}_v{v}{ext}"
            path.write_bytes(out.data)
            sidecar = {
                "file": path.name, "created": utcnow(), "stage": stage, "project": project, "provider": provider.name,
                "model_key": self.model_key, "endpoint": result.endpoint, "request_id": result.request_id,
                "request": result.request_payload, "response_meta": result.raw_response,
                "est_cost_usd": self.estimate.cost, **self.meta,
            }
            path.with_suffix(".json").write_text(json.dumps(sidecar, ensure_ascii=False, indent=2), encoding="utf-8")
            saved.append(path)
        on_progress("saved", f"{self.label}: saved {', '.join(p.name for p in saved)}",
                    {"label": self.label, "files": [p.name for p in saved]})
        return saved
