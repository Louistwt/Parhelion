"""Cost dashboard: one static HTML file (output/dashboard.html). No server."""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from . import project as proj
from .config import Paths, Settings, image_model, pipeline_cfg, prices
from .cost import Ledger, PriceMissing, entry_cost, unit_price
from .schemas import CostEntry, utcnow
from .stages.storyboard import env


def money_fmt(currency: str, usd_to_hkd: float):
    def fmt(usd: float) -> str:
        if currency == "HKD":
            return f"HK${usd * usd_to_hkd:,.2f}"
        return f"${usd:,.2f}"
    return fmt


def _bars(totals: dict[str, float]) -> list[dict]:
    items = sorted(((k, v) for k, v in totals.items() if v > 0), key=lambda kv: -kv[1])
    peak = max((v for _, v in items), default=0) or 1
    return [{"label": k, "value": v, "pct": round(100 * v / peak, 1)} for k, v in items]


def _days(entries: list[CostEntry], days: int = 30, today: date | None = None) -> list[dict]:
    today = today or datetime.now(timezone.utc).date()
    totals: dict[str, float] = defaultdict(float)
    for e in entries:
        totals[e.ts[:10]] += entry_cost(e)
    out = []
    for i in range(days - 1, -1, -1):
        d = (today - timedelta(days=i)).isoformat()
        out.append({"day": d, "value": round(totals.get(d, 0.0), 4)})
    return out


def _day_svg(days: list[dict]) -> dict:
    """Geometry for a simple column chart (viewBox units)."""
    w, h, pad_l, pad_b, pad_t = 600, 160, 36, 18, 8
    peak = max((d["value"] for d in days), default=0)
    top = peak if peak > 0 else 1
    n = len(days)
    slot = (w - pad_l) / n
    bar_w = max(2.0, slot - 2)  # 2-unit surface gap between columns
    cols = []
    for i, d in enumerate(days):
        bh = (h - pad_b - pad_t) * d["value"] / top
        cols.append({
            "x": round(pad_l + i * slot + 1, 2), "y": round(h - pad_b - bh, 2),
            "w": round(bar_w, 2), "h": round(bh, 2), "day": d["day"], "value": d["value"],
        })
    return {"w": w, "h": h, "pad_l": pad_l, "pad_b": pad_b, "pad_t": pad_t, "peak": peak, "cols": cols,
            "first": days[0]["day"] if days else "", "last": days[-1]["day"] if days else ""}


def cost_to_finish(paths: Paths) -> list[dict]:
    """Forecast remaining keyframe spend per project with the default image model."""
    cfg = pipeline_cfg(paths.root)
    variants = int(cfg["keyframes"]["variants_per_shot"])
    reroll = float(cfg["keyframes"].get("reroll_factor", 1.0))
    model = image_model(paths.root, None)
    table = prices(paths.root)
    rows = []
    if not paths.projects.exists():
        return rows
    for folder in sorted(p for p in paths.projects.iterdir() if (p / "project.json").exists()):
        project = proj.load_project(folder)
        try:
            price, _ = unit_price(table, model["edit_endpoint"])
        except PriceMissing:
            price = 0.0
        if (folder / "shotlist.json").exists():
            shots = proj.load_shotlist(folder).shots
            remaining = sum(1 for s in shots if not s.approved_keyframe)
            basis = f"{remaining} of {len(shots)} shots without approved keyframe"
        else:
            remaining = max(1, round(project.target_seconds / 5))
            basis = f"no shot list yet — assumed ~{remaining} shots (5s each)"
        images = remaining * variants * reroll
        rows.append({"project": project.slug, "basis": basis, "images": round(images),
                     "model": model["key"], "est": round(images * price, 2)})
    return rows


def build_context(paths: Paths, settings: Settings, balance: tuple[float, str] | None, balance_error: str | None) -> dict:
    entries = Ledger(paths.ledger).entries()
    now = datetime.now(timezone.utc)
    month = now.strftime("%Y-%m")
    real = [e for e in entries if e.status != "dry-run"]

    month_spend = sum(entry_cost(e) for e in real if e.ts.startswith(month))
    all_time = sum(entry_cost(e) for e in real)
    by_project, by_stage, by_model = defaultdict(float), defaultdict(float), defaultdict(float)
    est_vs_actual: dict[str, dict] = defaultdict(lambda: {"est": 0.0, "actual": 0.0, "n": 0})
    for e in real:
        c = entry_cost(e)
        by_project[e.project] += c
        by_stage[e.stage] += c
        by_model[e.model] += c
        if e.actual_cost_usd is not None:
            row = est_vs_actual[e.model]
            row["est"] += e.est_cost_usd
            row["actual"] += e.actual_cost_usd
            row["n"] += 1
    synced = sum(1 for e in real if e.actual_cost_usd is not None and e.status == "ok")
    ok = sum(1 for e in real if e.status == "ok")
    failed = sum(1 for e in real if e.status == "failed")
    images = sum(e.units for e in real if e.status == "ok")

    cfg = pipeline_cfg(paths.root)
    fmt = money_fmt(settings.currency, float(cfg["report"]["usd_to_hkd"]))
    budget_pct = (month_spend / settings.monthly_budget * 100) if settings.monthly_budget else 0
    budget_state = "over" if budget_pct >= 100 else "near" if budget_pct >= 80 else "ok"

    return {
        "generated": utcnow(), "currency": settings.currency, "fmt": fmt, "month": month,
        "month_spend": month_spend, "budget": settings.monthly_budget, "budget_pct": budget_pct,
        "budget_state": budget_state, "per_run": settings.max_spend_per_run,
        "all_time": all_time, "images": int(images), "ok": ok, "failed": failed, "synced": synced,
        "balance": balance, "balance_error": balance_error,
        "days": _day_svg(_days(real)),
        "by_project": _bars(by_project), "by_stage": _bars(by_stage), "by_model": _bars(by_model),
        "est_vs_actual": sorted(est_vs_actual.items()),
        "finish": cost_to_finish(paths),
        "recent": list(reversed(entries[-50:])),
        "entry_cost": entry_cost,
    }


def render(paths: Paths, settings: Settings, balance=None, balance_error=None) -> Path:
    html = env().get_template("dashboard.html.j2").render(**build_context(paths, settings, balance, balance_error))
    out = paths.output / "dashboard.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    return out
