"""Autonomous coding agent loop — Cursor-style tool use."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterator

from config import ROOT_DIR, settings
from openai_client import chat_completion, resolve_model
from tools import execute_tool, get_tool_schemas

AGENT_SYSTEM = """You are an expert AI coding agent — equivalent to Cursor, Cline, or Windsurf.

You have tools to:
- Read, write, and edit files in the workspace
- Search the codebase with regex
- Run terminal commands (tests, builds, git, npm, pip)
- Search the internet and fetch documentation URLs
- Inspect git status, diff, and log

Rules:
1. Always explore the codebase before making changes (read_file, search_codebase, list_directory)
2. Use edit_file for surgical changes; write_file for new files
3. Run tests/commands to verify your work (run_terminal)
4. Search the web when you need current docs, API changes, or error solutions
5. Be concise in messages but thorough in tool use
6. When done, summarize what you changed and how to verify

Workspace root is the user's open project folder."""


def load_agent_config() -> dict[str, Any]:
    path = ROOT_DIR / "config" / "coding-agent.json"
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def run_agent(
    user_message: str,
    *,
    context_files: list[str] | None = None,
    messages_history: list[dict[str, str]] | None = None,
    model: str | None = None,
    api_key: str | None = None,
    base_url: str | None = None,
    temperature: float = 0.3,
    max_iterations: int | None = None,
) -> Iterator[dict[str, Any]]:
    """Run agent loop, yielding SSE events: thinking, tool_call, tool_result, content, done, error."""
    cfg = load_agent_config()
    max_iter = max_iterations or cfg.get("features", {}).get("agent_mode", {}).get("max_iterations", 25)

    messages: list[dict[str, Any]] = [{"role": "system", "content": AGENT_SYSTEM}]

    if context_files:
        ctx_parts = []
        for fp in context_files[:20]:
            try:
                from workspace import read_file

                data = read_file(fp, limit=300)
                ctx_parts.append(f"### File: {fp}\n```\n{data['content']}\n```")
            except Exception as exc:
                ctx_parts.append(f"### File: {fp}\n(could not read: {exc})")
        messages.append(
            {
                "role": "user",
                "content": "Attached context files:\n\n" + "\n\n".join(ctx_parts),
            }
        )

    if messages_history:
        messages.extend(messages_history)

    messages.append({"role": "user", "content": user_message})

    tools = get_tool_schemas()
    model_name = resolve_model(model, base_url)

    for iteration in range(max_iter):
        yield {"type": "iteration", "iteration": iteration + 1, "max": max_iter}

        try:
            response = chat_completion(
                messages,
                model=model_name,
                temperature=temperature,
                stream=False,
                api_key=api_key,
                base_url=base_url,
                tools=tools,
            )
        except Exception as exc:
            yield {"type": "error", "message": str(exc)}
            return

        choice = response.choices[0]
        msg = choice.message

        if msg.content:
            yield {"type": "content", "content": msg.content}

        tool_calls = msg.tool_calls or []
        if not tool_calls:
            yield {"type": "done", "finish_reason": choice.finish_reason or "stop"}
            return

        # Append assistant message with tool calls
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

            result = execute_tool(name, args)
            yield {"type": "tool_result", "name": name, "id": tc.id, "result": result[:8000]}

            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": result[:16000],
                }
            )

    yield {"type": "done", "finish_reason": "max_iterations", "message": f"Stopped after {max_iter} iterations"}
