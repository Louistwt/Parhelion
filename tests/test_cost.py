import pytest

from parhelion.config import Settings
from parhelion.cost import BudgetError, Ledger, PriceMissing, check_budget, confirm_spend, estimate, sync_actuals, total
from parhelion.schemas import CostEntry

PRICES = {"a/img": {"unit": "image", "unit_price": 0.03}}


def settings(run=2.0, month=30.0):
    return Settings(fal_key=None, fal_admin_key=None, max_spend_per_run=run, monthly_budget=month, currency="USD")


def test_estimate_maths():
    items = [estimate(PRICES, "S01", "a/img", 3), estimate(PRICES, "S02", "a/img", 3)]
    assert total(items) == pytest.approx(0.18)


def test_missing_price_refuses():
    with pytest.raises(PriceMissing):
        estimate(PRICES, "x", "unknown/model", 1)


def test_budget_guard():
    assert check_budget(1.0, settings(), 0) == []
    with pytest.raises(BudgetError):
        check_budget(2.5, settings(run=2.0), 0)
    with pytest.raises(BudgetError):
        check_budget(1.0, settings(month=10), 9.5)
    assert check_budget(1.0, settings(month=10), 7.5)  # 85% -> warning


def test_dry_run_never_proceeds(tmp_path):
    ledger = Ledger(tmp_path / "c.jsonl")
    assert confirm_spend([estimate(PRICES, "S01", "a/img", 1)], settings(), ledger, yes=True, dry_run=True) is False
    assert confirm_spend([estimate(PRICES, "S01", "a/img", 1)], settings(), ledger, yes=True, dry_run=False) is True


def test_ledger_month_and_sync(tmp_path):
    ledger = Ledger(tmp_path / "c.jsonl")
    ledger.append(CostEntry(project="p", stage="keyframes", provider="fal", model="a/img", units=3, est_cost_usd=0.09, request_id="r1"))
    ledger.append(CostEntry(project="p", stage="keyframes", provider="fal", model="a/img", units=0, est_cost_usd=0, request_id="r2", status="failed"))
    assert ledger.month_spend() == pytest.approx(0.09)
    n = sync_actuals(ledger, [{"request_id": "r1", "cost_total": 0.081}, {"request_id": "r2", "cost_total": 0.01}])
    assert n == 2
    assert ledger.month_spend() == pytest.approx(0.091)  # failed-but-billed counts once synced
