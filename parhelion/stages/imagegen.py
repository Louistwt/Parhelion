"""Shared runner for paid image jobs: call provider, save versioned files + sidecars, log cost."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import typer

from ..cost import Ledger
from ..providers.base import ImageJob, ImageProvider, ProviderError
from ..schemas import CostEntry, utcnow
from ..versioning import IMAGE_EXTS, next_version


@dataclass
class PlannedJob:
    label: str  # e.g. "S03" or "sheet"
    out_dir: Path
    stem: str  # file stem, versions appended
    endpoint: str
    model_key: str
    job: ImageJob
    unit_price: float


def run(planned: PlannedJob, provider: ImageProvider, ledger: Ledger, *, project: str, stage: str) -> list[Path]:
    """Run one request. Never raises on provider failure: logs it and returns []."""
    try:
        result = provider.generate(planned.job, planned.endpoint)
    except ProviderError as e:
        ledger.append(
            CostEntry(
                project=project, stage=stage, provider=provider.name, model=planned.endpoint,
                units=0, est_cost_usd=0.0, request_id=e.request_id, status="failed", note=str(e)[:500],
            )
        )
        typer.secho(f"  {planned.label}: FAILED — {e}", fg="red")
        return []

    n = len(result.images)
    ledger.append(
        CostEntry(
            project=project, stage=stage, provider=provider.name, model=result.endpoint,
            units=n, est_cost_usd=round(n * planned.unit_price, 4), request_id=result.request_id,
        )
    )
    planned.out_dir.mkdir(parents=True, exist_ok=True)
    saved: list[Path] = []
    for idx, img in enumerate(result.images):
        v = next_version(planned.out_dir, planned.stem, IMAGE_EXTS)
        path = planned.out_dir / f"{planned.stem}_v{v}{img.ext}"
        path.write_bytes(img.data)
        sidecar = {
            "file": path.name,
            "created": utcnow(),
            "stage": stage,
            "project": project,
            "provider": provider.name,
            "model_key": planned.model_key,
            "endpoint": result.endpoint,
            "request_id": result.request_id,
            "index_in_request": idx,
            "seed": result.seed,
            "prompt": planned.job.prompt,
            "reference_images": [str(p) for p in planned.job.reference_images],
            "request": result.request_payload,
            "response_meta": result.raw_response,
            "est_cost_usd": planned.unit_price,
        }
        path.with_suffix(".json").write_text(json.dumps(sidecar, ensure_ascii=False, indent=2), encoding="utf-8")
        saved.append(path)
    typer.secho(f"  {planned.label}: saved {', '.join(p.name for p in saved)}", fg="green")
    return saved
