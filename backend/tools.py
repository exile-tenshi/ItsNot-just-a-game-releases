"""Coding agent tools — Cursor / Cline / Windsurf parity."""

from __future__ import annotations

import json
import subprocess
from typing import Any, Callable

from code_checker import format_verify_report, verify_code
from external_access import ExternalAccessDenied, gate
from game_studio import (
    add_asset,
    add_character,
    add_feature,
    add_roads,
    create_project,
    generate_map,
    generate_terrain,
    list_projects,
    regenerate_playable,
    setup_multiplayer,
)
from scripts_commands import run_script_file, run_terminal_command
from web_search import fetch_url, web_search
from workspace import (
    edit_file,
    get_workspace_root,
    list_tree,
    read_file,
    search_codebase,
    write_file,
)

def get_tool_schemas(*, internet_enabled: bool | None = None) -> list[dict[str, Any]]:
    schemas = _all_tool_schemas()
    if internet_enabled is False or (internet_enabled is None and not gate.internet_enabled):
        return gate.filter_tool_schemas(schemas)
    return schemas


def _all_tool_schemas() -> list[dict[str, Any]]:
    return [
        {
            "type": "function",
            "function": {
                "name": "read_file",
                "description": "Read a file from the workspace with line numbers (like Cursor @file read)",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "Relative path from workspace root"},
                        "offset": {"type": "integer", "description": "Start line (1-based)", "default": 1},
                        "limit": {"type": "integer", "description": "Max lines to read", "default": 500},
                    },
                    "required": ["path"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "write_file",
                "description": "Write or create a file in the workspace",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string"},
                        "content": {"type": "string"},
                    },
                    "required": ["path", "content"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "edit_file",
                "description": "Replace exact text in a file (search/replace edit — like Cursor Apply)",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string"},
                        "old_string": {"type": "string", "description": "Exact text to find"},
                        "new_string": {"type": "string", "description": "Replacement text"},
                    },
                    "required": ["path", "old_string", "new_string"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "list_directory",
                "description": "List files and folders in the workspace",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "default": "."},
                    },
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "search_codebase",
                "description": "Search code with regex across the workspace (like Cursor codebase search)",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "pattern": {"type": "string", "description": "Regex pattern"},
                        "path": {"type": "string", "default": "."},
                    },
                    "required": ["pattern"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "run_terminal",
                "description": "Run a shell command in the workspace — npm test, pytest, python -m, git, build pipelines, ./start.sh, etc.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "command": {"type": "string", "description": "Shell command to run"},
                        "cwd": {"type": "string", "description": "Relative working directory", "default": "."},
                        "timeout_seconds": {
                            "type": "integer",
                            "description": "Max seconds before timeout (default 300, max 900)",
                        },
                    },
                    "required": ["command"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "run_script",
                "description": "Execute a script file (.py, .sh, .js, .ts, etc.) with the correct interpreter and optional args",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "Relative path to script in workspace"},
                        "args": {"type": "string", "description": "Optional arguments passed to the script", "default": ""},
                        "cwd": {"type": "string", "description": "Relative working directory", "default": "."},
                        "timeout_seconds": {
                            "type": "integer",
                            "description": "Max seconds before timeout (default 600)",
                        },
                    },
                    "required": ["path"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "web_search",
                "description": "Search the internet for documentation, errors, API references (requires internet)",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string"},
                    },
                    "required": ["query"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "fetch_url",
                "description": "Fetch and read content from a URL (docs, GitHub, Stack Overflow)",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "url": {"type": "string"},
                    },
                    "required": ["url"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "git_status",
                "description": "Get git status of the workspace",
                "parameters": {"type": "object", "properties": {}},
            },
        },
        {
            "type": "function",
            "function": {
                "name": "git_diff",
                "description": "Get git diff (optionally for a specific file)",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "Optional file path"},
                    },
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "verify_code",
                "description": "Run top code checkers (Ruff, mypy, ESLint, tsc, Bandit, pytest, ShellCheck, etc.) until zero errors. Call after every code edit.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "paths": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Optional file paths to check (defaults to all detected languages in workspace)",
                        },
                        "languages": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Optional language filter: python, typescript, javascript, go, rust, shell",
                        },
                    },
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "game_create_project",
                "description": "Create a new video game from scratch (Three.js 3D foundation, playable in browser)",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "genre": {"type": "string", "default": "sandbox"},
                        "dimension": {"type": "string", "enum": ["3d", "2d"], "default": "3d"},
                        "features": {"type": "array", "items": {"type": "string"}},
                    },
                    "required": ["name"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "game_add_character",
                "description": "Add a character (player, npc, enemy) with stats and appearance",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "project": {"type": "string"},
                        "name": {"type": "string"},
                        "role": {"type": "string", "default": "npc"},
                        "health": {"type": "integer", "default": 50},
                        "speed": {"type": "number", "default": 5},
                        "color": {"type": "string", "default": "#ff6644"},
                        "mesh": {"type": "string", "default": "box"},
                        "abilities": {"type": "array", "items": {"type": "string"}},
                    },
                    "required": ["project", "name"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "game_add_feature",
                "description": "Add gameplay feature: inventory, quests, combat, weapons, multiplayer, etc.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "project": {"type": "string"},
                        "feature": {"type": "string"},
                    },
                    "required": ["project", "feature"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "game_generate_terrain",
                "description": "Generate procedural 3D terrain heightmap with biomes",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "project": {"type": "string"},
                        "width": {"type": "integer", "default": 128},
                        "height": {"type": "integer", "default": 128},
                        "seed": {"type": "integer", "default": 42},
                        "style": {"type": "string", "default": "hills"},
                    },
                    "required": ["project"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "game_generate_map",
                "description": "Create world map with spawn, zones, and points of interest",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "project": {"type": "string"},
                        "name": {"type": "string", "default": "World"},
                        "size": {"type": "integer", "default": 200},
                    },
                    "required": ["project"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "game_add_roads",
                "description": "Add road network (splines or grid) on the map",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "project": {"type": "string"},
                        "grid_size": {"type": "integer", "description": "Optional grid road spacing"},
                    },
                    "required": ["project"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "game_setup_multiplayer",
                "description": "Enable WebSocket multiplayer server and client sync",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "project": {"type": "string"},
                        "port": {"type": "integer", "default": 8765},
                        "max_players": {"type": "integer", "default": 16},
                    },
                    "required": ["project"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "game_add_asset",
                "description": "Add 3D model or procedural texture to the game",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "project": {"type": "string"},
                        "asset_type": {"type": "string", "enum": ["texture", "model"]},
                        "asset_id": {"type": "string"},
                        "shape": {"type": "string", "default": "box"},
                        "color": {"type": "string", "default": "#888888"},
                        "scale": {"type": "array", "items": {"type": "number"}},
                        "position": {"type": "array", "items": {"type": "number"}},
                        "color1": {"type": "string"},
                        "color2": {"type": "string"},
                    },
                    "required": ["project", "asset_type", "asset_id"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "git_log",
                "description": "Recent git commits",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "count": {"type": "integer", "default": 10},
                    },
                },
            },
        },
    ]


