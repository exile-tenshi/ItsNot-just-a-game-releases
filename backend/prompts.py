"""Expert prompts — layered architecture matching Cursor, Claude Code, Cline."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from config import ROOT_DIR

TRAINING_PATH = ROOT_DIR / "config" / "agent-training.json"
QUALITY_PATH = ROOT_DIR / "config" / "model-quality.json"

PROJECT_INSTRUCTION_FILES = [
    ROOT_DIR / "AGENTS.md",
    ROOT_DIR / "CLAUDE.md",
    ROOT_DIR / ".cursor" / "rules" / "01-agent-behaviour.mdc",
]


def _load(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def load_training() -> dict[str, Any]:
    return _load(TRAINING_PATH)


def load_quality() -> dict[str, Any]:
    return _load(QUALITY_PATH)


def _load_project_instructions(max_chars: int = 4000) -> str:
    """Load AGENTS.md / CLAUDE.md / .cursor/rules — Claude Code settingSources equivalent."""
    parts: list[str] = []
    for path in PROJECT_INSTRUCTION_FILES:
        if path.is_file():
            try:
                text = path.read_text(encoding="utf-8")
                # Strip YAML frontmatter from .mdc
                if text.startswith("---"):
                    end = text.find("---", 3)
                    if end != -1:
                        text = text[end + 3 :].strip()
                parts.append(f"<!-- {path.name} -->\n{text[:1500]}")
            except OSError:
                pass
    combined = "\n\n".join(parts)
    return combined[:max_chars]


def _bullet_list(items: list[str], prefix: str = "- ") -> str:
    return "\n".join(f"{prefix}{item}" for item in items)


def build_agent_system_prompt(project_brief: str = "") -> str:
    t = load_training()

    dm = t.get("decision_making", {})
    before = _bullet_list(dm.get("before_writing_code", []))
    during = _bullet_list(dm.get("during_execution", []))
    after = _bullet_list(dm.get("after_task", []))

    few_shot = "\n\n".join(
        f"**{ex.get('source', 'Example')}** — {ex['task']}:\n"
        + "\n".join(f"  {i+1}. {step}" for i, step in enumerate(ex["approach"]))
        for ex in t.get("few_shot_examples", [])
    )

    workflow = t.get("agent_workflow", {})
    phases = workflow.get("phases", [])
    phase_detail = "\n".join(
        f"  **{p}**: {workflow.get(p.lower(), '')}" for p in phases if workflow.get(p.lower())
    )

    risk = t.get("risk_policy", {})
    standards = t.get("coding_standards", {})
    standards_text = "\n".join(f"  **{k}**: {v}" for k, v in standards.items())

    comm = t.get("communication", {})
    output = t.get("output_contract", {})
    project_rules = _load_project_instructions()

    return f"""<system_policy>
<role>
{t.get("role", "You are a senior software engineer.")}
</role>

<priorities>
{_bullet_list(t.get("priorities", []))}
</priorities>

<decision_making>
Before writing code:
{before}

During execution:
{during}

After task:
{after}
</decision_making>

<universal_constraints>
{_bullet_list(t.get("universal_constraints", []))}
</universal_constraints>

<operating_policy>
{_bullet_list(t.get("operating_policy", []))}
</operating_policy>

<tool_policy>
{_bullet_list(t.get("tool_policy", []))}
</tool_policy>

<risk_policy>
Low risk (proceed): {", ".join(risk.get("low_risk_reversible", []))}
Confirm first: {", ".join(risk.get("confirm_before", []))}
</risk_policy>

<communication>
Style: {comm.get("style", "")}
Uncertainty: {comm.get("uncertainty", "")}
On completion: {comm.get("completion", "")}
</communication>

<output_contract>
Structure: {output.get("structure", "")}
Tool transparency: {output.get("tool_transparency", "")}
Sources: {output.get("sources", "")}
</output_contract>

<known_failure_patterns>
{_bullet_list(t.get("known_failure_patterns", []))}
</known_failure_patterns>

<anti_patterns>
{_bullet_list(t.get("anti_patterns", []))}
</anti_patterns>

<verification_checklist>
{_bullet_list(t.get("verification_checklist", []))}
</verification_checklist>

<coding_standards>
{standards_text}
</coding_standards>

<workflow>
{' → '.join(phases)}
{phase_detail}
</workflow>

<trained_examples>
{few_shot}
</trained_examples>

<project_rules>
{project_rules}
</project_rules>

<trusted_runtime_context>
{project_brief}
</trusted_runtime_context>
</system_policy>"""


def build_chat_system_prompt() -> str:
    t = load_training()
    comm = t.get("communication", {})
    standards = t.get("coding_standards", {}).get("general", "")
    project_rules = _load_project_instructions(2000)

    return f"""You are a senior software engineer — same quality bar as Cursor Chat and Claude Code.

{standards}

Communication: {comm.get("style", "")} {comm.get("uncertainty", "")}

When giving code: complete, runnable, matching project style.
When debugging: reason step-by-step; one clarifying question only if truly blocked.

<project_rules>
{project_rules}
</project_rules>"""


def build_pc_builder_prompt() -> str:
    return """You are a world-class PC hardware advisor — trained on enthusiast builds, thermals, bottleneck analysis, and price/performance optimization.

Give specific SKU-level recommendations. Include PSU headroom, compatibility checks, expected FPS ranges, and upgrade paths.
Lead with the recommendation, then reasoning. Be honest about diminishing returns."""


def agent_temperature() -> float:
    return float(load_training().get("temperature_by_mode", {}).get("agent", 0.1))


def chat_temperature() -> float:
    return float(load_training().get("temperature_by_mode", {}).get("chat", 0.5))


def recommended_agent_models() -> list[str]:
    t = load_training()
    local = t.get("recommended_models", {}).get("agent_local", [])
    cloud = t.get("recommended_models", {}).get("agent_cloud", [])
    return local + cloud


def plan_mode_file_threshold() -> int:
    return int(load_training().get("plan_mode_triggers", {}).get("file_count_threshold", 5))
