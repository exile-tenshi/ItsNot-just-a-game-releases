# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec — GLM-5.1 UI Windows desktop bundle."""

import sys
from pathlib import Path

block_cipher = None
root = Path(SPECPATH).resolve().parent

datas = [
    (str(root / "frontend" / "dist"), "frontend/dist"),
    (str(root / "config"), "config"),
    (str(root / "restrictions"), "restrictions"),
    (str(root / "games"), "games"),
    (str(root / ".env.example"), "."),
]

hiddenimports = [
    "uvicorn.logging",
    "uvicorn.loops",
    "uvicorn.loops.auto",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.websockets",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.lifespan",
    "uvicorn.lifespan.on",
    "uvicorn.lifespan.off",
    "uvicorn.main",
    "uvicorn.config",
    "uvicorn.server",
    "uvicorn.importer",
    "uvicorn.workers",
    "uvicorn.middleware",
    "uvicorn.middleware.proxy_headers",
    "uvicorn.middleware.wsgi",
    "uvicorn.middleware.asgi2",
    "uvicorn.middleware.message_logger",
    "uvicorn.supervisors",
    "uvicorn.supervisors.basereload",
    "uvicorn.supervisors.multiprocess",
    "uvicorn.supervisors.statreload",
    "uvicorn.supervisors.watchfilesreload",
    "uvicorn._subprocess",
    "uvicorn._types",
    "httptools",
    "websockets",
    "websockets.legacy",
    "websockets.legacy.server",
    "watchfiles",
    "pydantic_settings",
    "agent",
    "ai_creation",
    "code_checker",
    "codebase_index",
    "config",
    "external_access",
    "game_studio",
    "local_engine",
    "loopholes",
    "main",
    "openai_client",
    "pc_builder",
    "prompts",
    "restriction_guard",
    "scripts_commands",
    "tools",
    "web_search",
    "workspace",
]

a = Analysis(
    [str(root / "backend" / "launcher.py")],
    pathex=[str(root / "backend")],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="GLM-5.1-UI",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="GLM-5.1-UI",
)
