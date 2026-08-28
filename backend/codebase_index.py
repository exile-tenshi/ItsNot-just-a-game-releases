"""Lightweight codebase indexing — auto-brief for agent context (like Cursor @codebase)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from workspace import SKIP_DIRS, get_workspace_root, read_file, search_codebase

MANIFEST_FILES = [
    "AGENTS.md",
    "CLAUDE.md",
    "README.md",
    "package.json",
    "pyproject.toml",
    "requirements.txt",
    "Cargo.toml",
    "go.mod",
    "docker-compose.yml",
    "Makefile",
    ".env.example",
]

KEY_EXTENSIONS = {
    ".py", ".ts", ".tsx", ".js", ".jsx", ".go", ".rs", ".java", ".md", ".json", ".yaml", ".yml",
}


def _count_files(root: Path) -> dict[str, int]:
    counts: dict[str, int] = {}
    for path in root.rglob("*"):
        if path.is_file() and not any(s in path.parts for s in SKIP_DIRS):
            ext = path.suffix.lower() or "(no ext)"
            counts[ext] = counts.get(ext, 0) + 1
    return dict(sorted(counts.items(), key=lambda x: -x[1])[:12])


def _find_entry_points(root: Path) -> list[str]:
    candidates = [
        "main.py", "app.py", "index.ts", "index.tsx", "main.ts", "server.py",
        "backend/main.py", "frontend/src/main.tsx", "src/index.ts",
    ]
    found = []
    for c in candidates:
        if (root / c).is_file():
            found.append(c)
    return found[:8]


def build_project_brief(max_chars: int = 6000) -> str:
    """Build a structured project summary injected into agent system context."""
    root = get_workspace_root()
    lines: list[str] = ["## Project brief (auto-indexed)"]
    lines.append(f"Root: {root}")

    # Manifest files
    for name in MANIFEST_FILES:
        path = root / name
        if path.is_file():
            try:
                content = path.read_text(encoding="utf-8", errors="replace")[:1500]
                lines.append(f"\n### {name}\n```\n{content}\n```")
            except OSError:
                pass

    # Stats
    counts = _count_files(root)
    if counts:
        lines.append(f"\n### File types\n{json.dumps(counts)}")

    # Entry points
    entries = _find_entry_points(root)
    if entries:
        lines.append(f"\n### Likely entry points\n" + ", ".join(entries))

    # Top-level structure
    try:
        top = sorted(root.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower()))
        structure = []
        for p in top:
            if p.name in SKIP_DIRS:
                continue
            structure.append(f"{'📁' if p.is_dir() else '📄'} {p.name}")
        lines.append("\n### Top-level\n" + "\n".join(structure[:25]))
    except OSError:
        pass

    # Recent git hint
    try:
        import subprocess

        proc = subprocess.run(
            ["git", "log", "-5", "--oneline"],
            cwd=str(root),
            capture_output=True,
            text=True,
            timeout=5,
        )
        if proc.stdout.strip():
            lines.append(f"\n### Recent commits\n{proc.stdout.strip()}")
    except (OSError, subprocess.TimeoutExpired):
        pass

    brief = "\n".join(lines)
    return brief[:max_chars]


def find_relevant_files(query: str, limit: int = 8) -> list[str]:
    """Suggest files relevant to a user query via keyword search."""
    keywords = [w for w in query.lower().split() if len(w) > 3][:5]
    if not keywords:
        return []

    seen: set[str] = set()
    results: list[str] = []
    for kw in keywords:
        hits = search_codebase(kw, max_results=10)
        for hit in hits:
            path = hit.get("path", "")
            if path and path not in seen:
                seen.add(path)
                results.append(path)
                if len(results) >= limit:
                    return results
    return results
