import json
import shutil
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parent.parent


@pytest.fixture
def root(tmp_path, monkeypatch):
    """A throwaway repo root with the real config + library, and one sample project."""
    shutil.copytree(REPO / "config", tmp_path / "config")
    # real library, minus the operator's own characters (tests must not depend on them)
    shutil.copytree(REPO / "library", tmp_path / "library", ignore=lambda d, names: [
        n for n in names if Path(d) == REPO / "library" / "characters" and not n.startswith(("_", "."))
    ])
    char = tmp_path / "library" / "characters" / "xiaowang"
    char.mkdir(parents=True)
    (char / "character.yaml").write_text(
        "name: xiaowang\ndisplay_name: 小王\nprompt_block: young agent, navy suit\napproved_sheets: []\n"
        "voice: {voice_id: 'Chinese (Mandarin)_Gentle_Youth', speed: 1.0, pitch: 0}\n", encoding="utf-8"
    )
    folder = tmp_path / "projects" / "2026-09-24-demo"
    (folder / "keyframes").mkdir(parents=True)
    (folder / "output").mkdir()
    (folder / "project.json").write_text(json.dumps({"slug": "demo", "language": "mandarin", "target_seconds": 10}))
    (folder / "script.json").write_text(json.dumps(SCRIPT, ensure_ascii=False), encoding="utf-8")
    (folder / "shotlist.json").write_text(json.dumps(SHOTLIST, ensure_ascii=False), encoding="utf-8")
    monkeypatch.setenv("PARHELION_ROOT", str(tmp_path))
    for var in ("FAL_KEY", "FAL_ADMIN_KEY", "PARHELION_MAX_SPEND_PER_RUN", "PARHELION_MONTHLY_BUDGET", "PARHELION_CURRENCY"):
        monkeypatch.delenv(var, raising=False)
    return tmp_path


SCRIPT = {
    "title": "测试",
    "language": "mandarin",
    "target_seconds": 10,
    "characters": ["xiaowang"],
    "beats": [{"name": "hook", "line_ids": ["L01"]}, {"name": "close", "line_ids": ["L02"]}],
    "lines": [
        {"id": "L01", "speaker": "xiaowang", "text_voice": "你买保险了吗？", "text_subtitle": ""},
        {"id": "L02", "speaker": "narrator", "text_voice": "香港和内地的保障不一样，要看清楚条款。", "text_subtitle": ""},
    ],
    "claims": [{"id": "C01", "text": "coverage differs", "line_ids": ["L02"], "status": "unverified"}],
}

SHOTLIST = {
    "shots": [
        {"id": "S01", "start": 0.0, "end": 4.0, "line_ids": ["L01"], "framing": "medium",
         "characters": ["xiaowang"], "setting": "office", "action": "xiaowang smiles at camera"},
        {"id": "S02", "start": 4.0, "end": 8.5, "line_ids": ["L02"], "framing": "insert",
         "characters": [], "props": ["policy booklet"], "setting": "desk", "action": "booklet on a desk"},
    ]
}
