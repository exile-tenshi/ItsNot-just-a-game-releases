"""Run local shell commands and script files in the workspace."""

from __future__ import annotations

import json
import shlex
import subprocess
from pathlib import Path
from typing import Any

from config import ROOT_DIR
from workspace import get_workspace_root, resolve_safe_path

CONFIG_PATH = ROOT_DIR / "config" / "scripts-commands.json"

BLOCKED_COMMANDS = [
    "rm -rf /",
    "mkfs",
    ":(){ :|:& };:",
    "dd if=/dev/zero",
    "shutdown",
    "reboot",
    "halt",
]


def load_scripts_config() -> dict[str, Any]:
    with CONFIG_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def _cap_timeout(requested: int | None, *, for_script: bool = False) -> int:
    cfg = load_scripts_config()
    section = cfg.get("run_script" if for_script else "run_terminal", {})
    default = section.get("default_timeout_seconds", 300 if for_script else 120)
    maximum = section.get("max_timeout_seconds", cfg.get("run_terminal", {}).get("max_timeout_seconds", 900))
    timeout = requested if requested is not None else default
    return min(max(timeout, 1), maximum)


def _max_output_bytes() -> int:
    cfg = load_scripts_config()
    return cfg.get("run_terminal", {}).get("max_output_bytes", 131072)


def _resolve_cwd(cwd: str) -> Path:
    root = get_workspace_root()
    work = (root / cwd.strip().lstrip("/")).resolve()
    if not str(work).startswith(str(root)):
        raise ValueError("cwd escapes workspace")
    return work


def _check_blocked(command: str) -> str | None:
    for blocked in BLOCKED_COMMANDS:
        if blocked in command:
            return blocked
    return None


def _truncate_output(text: str) -> str:
    limit = _max_output_bytes()
    if len(text) > limit:
        return text[-limit:]
    return text


def _run_process(
    command: str | list[str],
    *,
    cwd: Path,
    timeout: int,
    shell: bool,
) -> dict[str, Any]:
    try:
        proc = subprocess.run(
            command,
            shell=shell,
            cwd=str(cwd),
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return {
            "exit_code": proc.returncode,
            "stdout": _truncate_output(proc.stdout or ""),
            "stderr": _truncate_output(proc.stderr or ""),
            "timed_out": False,
        }
    except subprocess.TimeoutExpired as exc:
        stdout = _truncate_output(exc.stdout or "") if exc.stdout else ""
        stderr = _truncate_output(exc.stderr or "") if exc.stderr else ""
        return {
            "exit_code": -1,
            "stdout": stdout,
            "stderr": stderr or f"Command timed out after {timeout}s",
            "timed_out": True,
        }


def run_terminal_command(
    command: str,
    cwd: str = ".",
    timeout_seconds: int | None = None,
) -> dict[str, Any]:
    cfg = load_scripts_config()
    if not cfg.get("enabled", True) or not cfg.get("run_terminal", {}).get("enabled", True):
        return {"error": "Terminal commands are disabled in config/scripts-commands.json"}

    blocked = _check_blocked(command)
    if blocked:
        return {"error": f"Blocked dangerous command pattern: {blocked}", "command": command}

    work = _resolve_cwd(cwd)
    timeout = _cap_timeout(timeout_seconds, for_script=False)
    result = _run_process(command, cwd=work, timeout=timeout, shell=True)
    return {
        "type": "command",
        "command": command,
        "cwd": cwd,
        "timeout_seconds": timeout,
        **result,
    }


def _script_command(script_path: Path, args: str) -> tuple[str | list[str], bool]:
    cfg = load_scripts_config()
    ext = script_path.suffix.lower()
    allowed = cfg.get("allowed_script_extensions", [])
    if ext not in allowed:
        raise ValueError(f"Unsupported script extension {ext!r}. Allowed: {', '.join(allowed)}")

    template = cfg.get("interpreters", {}).get(ext)
    if not template:
        raise ValueError(f"No interpreter configured for {ext}")

    rel = str(script_path)
    parts: list[str] = []
    for token in template:
        if token == "{path}":
            parts.append(rel)
        else:
            parts.append(token)
    if args.strip():
        parts.extend(shlex.split(args))

    if ext in (".bat", ".cmd"):
        return " ".join(shlex.quote(p) for p in parts), True
    return parts, False


def run_script_file(
    path: str,
    args: str = "",
    cwd: str = ".",
    timeout_seconds: int | None = None,
) -> dict[str, Any]:
    cfg = load_scripts_config()
    if not cfg.get("enabled", True) or not cfg.get("run_script", {}).get("enabled", True):
        return {"error": "Script execution is disabled in config/scripts-commands.json"}

    work = _resolve_cwd(cwd)
    script = resolve_safe_path(path)
    if not script.is_file():
        return {"error": f"Script not found: {path}", "path": path}

    command_str = ""
    try:
        cmd, use_shell = _script_command(script, args)
        if use_shell:
            command_str = cmd if isinstance(cmd, str) else " ".join(cmd)
            blocked = _check_blocked(command_str)
            if blocked:
                return {"error": f"Blocked dangerous command pattern: {blocked}", "path": path}
        else:
            command_str = " ".join(shlex.quote(p) for p in cmd)
            blocked = _check_blocked(command_str)
            if blocked:
                return {"error": f"Blocked dangerous command pattern: {blocked}", "path": path}
    except ValueError as exc:
        return {"error": str(exc), "path": path}

    timeout = _cap_timeout(timeout_seconds, for_script=True)
    result = _run_process(cmd, cwd=work, timeout=timeout, shell=use_shell)
    return {
        "type": "script",
        "path": path,
        "args": args,
        "command": command_str,
        "cwd": cwd,
        "timeout_seconds": timeout,
        **result,
    }
