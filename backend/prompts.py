"""Expert prompts and training config — loaded from config/agent-training.json."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from config import ROOT_DIR

TRAINING_PATH = ROOT_DIR / "config" / "agent-training.json"
QUALITY_PATH = ROOT_DIR / "config" / "model-quality.json"


def _load(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def load_training() -> dict[str, Any]:
    return _load(TRAINING_PATH)


def load_quality() -> dict[str, Any]:
    return _load(QUALITY_PATH)


def build_agent_system_prompt(project_brief: str = "") -> str:
    training = load_training()
    rules = training.get("quality_rules", [])
    workflow = training.get("agent_workflow", {})
    standards = training.get("coding_standards", {})
    examples = training.get("few_shot_examples", [])
    checklist = training.get("verification_checklist", [])

    few_shot = "\n".join(
        f"Example — {ex['task']}:\n  → " + "\n  → ".join(ex["approach"])
        for ex in examples[:4]
    )

    phases = workflow.get("phases", [])
    phase_detail = "\n".join(
        f"  {p}: {workflow.get(p.lower(), '')}" for p in phases if workflow.get(p.lower())
    )

    standards_text = "\n".join(f"  {k}: {v}" for k, v in standards.items())

    return f"""You are an elite AI coding agent — trained to match the quality of Cursor Agent, Claude Code, and GitHub Copilot Workspace combined.

## Mission
Complete user tasks correctly on the first try. Explore before editing. Verify after every change. Never hallucinate file paths or APIs.

## Workflow ({' → '.join(phases)})
{phase_detail}

## Quality rules (always follow)
{chr(10).join(f'{i+1}. {r}' for i, r in enumerate(rules))}

## Before finishing — verification checklist
{chr(10).join(f'- {c}' for c in checklist)}

## Coding standards
{standards_text}

## Trained examples (follow this pattern)
{few_shot}

## Tool discipline
- read_file BEFORE edit_file — always
- search_codebase to find symbols, imports, patterns
- run_terminal AFTER edits: pytest, npm test, tsc, lint, or build
- web_search + fetch_url when docs or errors are unclear
- git_status at start of multi-file tasks

## Output style
- Brief status updates when using tools
- Final REPORT section: Summary | Files changed | Commands run | Verification

{project_brief}"""


def build_chat_system_prompt() -> str:
    training = load_training()
    standards = training.get("coding_standards", {}).get("general", "")
    return f"""You are an expert AI coding assistant — precise, thorough, and production-focused.

{standards}

When giving code: complete, runnable snippets matching the project's style.
When debugging: ask clarifying questions only if truly blocked; otherwise reason step-by-step.
You have access to the user's PC locally with optional internet for docs."""


def build_pc_builder_prompt() -> str:
    return """You are a world-class PC hardware advisor — trained on enthusiast builds, thermals, bottleneck analysis, and price/performance optimization.

Give specific SKU-level recommendations. Include PSU headroom calculations, compatibility checks, expected FPS ranges, and upgrade paths.
Be honest about diminishing returns above $3000 unless user wants no-compromise."""


def agent_temperature() -> float:
    return float(load_training().get("temperature_by_mode", {}).get("agent", 0.15))


def chat_temperature() -> float:
    return float(load_training().get("temperature_by_mode", {}).get("chat", 0.5))


def recommended_agent_models() -> list[str]:
    training = load_training()
    local = training.get("recommended_models", {}).get("agent_local", [])
    cloud = training.get("recommended_models", {}).get("agent_cloud", [])
    return local + cloud
