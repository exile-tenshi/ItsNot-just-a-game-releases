"""GLM-5.1 UI API — OpenAI SDK backend with restriction guard."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from config import settings
from openai_client import chat_completion, create_openai_client, iter_stream_chunks
from restriction_guard import RestrictionGuard

app = FastAPI(
    title="GLM-5.1 UI",
    description="Chat UI for GLM-5.1 via official OpenAI Python SDK (Z.AI-compatible)",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

guard = RestrictionGuard(
    restrictions_dir=settings.restrictions_dir,
    mode=settings.restriction_guard_mode,
)


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[Message]
    temperature: float = Field(default=0.6, ge=0.01, le=1.0)
    max_tokens: int | None = Field(default=None, ge=1)
    stream: bool = False
    thinking_enabled: bool = False
    api_key: str | None = None
    base_url: str | None = None
    model: str | None = None
    skip_guard: bool = False


class GuardModeRequest(BaseModel):
    mode: str = Field(pattern="^(enforce|log_only|disabled)$")


class TestRunRequest(BaseModel):
    config_path: str | None = None


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "model": settings.glm_model}


@app.get("/api/config")
def get_config() -> dict[str, Any]:
    return {
        "model": settings.glm_model,
        "base_url": settings.zai_base_url,
        "sdk": "openai>=1.0.0",
        "guard_mode": guard.mode,
        "has_api_key": bool(settings.zai_api_key),
    }


@app.get("/api/restrictions")
def get_restrictions() -> dict[str, Any]:
    return {
        "allowed": guard.get_allowed_categories(),
        "not_allowed": guard.get_not_allowed_categories(),
        "markdown": guard.get_restrictions_markdown(),
        "guard_mode": guard.mode,
    }


@app.post("/api/guard/mode")
def set_guard_mode(body: GuardModeRequest) -> dict[str, str]:
    guard.reload(mode=body.mode)
    return {"guard_mode": guard.mode}


@app.post("/api/guard/check")
def check_prompt(body: dict[str, str]) -> dict[str, Any]:
    text = body.get("text", "")
    result = guard.check(text)
    return {
        "allowed": result.allowed,
        "mode": result.mode,
        "violations": [
            {
                "category_id": v.category_id,
                "label": v.label,
                "description": v.description,
                "severity": v.severity,
                "matched_keyword": v.matched_keyword,
                "terms_section": v.terms_section,
            }
            for v in result.violations
        ],
    }


@app.post("/api/chat")
def chat(body: ChatRequest) -> dict[str, Any]:
    user_messages = [m for m in body.messages if m.role == "user"]
    if not user_messages:
        raise HTTPException(status_code=400, detail="At least one user message is required")

    last_user = user_messages[-1].content
    if not body.skip_guard:
        guard_result = guard.check(last_user)
        if not guard_result.allowed:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "restriction_violation",
                    "message": "Prompt blocked by local restriction guard (Z.AI policy categories).",
                    "violations": [
                        {
                            "category_id": v.category_id,
                            "label": v.label,
                            "severity": v.severity,
                            "matched_keyword": v.matched_keyword,
                        }
                        for v in guard_result.violations
                    ],
                    "api_error_reference": "1301 — server may also reject unsafe content",
                },
            )

    messages_payload = [{"role": m.role, "content": m.content} for m in body.messages]

    if body.stream:
        raise HTTPException(
            status_code=400,
            detail="Use /api/chat/stream for streaming requests",
        )

    try:
        response = chat_completion(
            messages_payload,
            model=body.model,
            temperature=body.temperature,
            max_tokens=body.max_tokens,
            stream=False,
            thinking_enabled=body.thinking_enabled,
            api_key=body.api_key,
            base_url=body.base_url,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        error_msg = str(exc)
        if "1301" in error_msg or "unsafe" in error_msg.lower():
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "api_content_policy",
                    "message": "Z.AI API rejected content (error 1301 — unsafe/sensitive content).",
                    "detail": error_msg,
                },
            ) from exc
        raise HTTPException(status_code=502, detail=error_msg) from exc

    choice = response.choices[0]
    return {
        "id": response.id,
        "model": response.model,
        "content": choice.message.content or "",
        "role": choice.message.role,
        "finish_reason": choice.finish_reason,
        "usage": {
            "prompt_tokens": response.usage.prompt_tokens if response.usage else None,
            "completion_tokens": response.usage.completion_tokens if response.usage else None,
            "total_tokens": response.usage.total_tokens if response.usage else None,
        },
    }


@app.post("/api/chat/stream")
def chat_stream(body: ChatRequest) -> StreamingResponse:
    user_messages = [m for m in body.messages if m.role == "user"]
    if not user_messages:
        raise HTTPException(status_code=400, detail="At least one user message is required")

    last_user = user_messages[-1].content
    if not body.skip_guard:
        guard_result = guard.check(last_user)
        if not guard_result.allowed:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "restriction_violation",
                    "violations": [v.category_id for v in guard_result.violations],
                },
            )

    messages_payload = [{"role": m.role, "content": m.content} for m in body.messages]

    try:
        stream = chat_completion(
            messages_payload,
            model=body.model,
            temperature=body.temperature,
            max_tokens=body.max_tokens,
            stream=True,
            thinking_enabled=body.thinking_enabled,
            api_key=body.api_key,
            base_url=body.base_url,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    def event_generator():
        try:
            for chunk in iter_stream_chunks(stream):
                yield f"data: {json.dumps({'content': chunk})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/api/tests/config")
def get_test_config() -> dict[str, Any]:
    path = settings.restrictions_test_config
    if not path.exists():
        raise HTTPException(status_code=404, detail="Test config not found")
    with path.open(encoding="utf-8") as f:
        return json.load(f)


@app.post("/api/tests/run")
def run_restriction_tests(body: TestRunRequest | None = None) -> dict[str, Any]:
    config_path = Path(body.config_path) if body and body.config_path else settings.restrictions_test_config
    if not config_path.exists():
        raise HTTPException(status_code=404, detail=f"Config not found: {config_path}")

    with config_path.open(encoding="utf-8") as f:
        test_config = json.load(f)

    results: list[dict[str, Any]] = []
    passed = 0
    failed = 0

    all_tests: list[dict[str, Any]] = []
    all_tests.extend(test_config.get("allowed_tests", []))
    all_tests.extend(test_config.get("not_allowed_tests", []))
    all_tests.extend(test_config.get("edge_case_tests", []))

    for test in all_tests:
        prompt = test["prompt"]
        expect = test["expect"]
        result = guard.check(prompt)
        actual = "pass" if result.allowed else "block"
        ok = actual == expect

        violation_ids = [v.category_id for v in result.violations]
        expected_violation = test.get("expected_violation_id")
        if expect == "block" and expected_violation:
            ok = ok and expected_violation in violation_ids

        if ok:
            passed += 1
        else:
            failed += 1

        results.append(
            {
                "id": test.get("id"),
                "description": test.get("description"),
                "prompt": prompt,
                "expect": expect,
                "actual": actual,
                "passed": ok,
                "violations": violation_ids,
                "expected_violation_id": expected_violation,
                "category": test.get("category"),
            }
        )

    return {
        "summary": {
            "total": len(results),
            "passed": passed,
            "failed": failed,
            "guard_mode": guard.mode,
            "config_path": str(config_path),
        },
        "results": results,
    }


@app.post("/api/verify-key")
def verify_api_key(body: dict[str, str]) -> dict[str, Any]:
    api_key = body.get("api_key") or settings.zai_api_key
    base_url = body.get("base_url") or settings.zai_base_url
    if not api_key:
        raise HTTPException(status_code=400, detail="API key required")

    try:
        client = create_openai_client(api_key=api_key, base_url=base_url)
        response = client.chat.completions.create(
            model=settings.glm_model,
            messages=[{"role": "user", "content": "Reply with exactly: OK"}],
            max_tokens=10,
        )
        return {
            "valid": True,
            "model": response.model,
            "sample": (response.choices[0].message.content or "")[:100],
        }
    except Exception as exc:
        return {"valid": False, "error": str(exc)}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=True)
