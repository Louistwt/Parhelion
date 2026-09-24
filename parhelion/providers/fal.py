"""fal.ai queue API client (image models) and platform API (billing, pricing).

Verified 2026-09-24 against fal docs:
  submit  POST https://queue.fal.run/{endpoint}         -> request_id, status_url, response_url
  status  GET  status_url                                -> IN_QUEUE | IN_PROGRESS | COMPLETED
  result  GET  response_url                              -> {"images": [{"url": ...}], "seed": ...}
  billing GET  https://api.fal.ai/v1/account/billing?expand=credits   (ADMIN key)
  events  GET  https://api.fal.ai/v1/models/billing-events            (ADMIN key)
  pricing GET  https://api.fal.ai/v1/models/pricing?endpoint_id=...
Auth header: "Authorization: Key <key>".
"""

from __future__ import annotations

import base64
import io
import time
from pathlib import Path

import httpx
from PIL import Image

from .base import GeneratedImage, ImageJob, ImageProvider, ImageResult, ProviderError

QUEUE_URL = "https://queue.fal.run"
API_URL = "https://api.fal.ai/v1"

RETRY_STATUS = {429, 500, 502, 503, 504}


def _auth(key: str) -> dict:
    return {"Authorization": f"Key {key}"}


def reference_data_uri(path: Path, max_side: int = 1536) -> str:
    """Send local reference images inline as a compact JPEG data URI."""
    with Image.open(path) as im:
        im = im.convert("RGB")
        im.thumbnail((max_side, max_side))
        buf = io.BytesIO()
        im.save(buf, format="JPEG", quality=90)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def _ext_from(content_type: str | None, url: str) -> str:
    ct = (content_type or "").lower()
    if "jpeg" in ct or "jpg" in ct or url.lower().endswith((".jpg", ".jpeg")):
        return ".jpg"
    if "webp" in ct or url.lower().endswith(".webp"):
        return ".webp"
    return ".png"


