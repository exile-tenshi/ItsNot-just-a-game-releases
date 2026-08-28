"""Sandboxed workspace file operations."""

from __future__ import annotations

import json
import os
import re
import subprocess
from pathlib import Path
from typing import Any

from config import settings

SKIP_DIRS = {
    ".git",
    "node_modules",
    "__pycache__",
    ".venv",
    "venv",
    "dist",
    "build",
    ".next",
    ".cursor",
}

_workspace_override: str | None = None


def set_workspace_root(path: str) -> Path:
    global _workspace_override
    resolved = Path(path).resolve()
    if not resolved.is_dir():
        raise NotADirectoryError(path)
    _workspace_override = str(resolved)
    return resolved


def get_workspace_root() -> Path:
    if _workspace_override:
        return Path(_workspace_override)
    root = Path(settings.workspace_root).resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def resolve_safe_path(relative: str) -> Path:
    root = get_workspace_root()
    rel = relative.strip().lstrip("/").replace("\\", "/")
    target = (root / rel).resolve()
    if not str(target).startswith(str(root)):
        raise PermissionError(f"Path escapes workspace: {relative}")
    return target


def list_tree(relative: str = ".", max_depth: int = 4) -> list[dict[str, Any]]:
    base = resolve_safe_path(relative)
    if not base.is_dir():
        raise FileNotFoundError(relative)

    entries: list[dict[str, Any]] = []

    def walk(path: Path, depth: int, prefix: str) -> None:
        if depth > max_depth:
            return
        try:
            items = sorted(path.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower()))
        except PermissionError:
            return
        for item in items:
            if item.name in SKIP_DIRS and item.is_dir():
                continue
            rel = str(item.relative_to(get_workspace_root())).replace("\\", "/")
            node: dict[str, Any] = {
                "name": item.name,
                "path": rel,
                "type": "dir" if item.is_dir() else "file",
            }
            if item.is_file():
                try:
                    node["size"] = item.stat().st_size
                except OSError:
                    node["size"] = 0
            entries.append(node)
            if item.is_dir():
                walk(item, depth + 1, rel)

    walk(base, 0, relative)
    return entries


def read_file(relative: str, offset: int = 1, limit: int = 500) -> dict[str, Any]:
    path = resolve_safe_path(relative)
    if not path.is_file():
        raise FileNotFoundError(relative)
    text = path.read_text(encoding="utf-8", errors="replace")
    lines = text.splitlines()
    start = max(0, offset - 1)
    end = min(len(lines), start + limit)
    numbered = [f"{i + 1}|{lines[i]}" for i in range(start, end)]
    return {
        "path": relative,
        "total_lines": len(lines),
        "offset": offset,
        "limit": limit,
        "content": "\n".join(numbered),
    }


def write_file(relative: str, content: str) -> dict[str, Any]:
    path = resolve_safe_path(relative)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return {"path": relative, "bytes": len(content.encode()), "written": True}


def edit_file(relative: str, old_string: str, new_string: str) -> dict[str, Any]:
    path = resolve_safe_path(relative)
    if not path.is_file():
        raise FileNotFoundError(relative)
    text = path.read_text(encoding="utf-8")
    if old_string not in text:
        raise ValueError("old_string not found in file")
    updated = text.replace(old_string, new_string, 1)
    path.write_text(updated, encoding="utf-8")
    return {"path": relative, "edited": True, "replacements": 1}


def search_codebase(pattern: str, relative: str = ".", max_results: int = 50) -> list[dict[str, Any]]:
    root = resolve_safe_path(relative)
    results: list[dict[str, Any]] = []
    try:
        proc = subprocess.run(
            [
                "rg",
                "--json",
                "-m",
                str(max_results),
                "--glob",
                "!.git/*",
                "--glob",
                "!node_modules/*",
                "--glob",
                "!**/dist/*",
                pattern,
                str(root),
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
        for line in proc.stdout.splitlines():
            try:
                obj = json.loads(line)
                if obj.get("type") == "match":
                    data = obj["data"]
                    rel_path = Path(data["path"]["text"]).relative_to(get_workspace_root())
                    results.append(
                        {
                            "path": str(rel_path).replace("\\", "/"),
                            "line": data["line_number"],
                            "text": data["lines"]["text"].strip(),
                        }
                    )
            except (json.JSONDecodeError, KeyError, ValueError):
                continue
    except FileNotFoundError:
        # Fallback: Python regex walk
        regex = re.compile(pattern)
        for path in root.rglob("*"):
            if path.is_file() and not any(s in path.parts for s in SKIP_DIRS):
                try:
                    for i, line in enumerate(path.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
                        if regex.search(line):
                            rel = str(path.relative_to(get_workspace_root())).replace("\\", "/")
                            results.append({"path": rel, "line": i, "text": line.strip()})
                            if len(results) >= max_results:
                                return results
                except (OSError, UnicodeDecodeError):
                    continue
    return results[:max_results]
