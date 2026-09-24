"""Estimate line timing from character count (no TTS yet). Deterministic.

Counting rule (documented so humans can check it by hand):
  - each CJK character = 1
  - each digit = 1 (spoken digit by digit or as a short number)
  - each Latin word = 2
  - punctuation and spaces = 0
"""

from __future__ import annotations

import re

from ..schemas import LineTiming, Script, Timing

CJK = re.compile(r"[㐀-䶿一-鿿豈-﫿\U00020000-\U0002a6df]")
DIGIT = re.compile(r"[0-9０-９]")
LATIN_WORD = re.compile(r"[A-Za-z]+")


def speech_chars(text: str) -> int:
    return len(CJK.findall(text)) + len(DIGIT.findall(text)) + 2 * len(LATIN_WORD.findall(text))


def estimate(script: Script, pipeline_cfg: dict) -> Timing:
    speech = pipeline_cfg["speech"]
    rate = float(speech["chars_per_second"][script.language])
    pause = float(speech.get("pause_between_lines", 0.3))
    min_line = float(speech.get("min_line_seconds", 1.0))

    t = 0.0
    out: list[LineTiming] = []
    for i, line in enumerate(script.lines):
        chars = speech_chars(line.text_voice)
        dur = max(min_line, chars / rate)
        start = round(t, 2)
        end = round(t + dur, 2)
        out.append(LineTiming(line_id=line.id, chars=chars, start=start, end=end))
        t = end + (pause if i < len(script.lines) - 1 else 0.0)
    return Timing(source="estimate", chars_per_second=rate, total_seconds=round(t, 2), lines=out)
