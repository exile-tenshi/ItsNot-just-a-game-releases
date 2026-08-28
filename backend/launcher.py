"""GLM-5.1 UI desktop launcher — starts the local server and opens the browser."""

from __future__ import annotations

import os
import sys
import threading
import time
import webbrowser
from pathlib import Path


def _resolve_root() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).parent
    return Path(__file__).resolve().parent.parent


ROOT = _resolve_root()
os.chdir(ROOT)
os.environ["GLM_UI_ROOT"] = str(ROOT)

backend_dir = ROOT / "backend" if (ROOT / "backend" / "main.py").is_file() else ROOT
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))


def _open_browser(port: int) -> None:
    url = f"http://127.0.0.1:{port}"
    for _ in range(30):
        time.sleep(0.5)
        try:
            import urllib.request

            with urllib.request.urlopen(f"{url}/api/config", timeout=1):
                webbrowser.open(url)
                return
        except OSError:
            continue
    webbrowser.open(url)


def main() -> None:
    from config import settings

    port = settings.port
    host = "127.0.0.1"
    threading.Thread(target=_open_browser, args=(port,), daemon=True).start()

    import uvicorn

    print(f"GLM-5.1 UI running at http://{host}:{port}")
    print("Close this window to stop the server.")
    uvicorn.run("main:app", host=host, port=port, reload=False, log_level="info")


if __name__ == "__main__":
    main()
