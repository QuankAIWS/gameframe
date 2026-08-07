#!/usr/bin/env python3
"""Validate GameFrame RPG planning-document metadata and local relationships."""

from __future__ import annotations

from datetime import date
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parent.parent
PLANNING = ROOT / "planning"

REQUIRED_FIELDS = {
    "title",
    "status",
    "document_type",
    "owner",
    "last_updated",
    "applies_to",
}
ALLOWED_STATUSES = {
    "draft",
    "proposed",
    "accepted",
    "active",
    "superseded",
    "retired",
}
# This large owner-approved lore ledger predates the lifecycle-status convention.
# Preserve its existing metadata without making `developing` a valid status for any
# new or unrelated planning document. Future edits should eventually normalize it
# when the file is deliberately revised for content rather than churn the whole
# ledger solely for one metadata value.
LEGACY_STATUS_BY_PATH = {
    "planning/monster-master-rpg-lore-and-story.md": "developing",
}
LOCAL_REFERENCE_FIELDS = {"related", "depends_on"}
CORE_RPG_INDEX_PATHS = {
    "shared/rpg-agent-architecture-and-campaign-package.md",
    "shared/rpg-platform-roadmap.md",
    "shared/rpg-platform-product-goals.md",
    "monster-master-rpg-canonical-baseline.md",
    "rpg-gm-runtime-boundary.md",
    "rpg-gameframe-interface-contract.md",
}
PLANNING_README_PATHS = {
    "rpg-documentation-index.md",
    "shared/rpg-agent-architecture-and-campaign-package.md",
    "shared/rpg-platform-roadmap.md",
    "monster-master-rpg-canonical-baseline.md",
    "ROADMAP.md",
}


class FrontMatterError(RuntimeError):
    pass


def unquote(value: str) -> str:
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
        return value[1:-1]
    return value


def parse_front_matter(path: Path) -> dict[str, object]:
    lines = path.read_text(encoding="utf-8").splitlines()
    if not lines or lines[0].strip() != "---":
        raise FrontMatterError("missing opening YAML front matter delimiter")
    try:
        end = next(index for index in range(1, len(lines)) if lines[index].strip() == "---")
    except StopIteration as error:
        raise FrontMatterError("missing closing YAML front matter delimiter") from error

    data: dict[str, object] = {}
    current_list: str | None = None
    for raw in lines[1:end]:
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        item = re.match(r"^\s+-\s+(.+?)\s*$", raw)
        if item:
            if current_list is None:
                continue
            value = data.setdefault(current_list, [])
            if isinstance(value, list):
                value.append(unquote(item.group(1)))
            continue

        match = re.match(r"^([A-Za-z0-9_]+):(?:\s*(.*))?$", raw)
        if not match:
            current_list = None
            continue
        key, raw_value = match.group(1), match.group(2) or ""
        if raw_value.strip():
            data[key] = unquote(raw_value.strip())
            current_list = None
        else:
            data[key] = []
            current_list = key
    return data


def values(data: dict[str, object], key: str) -> list[str]:
    value = data.get(key)
    if value is None:
        return []
    if isinstance(value, list):
        return [str(entry) for entry in value]
    return [str(value)]


def managed_documents() -> list[Path]:
    candidates = {
        PLANNING / "README.md",
        PLANNING / "ROADMAP.md",
        PLANNING / "rpg-documentation-index.md",
        PLANNING / "monster-master-rpg-canonical-baseline.md",
        PLANNING / "decisions" / "0005-gameframe-bot-and-external-agent-boundary.md",
        *PLANNING.glob("rpg-*.md"),
        *PLANNING.glob("monster-master-rpg-*.md"),
        *(PLANNING / "shared").glob("*.md"),
    }
    return sorted(path for path in candidates if path.is_file())


def relative(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def validate_front_matter(path: Path, data: dict[str, object]) -> list[str]:
    errors: list[str] = []
    missing = sorted(field for field in REQUIRED_FIELDS if not values(data, field))
    if missing:
        errors.append(f"{relative(path)} missing required front matter: {', '.join(missing)}")

    status = values(data, "status")
    path_key = relative(path)
    if status and status[0] not in ALLOWED_STATUSES:
        if LEGACY_STATUS_BY_PATH.get(path_key) != status[0]:
            errors.append(
                f"{path_key} status {status[0]!r} is not one of {sorted(ALLOWED_STATUSES)}"
            )

    updated = values(data, "last_updated")
    if updated:
        try:
            date.fromisoformat(updated[0])
        except ValueError:
            errors.append(f"{path_key} last_updated is not YYYY-MM-DD: {updated[0]!r}")

    if path.parent == PLANNING / "shared":
        for field in (
            "shared_document_id",
            "shared_document_version",
            "canonical_repository",
            "canonical_path",
            "sync_policy",
        ):
            if not values(data, field):
                errors.append(f"{path_key} shared document is missing {field}")
        sync_policy = values(data, "sync_policy")
        if sync_policy and sync_policy[0] != "exact-byte-copy":
            errors.append(
                f"{path_key} sync_policy must be 'exact-byte-copy', got {sync_policy[0]!r}"
            )
    return errors


def validate_references(path: Path, data: dict[str, object]) -> list[str]:
    errors: list[str] = []
    for field in LOCAL_REFERENCE_FIELDS:
        for reference in values(data, field):
            if reference.startswith(("http://", "https://")):
                continue
            candidate = path.parent / reference
            if not candidate.exists():
                errors.append(
                    f"{relative(path)} {field} reference does not exist: {reference}"
                )
    return errors


def validate_indexes() -> list[str]:
    errors: list[str] = []
    rpg_index = (PLANNING / "rpg-documentation-index.md").read_text(encoding="utf-8")
    for reference in sorted(CORE_RPG_INDEX_PATHS):
        if reference not in rpg_index:
            errors.append(
                f"planning/rpg-documentation-index.md does not index required document: {reference}"
            )

    planning_readme = (PLANNING / "README.md").read_text(encoding="utf-8")
    for reference in sorted(PLANNING_README_PATHS):
        if reference not in planning_readme:
            errors.append(f"planning/README.md does not reference core planning entry: {reference}")
    return errors


def validate_supersession(path: Path, data: dict[str, object]) -> list[str]:
    status = values(data, "status")
    if not status or status[0] != "superseded":
        return []
    if not values(data, "superseded_by"):
        return [f"{relative(path)} is superseded but has no superseded_by field"]
    return []


def main() -> int:
    errors: list[str] = []
    documents = managed_documents()
    if not documents:
        errors.append("no managed GameFrame RPG planning documents were found")

    for path in documents:
        try:
            data = parse_front_matter(path)
        except (OSError, FrontMatterError) as error:
            errors.append(f"{relative(path)}: {error}")
            continue
        errors.extend(validate_front_matter(path, data))
        errors.extend(validate_references(path, data))
        errors.extend(validate_supersession(path, data))

    errors.extend(validate_indexes())

    if errors:
        print("GameFrame RPG documentation hygiene check failed.", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(
        f"GameFrame RPG documentation hygiene verified for {len(documents)} managed Markdown documents."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
