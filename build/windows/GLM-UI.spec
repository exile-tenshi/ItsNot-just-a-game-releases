# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for GLM-5.1 UI Windows desktop build."""

import os
from pathlib import Path

block_cipher = None
root = Path(SPECPATH).resolve().parent.parent

datas = [
    (str(root / "frontend" / "dist"), "frontend/dist"),
    (str(root / "config"), "config"),
    (str(root / "restrictions"), "restrictions"),
]

backend = root / "backend"
hiddenimports = [
    "main",
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
    "agent",
    "ai_creation",
    "code_checker",
    "codebase_index",
    "config",
    "external_access",
    "game_studio",
    "local_engine",
    "loopholes",
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
    [str(root / "launcher.py")],
    pathex=[str(backend)],
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
