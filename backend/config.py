"""Application settings for GLM-5.1 UI backend."""

import json
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parent.parent


def _load_local_defaults() -> dict:
    path = ROOT_DIR / "config" / "local.json"
    if path.exists():
        with path.open(encoding="utf-8") as f:
            return json.load(f)
    return {}


_LOCAL = _load_local_defaults()
_INFERENCE = _LOCAL.get("inference", {})


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ROOT_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Local-first (default) — runs on this PC via Ollama / local OpenAI-compatible server
    local_mode: bool = True
    inference_base_url: str = _INFERENCE.get("base_url", "http://127.0.0.1:11434/v1")
    local_api_key: str = _INFERENCE.get("api_key", "local")
    glm_model: str = _INFERENCE.get("fallback_model", "llama3.1:8b")
    preferred_models: list[str] = _INFERENCE.get(
        "preferred_models",
        ["glm-5.1", "qwen2.5:14b", "llama3.1:8b"],
    )

    # Optional cloud fallback (not required)
    zai_api_key: str = ""
    zai_base_url: str = "https://api.z.ai/api/paas/v4/"

    # Server
    host: str = "0.0.0.0"
    port: int = _LOCAL.get("default_port", 8000)
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000,http://127.0.0.1:8000"
    serve_ui: bool = _LOCAL.get("serve_ui_from_backend", True)

    # Restriction guard — disabled by default in local mode (cloud subscription rules)
    restriction_guard_mode: str = _LOCAL.get("restriction_guard", {}).get(
        "default_mode", "disabled"
    )
    restrictions_dir: Path = ROOT_DIR / "restrictions"
    restrictions_test_config: Path = ROOT_DIR / "config" / "restrictions-test.json"
    local_config_path: Path = ROOT_DIR / "config" / "local.json"
    pc_builder_config_path: Path = ROOT_DIR / "config" / "pc-builder-presets.json"
    coding_agent_config_path: Path = ROOT_DIR / "config" / "coding-agent.json"
    workspace_root: str = str(ROOT_DIR)
    internet_enabled: bool = True

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
