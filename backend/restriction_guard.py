"""Client-side restriction guard mirroring Z.AI policy categories."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass
class Violation:
    category_id: str
    label: str
    description: str
    severity: str
    matched_keyword: str
    terms_section: str | None = None


@dataclass
class GuardResult:
    allowed: bool
    violations: list[Violation]
    mode: str


class RestrictionGuard:
    def __init__(
        self,
        restrictions_dir: Path,
        mode: str = "enforce",
    ) -> None:
        self.restrictions_dir = restrictions_dir
        self.mode = mode
        self._not_allowed = self._load_json(restrictions_dir / "not-allowed.json")
        self._allowed = self._load_json(restrictions_dir / "allowed.json")
        self._patterns: list[tuple[re.Pattern[str], dict[str, Any]]] = []
        self._build_patterns()

    @staticmethod
    def _load_json(path: Path) -> dict[str, Any]:
        with path.open(encoding="utf-8") as f:
            return json.load(f)

    def _build_patterns(self) -> None:
        for category in self._not_allowed.get("categories", []):
            keywords = category.get("guard_keywords", [])
            for keyword in keywords:
                words = [w for w in keyword.lower().split() if w]
                if not words:
                    continue
                # All words in the keyword phrase must appear in the input (order-independent)
                pattern_parts = [f"(?=.*{re.escape(word)})" for word in words]
                pattern = re.compile("^" + "".join(pattern_parts) + ".*$", re.IGNORECASE | re.DOTALL)
                self._patterns.append((pattern, category))

    def reload(self, mode: str | None = None) -> None:
        if mode is not None:
            self.mode = mode
        self._not_allowed = self._load_json(self.restrictions_dir / "not-allowed.json")
        self._allowed = self._load_json(self.restrictions_dir / "allowed.json")
        self._patterns.clear()
        self._build_patterns()

    def check(self, text: str) -> GuardResult:
        if self.mode == "disabled":
            return GuardResult(allowed=True, violations=[], mode=self.mode)

        normalized = " ".join(text.lower().split())
        violations: list[Violation] = []

        seen_ids: set[str] = set()
        for pattern, category in self._patterns:
            if category["id"] in seen_ids:
                continue
            if pattern.search(normalized):
                seen_ids.add(category["id"])
                # Find which keyword matched for reporting
                matched = next(
                    (
                        kw
                        for kw in category.get("guard_keywords", [])
                        if all(w in normalized for w in kw.lower().split())
                    ),
                    category.get("guard_keywords", ["policy"])[0],
                )
                violations.append(
                    Violation(
                        category_id=category["id"],
                        label=category["label"],
                        description=category["description"],
                        severity=category.get("severity", "high"),
                        matched_keyword=matched,
                        terms_section=category.get("terms_section"),
                    )
                )

        allowed = len(violations) == 0
        if self.mode == "log_only":
            allowed = True

        return GuardResult(allowed=allowed, violations=violations, mode=self.mode)

    def get_allowed_categories(self) -> list[dict[str, Any]]:
        return self._allowed.get("categories", [])

    def get_not_allowed_categories(self) -> list[dict[str, Any]]:
        return self._not_allowed.get("categories", [])

    def get_restrictions_markdown(self) -> str:
        path = self.restrictions_dir / "RESTRICTIONS.md"
        return path.read_text(encoding="utf-8")
