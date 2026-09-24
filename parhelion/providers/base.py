"""Provider interfaces. Stages depend on these, never on a concrete vendor."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path


class ProviderError(Exception):
    """A paid job failed. `request_id` is kept so billing can still be reconciled."""

    def __init__(self, message: str, request_id: str | None = None):
        super().__init__(message)
        self.request_id = request_id


@dataclass
class ImageJob:
    prompt: str
    num_images: int = 1
    reference_images: list[Path] = field(default_factory=list)
    seed: int | None = None
    params: dict = field(default_factory=dict)


@dataclass
class GeneratedImage:
    data: bytes
    ext: str  # ".png" / ".jpg" / ".webp"


@dataclass
class ImageResult:
    request_id: str
    endpoint: str
    images: list[GeneratedImage]
    seed: int | None
    request_payload: dict  # exactly what was sent (reference images summarised)
    raw_response: dict


class ImageProvider(ABC):
    name: str

    @abstractmethod
    def generate(self, job: ImageJob, endpoint: str) -> ImageResult: ...


# Future stages (not built in storyboard scope):
# class TTSProvider(ABC): ...
# class VideoProvider(ABC): ...
# class LipSyncProvider(ABC): ...
