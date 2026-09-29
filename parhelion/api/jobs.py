"""Single-worker background queue for paid runs. One paid job at a time; failures never lose work."""

from __future__ import annotations

import json
import queue
import threading
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

from ..config import Settings
from ..cost import Ledger, budget_status
from ..providers.base import ImageProvider
from ..schemas import utcnow
from ..stages.imagegen_plan import RunPlan, execute


@dataclass
class Job:
    id: str
    kind: str
    project: str
    labels: list[str]
    estimate: float
    status: str = "queued"  # queued | running | done | failed | blocked | cancelled
    stop_requested: bool = False  # Stop pressed while running: finish the request in flight, send no more
    created: str = field(default_factory=utcnow)
    finished: str | None = None
    events: list[dict] = field(default_factory=list)
    files: dict[str, list[str]] = field(default_factory=dict)
    error: str | None = None

    def public(self) -> dict:
        done = sum(1 for e in self.events if e["event"] in ("saved", "failed"))
        return {
            "id": self.id, "kind": self.kind, "project": self.project, "labels": self.labels,
            "estimate": self.estimate, "status": self.status, "created": self.created, "finished": self.finished,
            "progress": {"done": done, "total": len(self.labels)},
            "events": self.events[-200:], "files": self.files, "error": self.error, "stopping": self.stop_requested,
        }


class JobManager:
    def __init__(self, ledger: Ledger, settings_loader: Callable[[], Settings], log_path: Path):
        self.ledger = ledger
        self.settings_loader = settings_loader
        self.log_path = log_path
        self.jobs: dict[str, Job] = {}
        self.lock = threading.Lock()
        self.q: queue.Queue = queue.Queue()
        self.worker = threading.Thread(target=self._work, name="parhelion-jobs", daemon=True)
        self.worker.start()

    def submit(self, plan: RunPlan, provider_factory: Callable[[], ImageProvider], on_done: Callable[[RunPlan], None] | None = None) -> Job:
        job = Job(id=uuid.uuid4().hex[:10], kind=plan.kind, project=plan.project,
                  labels=[j.label for j in plan.jobs], estimate=sum(i.cost for i in plan.items))
        with self.lock:
            self.jobs[job.id] = job
        self.q.put((job, plan, provider_factory, on_done))
        return job

    def get(self, job_id: str) -> Job | None:
        with self.lock:
            return self.jobs.get(job_id)

    def list(self) -> list[Job]:
        with self.lock:
            return sorted(self.jobs.values(), key=lambda j: j.created, reverse=True)

    def cancel(self, job_id: str) -> Job | None:
        """Stop a job: a queued one never runs; a running one sends no further requests (the one in flight finishes)."""
        with self.lock:
            job = self.jobs.get(job_id)
            if job is None:
                return None
            if job.status == "queued":
                job.status, job.finished = "cancelled", utcnow()
            elif job.status == "running":
                job.stop_requested = True
            return job

    def busy_with(self, kind: str, project: str) -> Job | None:
        """A queued or running job of the same kind for the same project (so a double click doesn't pay twice)."""
        with self.lock:
            return next((j for j in self.jobs.values() if j.kind == kind and j.project == project
                         and j.status in ("queued", "running")), None)

    def active(self) -> bool:
        with self.lock:
            return any(j.status in ("queued", "running") for j in self.jobs.values())

    def _event(self, job: Job, event: str, message: str, data: dict) -> None:
        with self.lock:
            job.events.append({"ts": utcnow(), "event": event, "message": message, **data})
            if event == "saved":
                job.files[data["label"]] = data.get("files", [])

    def _work(self) -> None:
        while True:
            job, plan, provider_factory, on_done = self.q.get()
            if job.status == "cancelled":  # stopped while queued: nothing was sent
                self._persist(job)
                self.q.task_done()
                continue
            try:
                # Re-check the budget right before spending: queued jobs may add up.
                status = budget_status(plan.items, self.settings_loader(), self.ledger)
                if status["blocked_reason"]:
                    job.status, job.error = "blocked", status["blocked_reason"]
                    continue
                job.status = "running"
                provider = provider_factory()
                execute(plan, provider, self.ledger, on_progress=lambda e, m, d: self._event(job, e, m, d),
                        should_stop=lambda: job.stop_requested)
                if on_done:
                    on_done(plan)
                failed = sum(1 for e in job.events if e["event"] == "failed")
                if job.stop_requested:
                    job.status = "cancelled"
                else:
                    job.status = "failed" if failed == len(plan.jobs) else "done"
            except Exception as e:  # never kill the worker
                job.status, job.error = "failed", str(e)[:500]
            finally:
                job.finished = utcnow()
                self._persist(job)
                self.q.task_done()

    def _persist(self, job: Job) -> None:
        try:
            self.log_path.parent.mkdir(parents=True, exist_ok=True)
            summary = {k: v for k, v in job.public().items() if k != "events"}
            with self.log_path.open("a", encoding="utf-8") as f:
                f.write(json.dumps(summary, ensure_ascii=False) + "\n")
        except OSError:
            pass

    def wait_idle(self, timeout: float = 10) -> None:
        """Test helper."""
        import time

        end = time.monotonic() + timeout
        while self.active() and time.monotonic() < end:
            time.sleep(0.02)
