"""Gaming PC builder prompts and preset loading."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from config import ROOT_DIR
from prompts import build_pc_builder_prompt

PC_BUILDER_SYSTEM_PROMPT = build_pc_builder_prompt()


def load_presets() -> dict[str, Any]:
    path = ROOT_DIR / "config" / "pc-builder-presets.json"
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def build_custom_prompt(
    budget_usd: int | None,
    resolution: str,
    use_case: str,
    extras: str = "",
) -> str:
    parts = ["Design a gaming PC build"]
    if budget_usd:
        parts.append(f"with a ${budget_usd:,} USD budget")
    parts.append(f"targeting {resolution}")
    if use_case:
        parts.append(f"optimized for: {use_case}")
    parts.append(
        ". Include full parts list, compatibility notes, expected FPS in 3 popular games, "
        "PSU wattage calculation, and 2 upgrade suggestions for the future."
    )
    prompt = " ".join(parts)
    if extras.strip():
        prompt += f"\n\nAdditional requirements: {extras.strip()}"
    return prompt
