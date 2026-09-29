"""Character reference sheets, stored in library/characters/<name>/ and reused across videos."""

from __future__ import annotations

import base64
import binascii
import io
import json
from pathlib import Path

from PIL import Image, UnidentifiedImageError

from ..config import Paths, UserError, image_model, prices, prompt_templates
from ..cost import unit_price
from ..providers.base import ImageJob
from ..schemas import DEFAULT_LOOK, Character, utcnow
from ..versioning import IMAGE_EXTS, all_paths, discard as discard_file, find_version, next_version
from .imagegen import PlannedJob
from .imagegen_plan import RunPlan
from .prompts import (
    approved_sheet_paths, character_dir, compose_character_prompt, compose_face_prompt, load_character, save_character,
    with_look,
)


def sheet_params(model: dict) -> dict:
    """Sheets are three full-body views in a row, so they use the model's landscape `sheet_params` (models.yaml)."""
    return {**model.get("params", {}), **model.get("sheet_params", {})}


def _is_default(look: str | None) -> bool:
    return not look or look == DEFAULT_LOOK


def refine_refs(paths: Paths, base: Character, look: str | None) -> list:
    """References for "refine from approved sheets". The default look sends all its approved sheets. Another look sends
    the face reference plus that look's own sheets; a new look with no sheets yet falls back to the default look's
    sheets (the prompt says to keep the face and ignore the reference's clothes)."""
    if _is_default(look):
        return approved_sheet_paths(paths, base)
    char = with_look(base, look)  # face_ref is None when the look opts out of the face photo
    face = char.face_ref
    if char.approved_sheets:
        sheets = char.approved_sheets
    elif face or char.style != base.style:  # never pull a different-style look towards the main look's sheets
        sheets = []
    else:
        sheets = base.approved_sheets
    names = ([face] if face else []) + [s for s in sheets if s != face]
    return [character_dir(paths, base.name) / s for s in names]


def face_refs(paths: Paths, base: Character) -> list:
    return [character_dir(paths, base.name) / base.face_ref] if base.face_ref else []


def face_params(model: dict) -> dict:
    """Face portraits are square (models.yaml `face_params`)."""
    return {**model.get("params", {}), **model.get("face_params", {})}


def face_job(paths: Paths, name: str, model: dict, seed: int | None = None) -> PlannedJob:
    """One close-up portrait from the described face; once saved it becomes the character's face reference."""
    char = with_look(load_character(paths, name), None)
    endpoint = model["text_endpoint"]
    price, unit = unit_price(prices(paths.root), endpoint)

    def set_face(saved: list) -> None:
        c = load_character(paths, name)
        c.face_ref = saved[0].name
        save_character(paths, c)

    return PlannedJob(
        label=f"{name} face", out_dir=character_dir(paths, name), stem="sheet", endpoint=endpoint,
        model_key=model["key"], unit_price=price, unit=unit,
        job=ImageJob(prompt=compose_face_prompt(prompt_templates(paths.root), char), num_images=1,
                     reference_images=[], seed=seed, params=face_params(model)),
        meta={"kind": "face"}, on_saved=set_face,
    )


def build(
    paths: Paths, name: str, *, n: int, model_key: str | None, use_approved: bool = False, seed: int | None = None,
    look: str | None = None, face_first: bool = False, face_only: bool = False,
) -> RunPlan:
    """Plan a sheet run for one look (default: the main look). With face_first, a face portrait is generated first
    and the sheet then uses it as its face reference (two requests, run in order). No side effects, no spend."""
    base = load_character(paths, name)
    char = with_look(base, look)
    model = image_model(paths.root, model_key)
    if face_only:  # just the face portrait (becomes the face reference once saved)
        notes = [] if model.get("verified") else [f"Model {model['key']!r} is marked unverified in config/models.yaml."]
        return RunPlan(kind="character", project="library", stage="character", jobs=[face_job(paths, name, model, seed)], notes=notes)
    # The face photo is the person: it is sent on every run, refine or not (without it the model invents a face).
    # A look can opt out (a different-style look, e.g. a cartoon version, should not get the real photo).
    if use_approved:
        refs = refine_refs(paths, base, look)
    else:
        refs = face_refs(paths, char)
    endpoint = model["edit_endpoint"] if (refs or face_first) else model["text_endpoint"]
    price, unit = unit_price(prices(paths.root), endpoint)
    named = not _is_default(look)
    job = PlannedJob(
        label=f"{name} ({look}) sheet" if named else f"{name} sheet", out_dir=character_dir(paths, name), stem="sheet",
        endpoint=endpoint, model_key=model["key"], unit_price=price, unit=unit,
        job=ImageJob(prompt=compose_character_prompt(prompt_templates(paths.root), char, with_reference=bool(refs)), num_images=n,
                     reference_images=refs, seed=seed, params=sheet_params(model)),
        meta={"look": look} if named else {},
    )
    jobs = [job]
    if face_first:
        def use_face(j: PlannedJob) -> bool:
            c = load_character(paths, name)
            if not c.face_ref:
                return False
            j.job.reference_images = [character_dir(paths, name) / c.face_ref]
            j.job.prompt = compose_character_prompt(prompt_templates(paths.root), char, with_reference=True)
            return True

        job.prepare = use_face
        jobs = [face_job(paths, name, model, seed), job]
    notes = []
    if not model.get("verified"):
        notes.append(f"Model {model['key']!r} is marked unverified in config/models.yaml.")
    if not refs and not face_first:
        notes.append("No reference image: the model will invent this person's face (text only). "
                     "Upload a face photo, or tick refine to use approved sheets.")
    return RunPlan(kind="character", project="library", stage="character", jobs=jobs, notes=notes)


MAX_PHOTO_BYTES = 15 * 1024 * 1024
_KEEP_FORMATS = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp"}


