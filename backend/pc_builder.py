"""Gaming PC builder prompts and preset loading."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from config import ROOT_DIR

PC_BUILDER_SYSTEM_PROMPT = """You are an expert gaming PC builder and hardware advisor running locally on the user's machine.

Your specialty is designing extremely high-quality gaming PC builds — from budget 1080p rigs to no-compromise 4K/ultrawide enthusiast systems.

Guidelines:
- Give specific part recommendations (CPU, GPU, motherboard, RAM, storage, PSU, case, cooler) with model names
- Explain trade-offs clearly: price/performance, thermals, noise, upgrade path, bottleneck analysis
- Include estimated FPS ranges for popular games at the target resolution
- Note compatibility issues (socket, RAM speed, GPU length, PSU wattage headroom)
- Mention AMD vs Intel and NVIDIA vs AMD GPU choices when relevant
- Suggest monitor pairings when appropriate
- Be practical about regional availability and current-generation parts (2025–2026)
- If budget is given, stay within ~10% unless user asks to stretch

You run entirely on the user's PC with no usage limits. Be thorough — users want build lists they can actually buy and assemble."""


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