def run_terminal(command: str, cwd: str = ".", timeout_seconds: int | None = None) -> dict[str, Any]:
    return run_terminal_command(command, cwd=cwd, timeout_seconds=timeout_seconds)


def run_script(
    path: str,
    args: str = "",
    cwd: str = ".",
    timeout_seconds: int | None = None,
) -> dict[str, Any]:
    return run_script_file(path, args=args, cwd=cwd, timeout_seconds=timeout_seconds)


def _git_cmd(args: list[str]) -> str:
    root = get_workspace_root()
    proc = subprocess.run(
        ["git"] + args,
        cwd=str(root),
        capture_output=True,
        text=True,
        timeout=30,
    )
    if proc.returncode != 0 and proc.stderr:
        return proc.stderr
    return proc.stdout


def git_status() -> str:
    return _git_cmd(["status", "--short", "--branch"])


def git_diff(path: str | None = None) -> str:
    args = ["diff", "--stat"]
    if path:
        args.append(path)
    return _git_cmd(args)


def git_log(count: int = 10) -> str:
    return _git_cmd(["log", f"-{count}", "--oneline", "--decorate"])


def verify_code_tool(paths: list[str] | None = None, languages: list[str] | None = None) -> dict[str, Any]:
    report = verify_code(paths=paths or None, languages=languages or None)
    report["formatted"] = format_verify_report(report)
    return report


