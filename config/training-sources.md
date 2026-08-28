# Agent Training Sources — Verification Document

> Double-checked alignment with top-tier AI coding tools (2026 standards).

## Sources mirrored

| Tool | What we imported | Our equivalent |
|------|------------------|----------------|
| **Cursor** | `.cursor/rules` alwaysApply, Plan mode, 5+ file plan rule | `.cursor/rules/01-agent-behaviour.mdc`, `plan_mode_triggers` |
| **Claude Code** | `CLAUDE.md`, global constraints, 3-bullet summaries | `CLAUDE.md`, `communication`, `universal_constraints` |
| **Cline** | Custom Instructions: step-by-step, minimum file changes | `decision_making.during_execution`, `few_shot_examples` |
| **Windsurf** | Behaviour section in `.windsurfrules` | `decision_making.before_writing_code` pattern-first rule |
| **Aider** | Reversible changes, plan before complex tasks | `risk_policy`, `priorities` |
| **Continue.dev** | 3+ file plan outline | `plan_mode_triggers.outline_threshold` |
| **Claude playbook** | Layered: role, operating_policy, tool_policy, output_contract | `prompts.py` XML `<system_policy>` blocks |

## Key rules (cross-tool consensus)

1. **5+ files** → plan + approval (Cursor, Claude Code)
2. **3+ files** → outline plan (Continue.dev)
3. **Never install packages** without asking (Cursor, Cline, Continue)
4. **Never delete files** without confirmation (Cursor, Claude Code)
5. **One clarifying question** when ambiguous (all major tools)
6. **Minimal diffs** / anti-over-engineering (Claude Code, Cline)
7. **Verify before done** — tests/build must pass (Cursor best practices, our VERIFY phase)
8. **≤3 bullet summary** when finished (Claude Code communication)

## Files to review

| File | Purpose |
|------|---------|
| `config/agent-training.json` | Master training config — few-shot, rules, workflow |
| `AGENTS.md` | Open agent standard (Cursor/Cline/Windsurf) |
| `CLAUDE.md` | Claude Code project memory |
| `.cursor/rules/01-agent-behaviour.mdc` | Cursor alwaysApply rules |
| `backend/prompts.py` | Layered prompt builder |

## Model tiers (same as top tools use)

| Tier | Models |
|------|--------|
| Cloud flagship | GLM-5.1, GLM-5.3, Claude Sonnet, GPT-4o |
| Local best | qwen2.5-coder:14b, qwen2.5:14b, deepseek-coder-v2:16b |
