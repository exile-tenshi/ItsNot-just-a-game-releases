"""Autonomous coding agent — trained workflow with verify loop and quality routing."""

from __future__ import annotations

import json
import re
from typing import Any, Iterator

from code_checker import format_verify_report, load_checker_config, verify_code
from codebase_index import build_project_brief, find_relevant_files
from external_access import ExternalAccessDenied, gate
from openai_client import chat_completion, resolve_best_agent_model
from prompts import agent_temperature, build_agent_system_prompt, load_quality, load_training
from tools import execute_tool, get_tool_schemas


def load_agent_config() -> dict[str, Any]:
    from config import ROOT_DIR

    path = ROOT_DIR / "config" / "coding-agent.json"
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def _parse_tool_args(args: str | dict[str, Any]) -> dict[str, Any]:
    if isinstance(args, dict):
        return args
    try:
        return json.loads(args) if args else {}
    except json.JSONDecodeError:
        return {}


def _suggest_verify_command(edited_paths: list[str]) -> str | None:
    root_hints = " ".join(edited_paths).lower()
    if any(p.endswith(".py") for p in edited_paths):
        if "test" in root_hints:
            return "python3 -m pytest -x --tb=short -q 2>&1 | tail -30"
        return "python3 -m py_compile " + " ".join(p for p in edited_paths if p.endswith(".py"))[:200]
    if any(p.endswith((".ts", ".tsx")) for p in edited_paths):
        return "cd frontend 2>/dev/null && npm run build 2>&1 | tail -20 || npx tsc --noEmit 2>&1 | tail -20"
    if "package.json" in edited_paths:
        return "npm test 2>&1 | tail -20"
    return "verify_code tool — runs Ruff, mypy, ESLint, tsc, Bandit, pytest, etc."


def _checker_policy() -> dict[str, Any]:
    return load_checker_config().get("zero_errors_policy", {})


def _auto_verify_after_edit(path: str) -> tuple[dict[str, Any], str]:
    report = verify_code(paths=[path])
    return report, format_verify_report(report)