TOOL_HANDLERS: dict[str, Callable[..., Any]] = {
    "read_file": lambda **kw: read_file(kw["path"], kw.get("offset", 1), kw.get("limit", 500)),
    "write_file": lambda **kw: write_file(kw["path"], kw["content"]),
    "edit_file": lambda **kw: edit_file(kw["path"], kw["old_string"], kw["new_string"]),
    "list_directory": lambda **kw: list_tree(kw.get("path", ".")),
    "search_codebase": lambda **kw: search_codebase(kw["pattern"], kw.get("path", ".")),
    "run_terminal": lambda **kw: run_terminal(
        kw["command"], kw.get("cwd", "."), kw.get("timeout_seconds")
    ),
    "run_script": lambda **kw: run_script(
        kw["path"], kw.get("args", ""), kw.get("cwd", "."), kw.get("timeout_seconds")
    ),
    "web_search": lambda **kw: web_search(kw["query"]),
    "fetch_url": lambda **kw: fetch_url(kw["url"]),
    "git_status": lambda **kw: git_status(),
    "git_diff": lambda **kw: git_diff(kw.get("path")),
    "git_log": lambda **kw: git_log(kw.get("count", 10)),
    "verify_code": lambda **kw: verify_code_tool(kw.get("paths"), kw.get("languages")),
    "game_create_project": lambda **kw: create_project(
        kw["name"], kw.get("genre", "sandbox"), kw.get("dimension", "3d"), kw.get("features")
    ),
    "game_add_character": lambda **kw: add_character(
        kw["project"], kw["name"], kw.get("role", "npc"), kw.get("health", 50),
        kw.get("speed", 5), kw.get("color", "#ff6644"), kw.get("mesh", "box"), kw.get("abilities"),
    ),
    "game_add_feature": lambda **kw: add_feature(kw["project"], kw["feature"], kw.get("config")),
    "game_generate_terrain": lambda **kw: generate_terrain(
        kw["project"], kw.get("width", 128), kw.get("height", 128), kw.get("seed", 42), kw.get("style", "hills"),
    ),
    "game_generate_map": lambda **kw: generate_map(kw["project"], kw.get("name", "World"), kw.get("size", 200)),
    "game_add_roads": lambda **kw: add_roads(kw["project"], kw.get("roads"), kw.get("grid_size")),
    "game_setup_multiplayer": lambda **kw: setup_multiplayer(
        kw["project"], True, kw.get("port", 8765), kw.get("max_players", 16),
    ),
    "game_add_asset": lambda **kw: add_asset(
        kw["project"], kw["asset_type"], kw["asset_id"],
        shape=kw.get("shape", "box"), color=kw.get("color", "#888888"),
        scale=kw.get("scale"), position=kw.get("position"),
        color1=kw.get("color1", "#888888"), color2=kw.get("color2", "#666666"),
    ),
}


def execute_tool(name: str, arguments: str | dict[str, Any], *, internet_enabled: bool | None = None) -> str:
    if internet_enabled is not None:
        gate.resolve_preference(internet_enabled)

    try:
        gate.ensure_web_tool(name)
    except ExternalAccessDenied as exc:
        return json.dumps({"error": str(exc), "code": exc.reason})

    if isinstance(arguments, str):
        args = json.loads(arguments) if arguments else {}
    else:
        args = arguments

    handler = TOOL_HANDLERS.get(name)
    if not handler:
        return json.dumps({"error": f"Unknown tool: {name}"})

    try:
        result = handler(**args)
        return json.dumps(result, default=str) if not isinstance(result, str) else result
    except Exception as exc:
        return json.dumps({"error": str(exc)})
