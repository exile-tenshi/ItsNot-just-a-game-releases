"""Application settings for GLM-5.1 UI backend."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ROOT_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Z.AI OpenAI-compatible API (official SDK configuration)
    zai_api_key: str = ""
    zai_base_url: str = "https://api.z.ai/api/paas/v4/"
    glm_model: str = "glm-5.1"

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Restriction guard
    restriction_guard_mode: str = "enforce"  # enforce | log_only | disabled
    restrictions_dir: Path = ROOT_DIR / "restrictions"
    restrictions_test_config: Path = ROOT_DIR / "config" / "restrictions-test.json"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
