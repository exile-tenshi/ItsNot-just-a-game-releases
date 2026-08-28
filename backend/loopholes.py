"""Loophole registry — loads config/loopholes.json."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from config import ROOT_DIR

CONFIG_PATH = ROOT_DIR / "config" / "loopholes.json"


def load_loopholes() -> dict[str, Any]:
    with CONFIG_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def list_all_loopholes() -> list[dict[str, Any]]:
    """Flat list of every loophole with category label attached."""
    cfg = load_loopholes()
    items: list[dict[str, Any]] = []
    for cat_id, cat in cfg.get("categories", {}).items():
        for loophole in cat.get("loopholes", []):
            items.append({**loophole, "category": cat_id, "category_label": cat.get("label", cat_id)})
    return items


def count_by_used() -> dict[str, int]:
    items = list_all_loopholes()
    used = sum(1 for i in items if i.get("used") is True)
    return {"total": len(items), "used_true": used, "used_false": len(items) - used}
