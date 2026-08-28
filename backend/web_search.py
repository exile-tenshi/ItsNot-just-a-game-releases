"""Internet access — web search and URL fetching."""

from __future__ import annotations

import re
from html import unescape
from typing import Any
from urllib.parse import quote_plus, urlparse
from urllib.request import Request, urlopen

USER_AGENT = "GLM-5.1-UI/2.0 (Coding Agent)"


def web_search(query: str, max_results: int = 8) -> list[dict[str, str]]:
    """Search the web via DuckDuckGo HTML (no API key required)."""
    url = f"https://html.duckduckgo.com/html/?q={quote_plus(query)}"
    req = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(req, timeout=15) as resp:
        html = resp.read().decode("utf-8", errors="replace")

    results: list[dict[str, str]] = []
    # Parse result blocks
    blocks = re.findall(
        r'class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>.*?class="result__snippet"[^>]*>(.*?)</',
        html,
        re.DOTALL,
    )
    for href, title, snippet in blocks[:max_results]:
        clean_title = unescape(re.sub(r"<[^>]+>", "", title)).strip()
        clean_snippet = unescape(re.sub(r"<[^>]+>", "", snippet)).strip()
        # DuckDuckGo redirect URLs
        if "uddg=" in href:
            from urllib.parse import parse_qs, urlparse as up

            qs = parse_qs(up(href).query)
            href = qs.get("uddg", [href])[0]
        results.append({"title": clean_title, "url": href, "snippet": clean_snippet})

    if not results:
        results.append(
            {
                "title": "Search completed",
                "url": url,
                "snippet": f"No parsed results for: {query}. Try fetch_url on a known docs site.",
            }
        )
    return results


def fetch_url(url: str, max_bytes: int = 100_000) -> dict[str, Any]:
    """Fetch a URL and return readable text content."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("Only http/https URLs allowed")

    req = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(req, timeout=20) as resp:
        raw = resp.read(max_bytes)
        content_type = resp.headers.get("Content-Type", "")

    text = raw.decode("utf-8", errors="replace")
    if "html" in content_type.lower():
        text = re.sub(r"<script[^>]*>.*?</script>", "", text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r"<[^>]+>", " ", text)
        text = unescape(re.sub(r"\s+", " ", text)).strip()

    return {
        "url": url,
        "content_type": content_type,
        "length": len(text),
        "content": text[:max_bytes],
    }
