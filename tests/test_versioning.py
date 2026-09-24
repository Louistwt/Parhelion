from parhelion.versioning import IMAGE_EXTS, find_version, latest_path, next_path, next_version, parse_version


def test_versions_shared_across_extensions(tmp_path):
    assert next_version(tmp_path, "S01", IMAGE_EXTS) == 1
    (tmp_path / "S01_v1.png").write_bytes(b"x")
    (tmp_path / "S01_v2.jpg").write_bytes(b"x")
    (tmp_path / "S01_v2.json").write_text("{}")  # sidecars don't count
    (tmp_path / "S010_v9.png").write_bytes(b"x")  # other stem
    assert next_version(tmp_path, "S01", IMAGE_EXTS) == 3
    assert latest_path(tmp_path, "S01", IMAGE_EXTS).name == "S01_v2.jpg"
    assert find_version(tmp_path, "S01", 1, IMAGE_EXTS).name == "S01_v1.png"
    assert next_path(tmp_path, "storyboard", ".html").name == "storyboard_v1.html"


def test_parse_version():
    assert parse_version("v2") == 2 and parse_version("3") == 3
