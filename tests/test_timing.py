from parhelion.schemas import Script
from parhelion.stages.timing import estimate, speech_chars

CFG = {"speech": {"chars_per_second": {"mandarin": 4.5, "cantonese": 5.0}, "pause_between_lines": 0.3, "min_line_seconds": 1.0}}


def test_speech_chars_rules():
    assert speech_chars("你好，世界！") == 4
    assert speech_chars("2026年") == 5
    assert speech_chars("买 CI 吗") == 4
    assert speech_chars("。，！？ ") == 0


def test_estimate_is_cumulative_with_pauses():
    s = Script(title="t", language="mandarin", target_seconds=10, lines=[
        {"id": "L01", "speaker": "n", "text_voice": "一二三四五六七八九"},  # 9 chars -> 2.0s
        {"id": "L02", "speaker": "n", "text_voice": "好"},  # 1 char -> min 1.0s
    ])
    t = estimate(s, CFG)
    assert t.lines[0].start == 0 and t.lines[0].end == 2.0
    assert t.lines[1].start == 2.3 and t.lines[1].end == 3.3
    assert t.total_seconds == 3.3
