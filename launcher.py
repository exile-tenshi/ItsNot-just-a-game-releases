"""GLM-5.1 UI desktop launcher — starts the API server and opens the browser."""

from __future__ import annotations

import os
import socket
import sys
import threading
import time
import webbrowser
from pathlib import Path


def _resolve_dirs() -> tuple[Path, Path]:
    if getattr(sys, "frozen", False):
        bundle = Path(getattr(sys, "_MEIPASS", Path(sys.executable).parent))
        app_dir = Path(sys.executable).resolve().parent
        return bundle, app_dir
    root = Path(__file__).resolve().parent
    return root, root


def _pick_port(preferred: int = 8000) -> int:
    for port in range(preferred, preferred + 20):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                sock.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    return preferred


def main() -> None:
    bundle_dir, app_dir = _resolve_dirs()

    os.chdir(app_dir)
    os.environ.setdefault("GLM_BUNDLE_DIR", str(bundle_dir))
    os.environ.setdefault("GLM_APP_DIR", str(app_dir))
    os.environ.setdefault("SERVE_UI", "true")
    os.environ.setdefault("LOCAL_MODE", "true")

    backend_dir = bundle_dir / "backend"
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))

    port = _pick_port(8000)
    url = f"http://127.0.0.1:{port}"

    def _open_browser() -> None:
        time.sleep(1.8)
        webbrowser.open(url)

    threading.Thread(target=_open_browser, daemon=True).start()

    import uvicorn

    print(f"GLM-5.1 UI starting at {url}")
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=False, log_level="info")


if __name__ == "__main__":
    main()
