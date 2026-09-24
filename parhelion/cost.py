"""Cost estimates, budget guard and the global cost ledger (data/costs.jsonl)."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import typer

from .config import Settings
from .schemas import CostEntry


class BudgetError(Exception):
    pass


class PriceMissing(Exception):
    pass


@dataclass
class EstimateItem:
    label: str
    endpoint: str
    units: float
    unit: str
    unit_price: float

    @property
    def cost(self) -> float:
        return round(self.units * self.unit_price, 4)


def unit_price(price_table: dict, endpoint: str) -> tuple[float, str]:
    entry = price_table.get(endpoint)
    if not entry or entry.get("unit_price") is None:
        raise PriceMissing(
            f"No price for {endpoint!r} in config/prices.yaml — add it before spending money."
        )
    return float(entry["unit_price"]), entry.get("unit", "image")


def estimate(price_table: dict, label: str, endpoint: str, units: float) -> EstimateItem:
    price, unit = unit_price(price_table, endpoint)
    return EstimateItem(label=label, endpoint=endpoint, units=units, unit=unit, unit_price=price)


def total(items: list[EstimateItem]) -> float:
    return round(sum(i.cost for i in items), 4)


# ---------- ledger ----------


class Ledger:
    def __init__(self, path: Path):
        self.path = path

    def append(self, entry: CostEntry) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("a", encoding="utf-8") as f:
            f.write(entry.model_dump_json() + "\n")

    def entries(self) -> list[CostEntry]:
        if not self.path.exists():
            return []
        out = []
        for raw in self.path.read_text(encoding="utf-8").splitlines():
            if raw.strip():
                out.append(CostEntry.model_validate_json(raw))
        return out

    def rewrite(self, entries: list[CostEntry]) -> None:
        tmp = self.path.with_suffix(".jsonl.tmp")
        tmp.write_text("".join(e.model_dump_json() + "\n" for e in entries), encoding="utf-8")
        tmp.replace(self.path)

    def month_spend(self, now: datetime | None = None) -> float:
        now = now or datetime.now(timezone.utc)
        prefix = now.strftime("%Y-%m")
        return round(sum(entry_cost(e) for e in self.entries() if e.ts.startswith(prefix)), 4)


def entry_cost(e: CostEntry) -> float:
    """Best known cost of a ledger entry: actual if synced, else estimate. Dry runs cost 0."""
    if e.status == "dry-run":
        return 0.0
    if e.actual_cost_usd is not None:
        return e.actual_cost_usd
    return e.est_cost_usd if e.status == "ok" else 0.0


# ---------- guard ----------


def check_budget(run_total: float, settings: Settings, month_spent: float) -> list[str]:
    """Raise BudgetError if the run must be blocked; return warnings otherwise."""
    warnings: list[str] = []
    if run_total > settings.max_spend_per_run:
        raise BudgetError(
            f"Estimated ${run_total:.2f} exceeds PARHELION_MAX_SPEND_PER_RUN=${settings.max_spend_per_run:.2f}. "
            "Split the run (e.g. --shot) or raise the limit in .env."
        )
    after = month_spent + run_total
    if after > settings.monthly_budget:
        raise BudgetError(
            f"This run would bring this month's spend to ${after:.2f}, over "
            f"PARHELION_MONTHLY_BUDGET=${settings.monthly_budget:.2f}."
        )
    if after > 0.8 * settings.monthly_budget:
        warnings.append(
            f"Warning: this month's spend will be ${after:.2f} of ${settings.monthly_budget:.2f} budget "
            f"({after / settings.monthly_budget:.0%})."
        )
    return warnings


def print_estimate(items: list[EstimateItem]) -> None:
    typer.echo("Estimated cost:")
    for i in items:
        typer.echo(f"  {i.label:<28} {i.units:>5g} {i.unit:<6} × ${i.unit_price:<7g} = ${i.cost:.3f}   [{i.endpoint}]")
    typer.echo(f"  {'TOTAL':<28} ${total(items):.3f}")


def confirm_spend(
    items: list[EstimateItem], settings: Settings, ledger: Ledger, *, yes: bool, dry_run: bool
) -> bool:
    """Print estimate, enforce budgets, ask for confirmation. Returns True if the run may proceed."""
    print_estimate(items)
    run_total = total(items)
    month_spent = ledger.month_spend()
    typer.echo(f"  Month to date: ${month_spent:.2f} of ${settings.monthly_budget:.2f}")
    try:
        for w in check_budget(run_total, settings, month_spent):
            typer.secho(w, fg="yellow")
    except BudgetError as e:
        typer.secho(f"Blocked: {e}", fg="red")
        return False
    if dry_run:
        typer.secho("Dry run — nothing was sent.", fg="cyan")
        return False
    if yes:
        return True
    return typer.confirm(f"Spend about ${run_total:.2f}?", default=False)


def sync_actuals(ledger: Ledger, events: list[dict]) -> int:
    """Fill actual_cost_usd from fal billing events (matched by request_id). Returns rows updated."""
    by_id: dict[str, float] = {}
    for ev in events:
        rid = ev.get("request_id")
        if rid and ev.get("cost_total") is not None:
            by_id[rid] = by_id.get(rid, 0.0) + float(ev["cost_total"])
    entries = ledger.entries()
    updated = 0
    for e in entries:
        if e.request_id and e.request_id in by_id and e.actual_cost_usd != by_id[e.request_id]:
            e.actual_cost_usd = round(by_id[e.request_id], 6)
            updated += 1
    if updated:
        ledger.rewrite(entries)
    return updated


def dump_events(path: Path, events: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(events, indent=2), encoding="utf-8")
