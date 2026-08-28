"""GLM-5.1 UI API — local-first OpenAI SDK backend."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from agent import load_agent_config, run_agent
from ai_creation import get_creation_by_id, list_by_category, load_creation_catalog
from codebase_index import build_project_brief
from code_checker import format_verify_report, load_checker_config, verify_code
from config import ROOT_DIR, settings
from external_access import ExternalAccessDenied, gate
from loopholes import count_by_used, list_all_loopholes, load_loopholes
from openai_client import chat_completion, create_openai_client, iter_stream_chunks, resolve_model
from pc_builder import PC_BUILDER_SYSTEM_PROMPT, build_custom_prompt, load_presets
from prompts import build_chat_system_prompt, load_training
from restriction_guard import RestrictionGuard
from scripts_commands import load_scripts_config, run_script_file, run_terminal_command
from workspace import get_workspace_root, list_tree, read_file, set_workspace_root, write_file

app = FastAPI(
    title="GLM-5.1 UI",
    description="Coding agent UI — Cursor-like tools, local + internet",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list + ["*"] if settings.local_mode else settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

guard = RestrictionGuard(
    restrictions_dir=settings.restrictions_dir,
    mode=settings.restriction_guard_mode,
)

FRONTEND_DIST = ROOT_DIR / "frontend" / "dist"


def _apply_external_access(internet_enabled: bool | None) -> None:
    gate.resolve_preference(internet_enabled)


def _external_access_error(exc: ExternalAccessDenied) -> HTTPException:
    return HTTPException(
        status_code=403,
        detail={"error": exc.reason, "message": exc.detail},
    )


class ExternalAccessRequest(BaseModel):
    internet_enabled: bool


class Message(BaseModel):
    role: str
    content: str


def _ensure_chat_system(messages: list[Message]) -> list[dict[str, str]]:
    payload = [{"role": m.role, "content": m.content} for m in messages]
    if not any(m["role"] == "system" for m in payload):
        payload.insert(0, {"role": "system", "content": build_chat_system_prompt()})
    return payload


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
    internet_enabled: bool | None = None


class GuardModeRequest(BaseModel):
    mode: str = Field(pattern="^(enforce|log_only|disabled)$")


class TestRunRequest(BaseModel):
    config_path: str | None = None


class PCBuildRequest(BaseModel):
    budget_usd: int | None = Field(default=None, ge=300, le=50000)
    resolution: str = "1440p"
    use_case: str = "aaa-gaming"
    extras: str = ""
    preset_id: str | None = None
    stream: bool = True
    temperature: float = 0.7
    api_key: str | None = None
    base_url: str | None = None
    model: str | None = None
    internet_enabled: bool | None = None


class AgentRequest(BaseModel):
    message: str
    context_files: list[str] = Field(default_factory=list)
    temperature: float | None = None
    api_key: str | None = None
    base_url: str | None = None
    model: str | None = None
    max_iterations: int | None = None
    auto_index: bool = True
    internet_enabled: bool | None = None


class WorkspaceWriteRequest(BaseModel):
    path: str
    content: str


class WorkspaceRootRequest(BaseModel):
    path: str


class ToolRunRequest(BaseModel):
    name: str
    arguments: dict[str, Any] = Field(default_factory=dict)
    internet_enabled: bool | None = None


class VerifyCodeRequest(BaseModel):
    paths: list[str] = Field(default_factory=list)
    languages: list[str] = Field(default_factory=list)


class TerminalRunRequest(BaseModel):
    command: str
    cwd: str = "."
    timeout_seconds: int | None = Field(default=None, ge=1, le=900)


class ScriptRunRequest(BaseModel):
    path: str
    args: str = ""
    cwd: str = "."
    timeout_seconds: int | None = Field(default=None, ge=1, le=900)


@app.get("/api/health")
def health() -> dict[str, Any]:
    status = get_local_status()
    return {
        "status": "ok",
        "local_mode": settings.local_mode,
        "model": status["inference"]["active_model"],
        "ready": status["ready"],
    }


@app.get("/api/config")
def get_config() -> dict[str, Any]:
    status = get_local_status()
    local_cfg = load_local_config()
    return {
        "local_mode": settings.local_mode,
        "model": status["inference"]["active_model"],
        "configured_model": settings.glm_model,
        "base_url": status["inference"]["base_url"],
        "sdk": "openai>=1.0.0",
        "guard_mode": guard.mode,
        "requires_api_key": local_cfg.get("requires_api_key", False),
        "requires_internet": local_cfg.get("requires_internet", False),
        "internet_enabled": gate.internet_enabled,
        "internet_requires_user_approval": True,
        "internet": local_cfg.get("internet", {}),
        "usage_limits": local_cfg.get("usage_limits", {}),
        "workspace_root": str(get_workspace_root()),
        "ready": status["ready"],
        "setup_hint": status.get("setup_hint"),
    }


@app.get("/api/external-access")
def get_external_access() -> dict[str, Any]:
    return {
        "internet_enabled": gate.internet_enabled,
        "requires_user_approval": True,
        "local_inference_always_allowed": True,
    }


@app.post("/api/external-access")
def set_external_access(body: ExternalAccessRequest) -> dict[str, Any]:
    gate.set_user_approval(body.internet_enabled)
    return {
        "internet_enabled": gate.internet_enabled,
        "message": "External connections enabled" if gate.internet_enabled else "External connections blocked — local only",
    }


@app.get("/api/agent/training")
def agent_training() -> dict[str, Any]:
    training = load_training()
    sources_path = ROOT_DIR / "config" / "training-sources.md"
    sources_doc = sources_path.read_text(encoding="utf-8") if sources_path.exists() else ""
    return {**training, "verification_doc": sources_doc}


@app.get("/api/codebase/brief")
def codebase_brief() -> dict[str, str]:
    return {"brief": build_project_brief()}


@app.get("/api/agent/config")
def agent_config() -> dict[str, Any]:
    cfg = load_agent_config()
    training = load_training()
    return {
        "features": cfg.get("features", {}),
        "tools": cfg.get("tools", []),
        "providers": cfg.get("providers", {}),
        "internet": cfg.get("internet", {}),
        "recommended_models": training.get("recommended_models", {}),
        "quality_rules_count": len(training.get("quality_rules", [])),
    }


@app.get("/api/agent/tools")
def agent_tools(internet_enabled: bool | None = None) -> list[dict[str, Any]]:
    _apply_external_access(internet_enabled)
    return get_tool_schemas(internet_enabled=gate.internet_enabled)


@app.post("/api/agent/run")
def agent_run(body: AgentRequest) -> StreamingResponse:
    _apply_external_access(body.internet_enabled)

    def event_generator():
        try:
            for event in run_agent(
                body.message,
                context_files=body.context_files,
                model=body.model,
                api_key=body.api_key,
                base_url=body.base_url,
                temperature=body.temperature,
                max_iterations=body.max_iterations,
                auto_index=body.auto_index,
                internet_enabled=gate.internet_enabled,
            ):
                yield f"data: {json.dumps(event)}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/api/workspace/root")
def workspace_root() -> dict[str, str]:
    return {"root": str(get_workspace_root())}


@app.post("/api/workspace/root")
def set_workspace_root_endpoint(body: WorkspaceRootRequest) -> dict[str, str]:
    try:
        root = set_workspace_root(body.path)
        return {"root": str(root)}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/workspace/tree")
def workspace_tree(path: str = ".") -> dict[str, Any]:
    try:
        return {"path": path, "entries": list_tree(path)}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/workspace/file")
def workspace_read_file(path: str, offset: int = 1, limit: int = 500) -> dict[str, Any]:
    try:
        return read_file(path, offset, limit)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/workspace/file")
def workspace_write_file(body: WorkspaceWriteRequest) -> dict[str, Any]:
    try:
        return write_file(body.path, body.content)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/tools/run")
def run_tool(body: ToolRunRequest) -> dict[str, str]:
    _apply_external_access(body.internet_enabled)
    result = execute_tool(body.name, body.arguments, internet_enabled=gate.internet_enabled)
    return {"name": body.name, "result": result}


@app.get("/api/scripts-commands/config")
def scripts_commands_config() -> dict[str, Any]:
    return load_scripts_config()


@app.post("/api/terminal/run")
def terminal_run(body: TerminalRunRequest) -> dict[str, Any]:
    try:
        return run_terminal_command(body.command, cwd=body.cwd, timeout_seconds=body.timeout_seconds)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/scripts/run")
def script_run(body: ScriptRunRequest) -> dict[str, Any]:
    try:
        return run_script_file(
            body.path,
            args=body.args,
            cwd=body.cwd,
            timeout_seconds=body.timeout_seconds,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/verify/config")
def verify_config() -> dict[str, Any]:
    cfg = load_checker_config()
    return {
        "policy": cfg.get("zero_errors_policy", {}),
        "checkers": cfg.get("checkers", {}),
        "sources": cfg.get("external_sources_reference", []),
    }


@app.post("/api/verify/run")
def verify_run(body: VerifyCodeRequest) -> dict[str, Any]:
    report = verify_code(
        paths=body.paths or None,
        languages=body.languages or None,
    )
    report["formatted"] = format_verify_report(report)
    return report


@app.get("/api/ai/creation/catalog")
def ai_creation_catalog() -> dict[str, Any]:
    catalog = load_creation_catalog()
    catalog["by_category"] = list_by_category()
    return catalog


@app.get("/api/ai/creation/{creation_id}")
def ai_creation_detail(creation_id: str) -> dict[str, Any]:
    item = get_creation_by_id(creation_id)
    if not item:
        raise HTTPException(status_code=404, detail="Creation type not found")
    return item


@app.get("/api/local/status")
def local_status() -> dict[str, Any]:
    return get_local_status()


@app.get("/api/pc-builder/presets")
def pc_builder_presets() -> dict[str, Any]:
    return load_presets()


@app.post("/api/pc-builder/build")
def pc_builder_build(body: PCBuildRequest) -> dict[str, Any]:
    _apply_external_access(body.internet_enabled)
    try:
        gate.ensure_inference_allowed(body.base_url)
    except ExternalAccessDenied as exc:
        raise _external_access_error(exc) from exc

    presets = load_presets()
    prompt = body.extras

    if body.preset_id:
        preset = next((b for b in presets["builds"] if b["id"] == body.preset_id), None)
        if not preset:
            raise HTTPException(status_code=404, detail="Preset not found")
        prompt = preset["prompt"]
        if body.extras.strip():
            prompt += f"\n\nAdditional notes: {body.extras.strip()}"
    elif not prompt.strip():
        use_case_label = next(
            (u["label"] for u in presets["use_cases"] if u["id"] == body.use_case),
            body.use_case,
        )
        prompt = build_custom_prompt(body.budget_usd, body.resolution, use_case_label, body.extras)

    messages = [
        {"role": "system", "content": PC_BUILDER_SYSTEM_PROMPT},
        {"role": "user", "content": prompt},
    ]

    if body.stream:
        raise HTTPException(status_code=400, detail="Use /api/pc-builder/build/stream for streaming")

    try:
        response = chat_completion(
            messages,
            model=body.model,
            temperature=body.temperature,
            max_tokens=8192,
            stream=False,
            api_key=body.api_key,
            base_url=body.base_url,
        )
    except ExternalAccessDenied as exc:
        raise _external_access_error(exc) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    choice = response.choices[0]
    return {
        "content": choice.message.content or "",
        "model": response.model,
        "prompt_used": prompt,
    }


@app.post("/api/pc-builder/build/stream")
def pc_builder_build_stream(body: PCBuildRequest) -> StreamingResponse:
    _apply_external_access(body.internet_enabled)
    try:
        gate.ensure_inference_allowed(body.base_url)
    except ExternalAccessDenied as exc:
        raise _external_access_error(exc) from exc

    presets = load_presets()
    prompt = body.extras

    if body.preset_id:
        preset = next((b for b in presets["builds"] if b["id"] == body.preset_id), None)
        if not preset:
            raise HTTPException(status_code=404, detail="Preset not found")
        prompt = preset["prompt"]
        if body.extras.strip():
            prompt += f"\n\nAdditional notes: {body.extras.strip()}"
    elif not prompt.strip():
        use_case_label = next(
            (u["label"] for u in presets["use_cases"] if u["id"] == body.use_case),
            body.use_case,
        )
        prompt = build_custom_prompt(body.budget_usd, body.resolution, use_case_label, body.extras)

    messages = [
        {"role": "system", "content": PC_BUILDER_SYSTEM_PROMPT},
        {"role": "user", "content": prompt},
    ]

    try:
        stream = chat_completion(
            messages,
            model=body.model,
            temperature=body.temperature,
            max_tokens=8192,
            stream=True,
            api_key=body.api_key,
            base_url=body.base_url,
        )
    except ExternalAccessDenied as exc:
        raise _external_access_error(exc) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    def event_generator():
        try:
            yield f"data: {json.dumps({'prompt': prompt})}\n\n"
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


@app.get("/api/restrictions")
def get_restrictions() -> dict[str, Any]:
    return {
        "allowed": guard.get_allowed_categories(),
        "not_allowed": guard.get_not_allowed_categories(),
        "markdown": guard.get_restrictions_markdown(),
        "guard_mode": guard.mode,
    }


@app.get("/api/loopholes")
def get_loopholes() -> dict[str, Any]:
    cfg = load_loopholes()
    counts = count_by_used()
    return {
        **cfg,
        "summary": {**cfg.get("summary", {}), **counts},
        "flat_list": list_all_loopholes(),
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
    if not body.skip_guard and guard.mode != "disabled":
        guard_result = guard.check(last_user)
        if not guard_result.allowed:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "restriction_violation",
                    "message": "Prompt blocked by local restriction guard.",
                    "violations": [
                        {
                            "category_id": v.category_id,
                            "label": v.label,
                            "severity": v.severity,
                            "matched_keyword": v.matched_keyword,
                        }
                        for v in guard_result.violations
                    ],
                },
            )

    messages_payload = _ensure_chat_system(body.messages)
    _apply_external_access(body.internet_enabled)

    try:
        gate.ensure_inference_allowed(body.base_url)
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
    except ExternalAccessDenied as exc:
        raise _external_access_error(exc) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

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
    if not body.skip_guard and guard.mode != "disabled":
        guard_result = guard.check(last_user)
        if not guard_result.allowed:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "restriction_violation",
                    "violations": [v.category_id for v in guard_result.violations],
                },
            )

    messages_payload = _ensure_chat_system(body.messages)
    _apply_external_access(body.internet_enabled)

    try:
        gate.ensure_inference_allowed(body.base_url)
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
    except ExternalAccessDenied as exc:
        raise _external_access_error(exc) from exc
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
def verify_connection(body: dict[str, Any]) -> dict[str, Any]:
    if "internet_enabled" in body:
        _apply_external_access(bool(body["internet_enabled"]))
    base_url = body.get("base_url") or settings.inference_base_url
    api_key = body.get("api_key")

    try:
        gate.ensure_inference_allowed(base_url)
        client = create_openai_client(api_key=api_key, base_url=base_url)
        model = resolve_model(body.get("model"), base_url)
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "Reply with exactly: OK"}],
            max_tokens=10,
        )
        return {
            "valid": True,
            "model": response.model,
            "sample": (response.choices[0].message.content or "")[:100],
            "local": settings.local_mode,
        }
    except ExternalAccessDenied as exc:
        return {"valid": False, "error": exc.detail, "code": exc.reason}
    except Exception as exc:
        return {"valid": False, "error": str(exc)}


# Serve built frontend from single process (local-only, no separate dev server needed)
if settings.serve_ui and FRONTEND_DIST.is_dir():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/")
    async def serve_index():
        return FileResponse(FRONTEND_DIST / "index.html")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404)
        file_path = FRONTEND_DIST / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(FRONTEND_DIST / "index.html")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=False)
