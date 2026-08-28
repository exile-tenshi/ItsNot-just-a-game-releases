"""Top code-checking pipeline — Ruff, mypy, ESLint, tsc, Bandit, pytest, etc."""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path
from typing import Any

from config import ROOT_DIR
from workspace import get_workspace_root

CONFIG_PATH = ROOT_DIR / "config" / "code-checkers.json"


def load_checker_config() -> dict[str, Any]:
    with CONFIG_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def _run_cmd(command: str, cwd: Path, timeout: int = 90) -> dict[str, Any]:
    try:
        proc = subprocess.run(
            command,
            shell=True,
            cwd=str(cwd),
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        out = (proc.stdout or "") + (proc.stderr or "")
        return {
            "exit_code": proc.returncode,
            "output": out[-8000:] if len(out) > 8000 else out,
            "passed": proc.returncode == 0,
        }
    except subprocess.TimeoutExpired:
        return {"exit_code": -1, "output": "Timeout", "passed": False}
    except FileNotFoundError:
        return {"exit_code": -1, "output": "Command not found", "passed": False, "skipped": True}


def _cmd_available(command: str) -> bool:
    binary = command.strip().split()[0]
    if binary in ("python3", "npx", "npm", "go", "cargo", "shellcheck"):
        return shutil.which(binary) is not None
    return shutil.which(binary) is not None


def detect_languages(root: Path | None = None) -> set[str]:
    root = root or get_workspace_root()
    langs: set[str] = set()
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if "node_modules" in path.parts or ".git" in path.parts:
            continue
        ext = path.suffix.lower()
        if ext == ".py":
            langs.add("python")
        elif ext in (".ts", ".tsx"):
            langs.add("typescript")
        elif ext in (".js", ".jsx"):
            langs.add("javascript")
        elif ext == ".go":
            langs.add("go")
        elif ext == ".rs":
            langs.add("rust")
        elif ext == ".sh":
            langs.add("shell")
        elif ext == ".json":
            langs.add("json")
    if (root / "package.json").exists():
        langs.add("typescript")
    if (root / "requirements.txt").exists() or (root / "pyproject.toml").exists():
        langs.add("python")
    if (root / "Cargo.toml").exists():
        langs.add("rust")
    if (root / "go.mod").exists():
        langs.add("go")
    return langs


def _paths_arg(paths: list[str] | None, lang: str) -> str:
    root = get_workspace_root()
    if paths:
        return " ".join(f'"{root / p}"' for p in paths if p)
    if lang == "python":
        return "backend" if (root / "backend").is_dir() else "."
    if lang in ("typescript", "javascript"):
        return "frontend/src" if (root / "frontend" / "src").is_dir() else "."
    return "."


def run_checker(
    checker: dict[str, Any],
    paths: list[str] | None = None,
    lang: str = "python",
) -> dict[str, Any]:
    root = get_workspace_root()
    scope = checker.get("scope", "file")
    paths_str = _paths_arg(paths if scope != "project" else None, lang)
    cmd_template = checker["command"]
    command = cmd_template.replace("{paths}", paths_str)

    if not _cmd_available(command):
        return {
            "id": checker["id"],
            "name": checker["name"],
            "source": checker.get("source", ""),
            "category": checker.get("category", ""),
            "command": command,
            "exit_code": 0,
            "output": "",
            "passed": True,
            "note": f"Checker not installed — skipped (install: {checker.get('install', 'see docs')})",
        }

    result = _run_cmd(command, root)
    return {
        "id": checker["id"],
        "name": checker["name"],
        "source": checker.get("source", ""),
        "category": checker.get("category", ""),
        "command": command,
        **result,
    }


def verify_code(paths: list[str] | None = None, languages: list[str] | None = None) -> dict[str, Any]:
    """Run all applicable top checkers. Returns zero_errors=True only if every run checker passed."""
    cfg = load_checker_config()
    root = get_workspace_root()
    langs = set(languages) if languages else detect_languages(root)
    if paths:
        for p in paths:
            ext = Path(p).suffix.lower()
            if ext == ".py":
                langs.add("python")
            elif ext in (".ts", ".tsx"):
                langs.add("typescript")
            elif ext in (".js", ".jsx"):
                langs.add("javascript")

    results: list[dict[str, Any]] = []
    for lang in sorted(langs):
        checkers = cfg.get("checkers", {}).get(lang, [])
        for checker in checkers:
            r = run_checker(checker, paths, lang)
            results.append(r)

    ran = [r for r in results if not r.get("note")]
    failed = [r for r in ran if not r.get("passed")]
    skipped = [r for r in results if r.get("note")]

    return {
        "zero_errors": len(failed) == 0,
        "total_checkers": len(results),
        "passed": len(ran) - len(failed),
        "failed": len(failed),
        "skipped": len(skipped),
        "languages": sorted(langs),
        "paths": paths,
        "failures": [
            {"id": f["id"], "name": f["name"], "output": f.get("output", "")[:2000]}
            for f in failed
        ],
        "results": results,
        "policy": cfg.get("zero_errors_policy", {}),
    }


def format_verify_report(report: dict[str, Any]) -> str:
    lines = [
        f"ZERO ERRORS: {'YES ✓' if report['zero_errors'] else 'NO — fix required'}",
        f"Passed: {report['passed']}/{report['total_checkers']} | Failed: {report['failed']} | Skipped: {report['skipped']}",
    ]
    for f in report.get("failures", []):
        lines.append(f"\n❌ {f['name']} ({f['id']}):\n{f['output'][:1500]}")
    return "\n".join(lines)
