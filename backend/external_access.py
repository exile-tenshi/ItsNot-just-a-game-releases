"""Gate all outbound connections — requires explicit user approval."""

from __future__ import annotations

from dataclasses import dataclass

from config import ROOT_DIR, settings
from local_engine import is_local_url, resolve_base_url

CONFIG_PATH = ROOT_DIR / "config" / "external-access.json"

WEB_TOOLS = frozenset({"web_search", "fetch_url"})


@dataclass
class ExternalAccessDenied(Exception):
    reason: str
    detail: str

    def __str__(self) -> str:
        return self.detail


class ExternalAccessGate:
    """Tracks whether the user has approved external (internet/cloud) connections."""

    def __init__(self) -> None:
        self._user_approved = settings.internet_enabled

    @property
    def internet_enabled(self) -> bool:
        return self._user_approved

    def set_user_approval(self, enabled: bool) -> None:
        self._user_approved = enabled

    def resolve_preference(self, client_value: bool | None) -> bool:
        """Apply per-request client preference when provided; return effective state."""
        if client_value is not None:
            self._user_approved = client_value
        return self._user_approved

    def require_internet(self, action: str = "external connection") -> None:
        if not self._user_approved:
            raise ExternalAccessDenied(
                reason="internet_not_approved",
                detail=(
                    f"Blocked {action}: external connections are disabled. "
                    "Enable internet in Settings to approve web search, URL fetch, and cloud AI providers."
                ),
            )

    def ensure_inference_allowed(self, base_url: str | None) -> str:
        url = resolve_base_url(base_url)
        if not is_local_url(url):
            self.require_internet(f"cloud inference ({url})")
        return url

    def ensure_web_tool(self, tool_name: str) -> None:
        if tool_name in WEB_TOOLS:
            self.require_internet(tool_name.replace("_", " "))

    def filter_tool_schemas(self, schemas: list[dict]) -> list[dict]:
        if self._user_approved:
            return schemas
        return [s for s in schemas if s.get("function", {}).get("name") not in WEB_TOOLS]


gate = ExternalAccessGate()
