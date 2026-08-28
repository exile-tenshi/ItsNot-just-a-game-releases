"""GLM-5.1 client using the official OpenAI Python SDK (Z.AI-compatible)."""

from __future__ import annotations

from typing import Any, AsyncIterator, Iterator

from openai import OpenAI

from config import settings


def create_openai_client(api_key: str | None = None, base_url: str | None = None) -> OpenAI:
    """Create an OpenAI client configured for Z.AI's GLM-5.1 endpoint."""
    key = api_key or settings.zai_api_key
    if not key:
        raise ValueError(
            "ZAI_API_KEY is not set. Add it to .env or pass api_key in the request."
        )
    return OpenAI(
        api_key=key,
        base_url=base_url or settings.zai_base_url,
    )


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
    model_name = model or settings.glm_model

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
