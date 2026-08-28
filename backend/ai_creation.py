"""AI creation catalog — all modalities from config/ai-creation.json."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from config import ROOT_DIR

CONFIG_PATH = ROOT_DIR / "config" / "ai-creation.json"


def load_creation_catalog() -> dict[str, Any]:
    with CONFIG_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def get_creation_by_id(creation_id: str) -> dict[str, Any] | None:
    catalog = load_creation_catalog()
    for item in catalog.get("creation_types", []):
        if item["id"] == creation_id:
            return item
    return None


def list_by_category() -> dict[str, list[dict[str, Any]]]:
    catalog = load_creation_catalog()
    grouped: dict[str, list[dict[str, Any]]] = {}
    for item in catalog.get("creation_types", []):
        cat = item.get("category", "other")
        grouped.setdefault(cat, []).append(item)
    return grouped
