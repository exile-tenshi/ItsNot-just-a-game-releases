"""Local inference detection — Ollama and other OpenAI-compatible servers on this PC."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen

from config import ROOT_DIR, settings


def load_local_config() -> dict[str, Any]:
    path = ROOT_DIR / "config" / "local.json"
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def is_local_url(base_url: str) -> bool:
    lowered = base_url.lower().rstrip("/")
    return any(
        host in lowered
        for host in (
            "127.0.0.1",
            "localhost",
            "0.0.0.0",
            "[::1]",
        )
    )


def resolve_api_key(api_key: str | None, base_url: str | None) -> str:
    """Local servers (Ollama, vLLM, LM Studio) do not need real API keys."""
    url = base_url or settings.inference_base_url
    if api_key:
        return api_key
    if settings.local_mode or is_local_url(url):
        return settings.local_api_key or "local"
    if settings.zai_api_key:
        return settings.zai_api_key
    return settings.local_api_key or "local"


def resolve_base_url(base_url: str | None) -> str:
    return base_url or settings.inference_base_url


def _http_get(url: str, timeout: float = 2.0) -> dict[str, Any] | None:
    try:
        req = Request(url, headers={"Accept": "application/json"})
        with urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode())
    except (URLError, OSError, json.JSONDecodeError, TimeoutError):
        return None


def detect_ollama(base_url: str | None = None) -> dict[str, Any]:
    """Probe Ollama at the configured OpenAI-compatible base URL."""
    url = resolve_base_url(base_url)
    root = url.replace("/v1", "").rstrip("/")

    tags = _http_get(f"{root}/api/tags")
    models: list[str] = []
    if tags and "models" in tags:
        models = [m.get("name", "") for m in tags["models"] if m.get("name")]

    # OpenAI-compatible models list
    openai_models = _http_get(f"{url.rstrip('/')}/models")
    openai_names: list[str] = []
    if openai_models and "data" in openai_models:
        openai_names = [m.get("id", "") for m in openai_models["data"] if m.get("id")]

    all_models = list(dict.fromkeys(models + openai_names))
    running = _http_get(f"{root}/api/ps")
    running_names = []
    if running and "models" in running:
        running_names = [m.get("name", "") for m in running["models"] if m.get("name")]

    return {
        "reachable": bool(tags or openai_models),
        "base_url": url,
        "models": all_models,
        "running_models": running_names,
        "provider": "ollama" if "11434" in url else "local-openai",
    }


def pick_best_model(available: list[str], preferred: list[str] | None = None) -> str | None:
    prefs = preferred or settings.preferred_models
    lowered = {m.lower(): m for m in available}
    for pref in prefs:
        pl = pref.lower()
        if pl in lowered:
            return lowered[pl]
        for name in available:
            if pl in name.lower() or name.lower().startswith(pl.split(":")[0]):
                return name
    return available[0] if available else None


def get_local_status() -> dict[str, Any]:
    local_cfg = load_local_config()
    ollama = detect_ollama()
    model = settings.glm_model
    if ollama["reachable"] and local_cfg.get("inference", {}).get("auto_detect_model"):
        picked = pick_best_model(ollama["models"])
        if picked:
            model = picked

    return {
        "local_mode": settings.local_mode,
        "requires_api_key": local_cfg.get("requires_api_key", False),
        "requires_internet": local_cfg.get("requires_internet", False),
        "usage_limits": local_cfg.get("usage_limits", {}),
        "inference": {
            "base_url": resolve_base_url(None),
            "configured_model": settings.glm_model,
            "active_model": model,
            "ollama": ollama,
        },
        "ready": ollama["reachable"],
        "setup_hint": (
            "Install Ollama from https://ollama.com then run: ollama pull llama3.1:8b"
            if not ollama["reachable"]
            else None
        ),
    }
