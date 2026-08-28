"""OpenAI SDK client — retries, tool choice, quality model routing."""

from __future__ import annotations

from typing import Any, AsyncIterator, Iterator

from openai import OpenAI

from config import settings
from local_engine import detect_ollama, pick_best_model, resolve_api_key, resolve_base_url
from prompts import recommended_agent_models


def create_openai_client(api_key: str | None = None, base_url: str | None = None) -> OpenAI:
    url = resolve_base_url(base_url)
    key = resolve_api_key(api_key, url)
    return OpenAI(api_key=key, base_url=url, max_retries=3, timeout=120.0)


def resolve_model(model: str | None, base_url: str | None = None) -> str:
    if model:
        return model
    if settings.local_mode:
        status = detect_ollama(base_url)
        if status["reachable"] and status["models"]:
            picked = pick_best_model(status["models"], preferred=recommended_agent_models())
            if picked:
                return picked
    return settings.glm_model


def resolve_best_agent_model(model: str | None, base_url: str | None = None) -> str:
    """Pick highest-quality available model for agent tool use."""
    if model:
        return model

    url = resolve_base_url(base_url)
    if is_cloud_url(url):
        from prompts import load_training

        cloud = load_training().get("recommended_models", {}).get("agent_cloud", ["glm-5.1"])
        return cloud[0]

    status = detect_ollama(base_url)
    if status["reachable"] and status["models"]:
        picked = pick_best_model(status["models"], preferred=recommended_agent_models())
        if picked:
            return picked
    return settings.glm_model


def is_cloud_url(base_url: str) -> bool:
    lowered = base_url.lower()
    return not any(h in lowered for h in ("127.0.0.1", "localhost", "11434"))


def chat_completion(
    messages: list[dict[str, Any]],
    *,
    model: str | None = None,
    temperature: float = 0.6,
    max_tokens: int | None = None,
    stream: bool = False,
    thinking_enabled: bool = False,
    api_key: str | None = None,
    base_url: str | None = None,
    tools: list[dict[str, Any]] | None = None,
    tool_choice: str | dict[str, Any] | None = None,
) -> Any:
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
        if tool_choice is not None:
            kwargs["tool_choice"] = tool_choice
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