def run_agent(
    user_message: str,
    *,
    context_files: list[str] | None = None,
    messages_history: list[dict[str, str]] | None = None,
    model: str | None = None,
    api_key: str | None = None,
    base_url: str | None = None,
    temperature: float | None = None,
    max_iterations: int | None = None,
    auto_index: bool = True,
    internet_enabled: bool | None = None,
) -> Iterator[dict[str, Any]]:
    """Run trained agent loop with project brief, smart routing, and verify-after-edit."""
    effective_internet = gate.resolve_preference(internet_enabled)
    cfg = load_agent_config()
    quality = load_quality()
    defaults = quality.get("defaults", {})
    max_iter = max_iterations or cfg.get("features", {}).get("agent_mode", {}).get("max_iterations", 30)
    temp = temperature if temperature is not None else agent_temperature()
    max_tokens = defaults.get("agent_max_tokens", 8192)

    project_brief = build_project_brief() if auto_index else ""
    system = build_agent_system_prompt(project_brief)
    messages: list[dict[str, Any]] = [{"role": "system", "content": system}]

    # Auto-attach relevant files from query
    all_context = list(context_files or [])
    if auto_index:
        for fp in find_relevant_files(user_message):
            if fp not in all_context:
                all_context.append(fp)

    if all_context:
        ctx_parts = []
        for fp in all_context[:20]:
            try:
                from workspace import read_file

                data = read_file(fp, limit=400)
                ctx_parts.append(f"### File: {fp}\n```\n{data['content']}\n```")
            except Exception as exc:
                ctx_parts.append(f"### File: {fp}\n(unreadable: {exc})")
        messages.append(
            {"role": "user", "content": "Context files (@attachments + auto-indexed):\n\n" + "\n\n".join(ctx_parts)}
        )

    if messages_history:
        messages.extend(messages_history)

    messages.append({"role": "user", "content": user_message})

    tools = get_tool_schemas(internet_enabled=effective_internet)
    try:
        gate.ensure_inference_allowed(base_url)
    except ExternalAccessDenied as exc:
        yield {"type": "error", "message": str(exc)}
        return

    model_name = resolve_best_agent_model(model, base_url)
    yield {"type": "model", "model": model_name, "temperature": temp}

    edited_files: list[str] = []
    verify_pending = False
    last_zero_errors = True
    verify_rounds = 0
    checker_policy = _checker_policy()
    block_until_clean = checker_policy.get("block_agent_done_until_clean", True)
    max_fix_rounds = checker_policy.get("max_fix_rounds", 5)
    consecutive_errors = 0

    for iteration in range(max_iter):
        yield {"type": "iteration", "iteration": iteration + 1, "max": max_iter}

        # Inject verify reminder if we edited but haven't tested
        if verify_pending and iteration > 0 and not last_zero_errors:
            cmd = _suggest_verify_command(edited_files)
            messages.append(
                {
                    "role": "user",
                    "content": f"VERIFICATION REQUIRED: You edited {edited_files[-3:]} but checkers still report errors. "
                    f"Run verify_code on those paths or `{cmd}`, fix every issue, then verify again.",
                }
            )
            verify_pending = False

        try:
            response = chat_completion(
                messages,
                model=model_name,
                temperature=temp,
                max_tokens=max_tokens,
                stream=False,
                api_key=api_key,
                base_url=base_url,
                tools=tools,
                tool_choice="auto",
            )
        except Exception as exc:
            consecutive_errors += 1
            if consecutive_errors >= 3:
                yield {"type": "error", "message": f"Model failed 3 times: {exc}"}
                return
            yield {"type": "content", "content": f"Retrying after error: {exc}\n"}
            continue

        consecutive_errors = 0
        choice = response.choices[0]
        msg = choice.message

        if msg.content:
            yield {"type": "content", "content": msg.content}

        tool_calls = msg.tool_calls or []
        if not tool_calls:
            if (
                edited_files
                and block_until_clean
                and not last_zero_errors
                and verify_rounds < max_fix_rounds
                and iteration < max_iter - 1
            ):
                messages.append({"role": "assistant", "content": msg.content or ""})
                messages.append(
                    {
                        "role": "user",
                        "content": "BLOCKED — zero-errors policy: code checkers still report failures. "
                        "Call verify_code, fix every reported issue, re-run verify_code until ZERO ERRORS: YES, then REPORT.",
                    }
                )
                continue

            if edited_files and iteration < max_iter - 1:
                last_assistant = msg.content or ""
                if not re.search(r"(verify|test|pass|✓|success|exit code 0|zero errors)", last_assistant, re.I):
                    messages.append({"role": "assistant", "content": msg.content or ""})
                    messages.append(
                        {
                            "role": "user",
                            "content": "Before finishing: run verify_code (top linters/type checkers) and include results in your REPORT.",
                        }
                    )
                    continue

            yield {
                "type": "done",
                "finish_reason": choice.finish_reason or "stop",
                "zero_errors": last_zero_errors,
                "files_edited": edited_files,
            }
            return

        messages.append(
            {
                "role": "assistant",
                "content": msg.content or "",
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                    }
                    for tc in tool_calls
                ],
            }
        )

        for tc in tool_calls:
            name = tc.function.name
            args = tc.function.arguments
            yield {"type": "tool_call", "name": name, "arguments": args, "id": tc.id}

            result = execute_tool(name, args, internet_enabled=effective_internet)
            yield {"type": "tool_result", "name": name, "id": tc.id, "result": result[:8000]}

            parsed = _parse_tool_args(args)
            if name in ("write_file", "edit_file") and parsed.get("path"):
                edited_files.append(parsed["path"])
                verify_pending = True
                if checker_policy.get("enabled", True):
                    report, summary = _auto_verify_after_edit(parsed["path"])
                    last_zero_errors = report.get("zero_errors", False)
                    verify_rounds += 1
                    yield {"type": "verify", "path": parsed["path"], "zero_errors": last_zero_errors, "summary": summary}
                    result += f"\n\n--- AUTO CODE VERIFY ---\n{summary}"
                    if not last_zero_errors:
                        result += "\n\nFix all checker errors before finishing."

            if name == "verify_code":
                try:
                    vr = json.loads(result) if isinstance(result, str) else result
                    if isinstance(vr, dict):
                        last_zero_errors = vr.get("zero_errors", False)
                        verify_rounds += 1
                        verify_pending = not last_zero_errors
                except (json.JSONDecodeError, TypeError):
                    pass

            # Help model recover from tool errors
            result_obj: Any = result
            try:
                result_obj = json.loads(result)
            except (json.JSONDecodeError, TypeError):
                pass

            if isinstance(result_obj, dict) and result_obj.get("error"):
                result += "\n\nHINT: Fix the error above. Re-read the file or search_codebase before retrying."

            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": result[:16000],
                }
            )

    yield {
        "type": "done",
        "finish_reason": "max_iterations",
        "message": f"Stopped after {max_iter} iterations. Files touched: {edited_files}",
    }