class FalImageProvider(ImageProvider):
    name = "fal"

    def __init__(
        self,
        key: str,
        *,
        timeout_s: float = 600,
        poll_interval_s: float = 2.0,
        retries: int = 3,
        client: httpx.Client | None = None,
    ):
        if not key:
            raise ProviderError("FAL_KEY is not set in .env")
        self.key = key
        self.timeout_s = timeout_s
        self.poll_interval_s = poll_interval_s
        self.retries = retries
        self.client = client or httpx.Client(timeout=60)

    # -- http helpers --

    def _get(self, url: str) -> httpx.Response:
        """GET with retries on transport errors and transient status codes."""
        last: Exception | None = None
        for attempt in range(self.retries + 1):
            try:
                r = self.client.get(url, headers=_auth(self.key))
                if r.status_code not in RETRY_STATUS:
                    return r
                last = ProviderError(f"HTTP {r.status_code}: {r.text[:300]}")
            except httpx.TransportError as e:
                last = e
            time.sleep(min(2**attempt, 15))
        raise ProviderError(f"GET {url} failed after retries: {last}")

    def _submit(self, endpoint: str, payload: dict) -> dict:
        """POST once; retry only when the request surely did not start (connect error / 429)."""
        last: Exception | None = None
        for attempt in range(self.retries + 1):
            try:
                r = self.client.post(f"{QUEUE_URL}/{endpoint}", headers=_auth(self.key), json=payload)
            except (httpx.ConnectError, httpx.ConnectTimeout) as e:
                last = e
                time.sleep(min(2**attempt, 15))
                continue
            if r.status_code == 429:
                last = ProviderError("rate limited (429)")
                time.sleep(min(2**attempt, 15))
                continue
            if r.status_code >= 400:
                raise ProviderError(f"Submit to {endpoint} failed: HTTP {r.status_code}: {r.text[:500]}")
            return r.json()
        raise ProviderError(f"Submit to {endpoint} failed after retries: {last}")

    # -- main --

    def generate(self, job: ImageJob, endpoint: str) -> ImageResult:
        payload: dict = {"prompt": job.prompt, **job.params, "num_images": job.num_images}
        if job.seed is not None:
            payload["seed"] = job.seed
        if job.reference_images:
            payload["image_urls"] = [reference_data_uri(p) for p in job.reference_images]

        sub = self._submit(endpoint, payload)
        request_id = sub.get("request_id")
        status_url = sub.get("status_url") or f"{QUEUE_URL}/{endpoint}/requests/{request_id}/status"
        response_url = sub.get("response_url") or f"{QUEUE_URL}/{endpoint}/requests/{request_id}"

        deadline = time.monotonic() + self.timeout_s
        while True:
            st = self._get(status_url)
            if st.status_code >= 400:
                raise ProviderError(f"Status check failed: HTTP {st.status_code}: {st.text[:300]}", request_id)
            status = st.json().get("status")
            if status == "COMPLETED":
                break
            if time.monotonic() > deadline:
                raise ProviderError(f"Timed out after {self.timeout_s:.0f}s (status {status})", request_id)
            time.sleep(self.poll_interval_s)

        res = self._get(response_url)
        if res.status_code >= 400:
            raise ProviderError(f"Job failed: HTTP {res.status_code}: {res.text[:500]}", request_id)
        body = res.json()

        images: list[GeneratedImage] = []
        for img in body.get("images", []):
            url = img.get("url", "")
            if url.startswith("data:"):
                header, b64 = url.split(",", 1)
                images.append(GeneratedImage(base64.b64decode(b64), _ext_from(header, "")))
            else:
                dl = self._get(url)
                if dl.status_code >= 400:
                    raise ProviderError(f"Download failed: HTTP {dl.status_code}", request_id)
                images.append(GeneratedImage(dl.content, _ext_from(img.get("content_type") or dl.headers.get("content-type"), url)))
        if not images:
            raise ProviderError(f"No images in response: {str(body)[:300]}", request_id)

        sent = dict(payload)
        if "image_urls" in sent:
            sent["image_urls"] = [str(p) for p in job.reference_images]  # don't store base64 blobs
        return ImageResult(
            request_id=request_id,
            endpoint=endpoint,
            images=images,
            seed=body.get("seed", job.seed),
            request_payload=sent,
            raw_response={k: v for k, v in body.items() if k != "images"},
        )


class FalPlatform:
    """Account-level APIs. Billing endpoints need an ADMIN key (FAL_ADMIN_KEY)."""

    def __init__(self, key: str, client: httpx.Client | None = None):
        self.key = key
        self.client = client or httpx.Client(timeout=30)

    def _get(self, path: str, params: dict | list | None = None) -> dict:
        r = self.client.get(f"{API_URL}{path}", headers=_auth(self.key), params=params)
        if r.status_code >= 400:
            raise ProviderError(f"GET {path}: HTTP {r.status_code}: {r.text[:300]}")
        return r.json()

    def balance(self) -> tuple[float, str]:
        body = self._get("/account/billing", {"expand": "credits"})
        credits = body.get("credits") or {}
        return float(credits.get("current_balance", 0.0)), credits.get("currency", "USD")

    def billing_events(self, start: str, end: str | None = None) -> list[dict]:
        events: list[dict] = []
        params: dict = {"start": start, "limit": 1000}
        if end:
            params["end"] = end
        while True:
            body = self._get("/models/billing-events", params)
            events.extend(body.get("billing_events", []))
            if not body.get("has_more") or not body.get("next_cursor"):
                return events
            params["cursor"] = body["next_cursor"]

    def pricing(self, endpoint_ids: list[str]) -> list[dict]:
        if not endpoint_ids:
            return []
        body = self._get("/models/pricing", [("endpoint_id", e) for e in endpoint_ids])
        return body.get("prices", [])