def add_photo(paths: Paths, name: str, filename: str, data_b64: str) -> str:
    """Save an uploaded photo of the real person as the next sheet_vN and make it the face reference. The caller has
    confirmed consent; it is recorded in the sidecar and in description.md. Returns the file name."""
    char = load_character(paths, name)
    try:
        raw = base64.b64decode(data_b64.split(",", 1)[-1] if data_b64.startswith("data:") else data_b64, validate=True)
    except (binascii.Error, ValueError) as e:
        raise UserError("The photo could not be read (bad upload)") from e
    if len(raw) > MAX_PHOTO_BYTES:
        raise UserError(f"The photo is larger than {MAX_PHOTO_BYTES // (1024 * 1024)} MB")
    try:
        img = Image.open(io.BytesIO(raw))
        img.load()
    except (UnidentifiedImageError, OSError) as e:
        raise UserError(f"{filename} is not an image Parhelion can read (use JPEG, PNG or WebP)") from e
    d = character_dir(paths, name)
    ext = _KEEP_FORMATS.get(img.format or "")
    if ext is None:  # e.g. HEIC/BMP/TIFF: store as JPEG so every model accepts it
        ext, buf = ".jpg", io.BytesIO()
        img.convert("RGB").save(buf, format="JPEG", quality=92)
        raw = buf.getvalue()
    path = d / f"sheet_v{next_version(d, 'sheet', IMAGE_EXTS)}{ext}"
    path.write_bytes(raw)
    now = utcnow()
    path.with_suffix(".json").write_text(json.dumps({
        "file": path.name, "created": now, "source": "upload", "original_name": Path(filename).name,
        "consent_confirmed": True, "size": [img.width, img.height],
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    char.face_ref = path.name
    save_character(paths, char)
    desc = d / "description.md"
    note = (f"\n- {now[:10]}: `{path.name}` uploaded as the face reference (from `{Path(filename).name}`); the operator "
            "confirmed the person agreed to their likeness being used in these videos.\n")
    desc.write_text((desc.read_text(encoding="utf-8") if desc.exists() else f"# {char.display_name or name}\n") + note,
                    encoding="utf-8")
    return path.name


def sheets(paths: Paths, name: str) -> list[str]:
    return [p.name for p in all_paths(character_dir(paths, name), "sheet", IMAGE_EXTS)]


def _approved_list(char: Character, look: str | None) -> list[str]:
    """The approved-sheet list of one look (mutable, part of char)."""
    if _is_default(look):
        return char.approved_sheets
    with_look(char, look)  # raises for an unknown look
    return char.looks[look].approved_sheets


def approved_anywhere(char: Character) -> set[str]:
    return set(char.approved_sheets).union(*(lk.approved_sheets for lk in char.looks.values()))


def approve(paths: Paths, name: str, version: int, look: str | None = None) -> str:
    char = load_character(paths, name)
    target = _approved_list(char, look)
    f = find_version(character_dir(paths, name), "sheet", version, IMAGE_EXTS)
    if f is None:
        raise UserError(f"No sheet_v{version} for {name}")
    if f.name not in target:
        target.append(f.name)
        save_character(paths, char)
    return f.name


def discard(paths: Paths, name: str, version: int) -> str:
    """Hide a sheet you don't want: moved to discarded/ (never deleted; its version number is not reused)."""
    char = load_character(paths, name)
    f = find_version(character_dir(paths, name), "sheet", version, IMAGE_EXTS)
    if f is None:
        raise UserError(f"No sheet_v{version} for {name}")
    if f.name in approved_anywhere(char):
        raise UserError(f"{f.name} is approved — unapprove it before discarding")
    if f.name == char.face_ref:
        raise UserError(f"{f.name} is the face reference — clear it before discarding")
    discard_file(f)
    return f.name


def _holder(char: Character, look: str | None):
    """The object holding a look's `reference` (the character for the main look, else the Look)."""
    _approved_list(char, look)  # raises for an unknown look
    return char if _is_default(look) else char.looks[look]


def set_reference(paths: Paths, name: str, version: int, look: str | None = None) -> str:
    """Pin one sheet as the look's reference for keyframes (approving it into the look if needed)."""
    char = load_character(paths, name)
    target = _approved_list(char, look)
    f = find_version(character_dir(paths, name), "sheet", version, IMAGE_EXTS)
    if f is None:
        raise UserError(f"No sheet_v{version} for {name}")
    if f.name == char.face_ref:
        raise UserError(f"{f.name} is the face photo — it is already sent as the face; pick a full-body sheet")
    if f.name not in target:
        target.append(f.name)
    _holder(char, look).reference = f.name
    save_character(paths, char)
    return f.name


def name_sheet(paths: Paths, name: str, version: int, text: str) -> str:
    """Give a sheet a human name for the UI. The file keeps its versioned name (sidecars and approvals point at it)."""
    char = load_character(paths, name)
    f = find_version(character_dir(paths, name), "sheet", version, IMAGE_EXTS)
    if f is None:
        raise UserError(f"No sheet_v{version} for {name}")
    if text.strip():
        char.sheet_names[f.name] = text.strip()
    else:
        char.sheet_names.pop(f.name, None)
    save_character(paths, char)
    return f.name


def unapprove(paths: Paths, name: str, version: int, look: str | None = None) -> str:
    char = load_character(paths, name)
    target = _approved_list(char, look)
    f = find_version(character_dir(paths, name), "sheet", version, IMAGE_EXTS)
    if f is None:
        raise UserError(f"No sheet_v{version} for {name}")
    if f.name in target:
        target.remove(f.name)
        holder = _holder(char, look)
        if holder.reference == f.name:
            holder.reference = None
        save_character(paths, char)
    return f.name
