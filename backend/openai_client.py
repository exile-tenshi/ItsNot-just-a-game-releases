"""OpenAI SDK client — local Ollama first, optional cloud fallback."""

from __future__ import annotations

from typing import Any, AsyncIterator, Iterator

from openai import OpenAI

from config import settings
from local_engine import pick_best_model, resolve_api_key, resolve_base_url


def create_openai_client(api_key: str | None = None, base_url: str | None = None) -> OpenAI:
    """Create OpenAI client for local or remote OpenAI-compatible servers."""
    url = resolve_base_url(base_url)
    key = resolve_api_key(api_key, url)
    return OpenAI(api_key=key, base_url=url)


def resolve_model(model: str | None, base_url: str | None = None) -> str:
    if model:
        return model
    if settings.local_mode:
        from local_engine import detect_ollama

        status = detect_ollama(base_url)
        if status["reachable"] and status["models"]:
            picked = pick_best_model(status["models"])
            if picked:
                return picked
    return settings.glm_model


def chat_completion(
    messages: list[dict[str, str]],
    *,
    model: str | None = None,
    temperature: float = 0.6,
    max_tokens: int | None = None,
    stream: bool = False,
    thinking_enabled: bool = False,
    api_key: str | None = None,
    base_url: str | None = None,
    tools: list[dict[str, Any]] | None = None,
) -> Any:
    """Non-streaming or streaming chat completion via official OpenAI SDK."""
    client = create_openai_client(api_key=api_key, base_url=base_url)
    model_name = resolve_model(model, base_url)

    extra_body: dict[str, Any] = {}
    if thinking_enabled:
        extra_body["thinking"] = {"type": "enabled"}

    kwargs: dict[str, Any] = {
        "model": model_name,
        "messages": messages,
        "temperature": temperature,
        "stream": stream,
    }
    if max_tokens is not None:
        kwargs["max_tokens"] = max_tokens
    if tools:
        kwargs["tools"] = tools
    if extra_body:
        kwargs["extra_body"] = extra_body

    return client.chat.completions.create(**kwargs)


def iter_stream_chunks(stream: Iterator[Any]) -> Iterator[str]:
    for chunk in stream:
        delta = chunk.choices[0].delta
        if delta.content:
            yield delta.content


async def async_iter_stream_chunks(stream: AsyncIterator[Any]) -> AsyncIterator[str]:
    for chunk in stream:
        delta = chunk.choices[0].delta
        if delta.content:
            yield delta.content
