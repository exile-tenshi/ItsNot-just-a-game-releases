"""Video game studio — create full games from scratch (Three.js 3D + multiplayer foundation)."""

from __future__ import annotations

import json
import math
import random
import re
from pathlib import Path
from typing import Any

from config import ROOT_DIR
from workspace import get_workspace_root, write_file

CONFIG_PATH = ROOT_DIR / "config" / "game-studio.json"
PRESETS_PATH = ROOT_DIR / "config" / "game-studio-presets.json"

GAME_STUDIO_SYSTEM_PROMPT = """You are an expert game developer and technical director. You create complete video games from scratch.

You can build EVERY aspect of a game:
- Characters (player, NPCs, enemies) with stats, appearance, abilities
- Gameplay systems (inventory, quests, combat, weapons, vehicles, scoring)
- Multiplayer (WebSocket server + client sync)
- 3D models (procedural meshes, scene objects)
- Textures and images (procedural + asset pipeline)
- Foundation (engine loop, input, camera, lighting, UI)
- Terrain (heightmaps, biomes, procedural generation)
- Roads (splines, grid networks)
- Maps (spawn points, zones, POIs, world layout)

Use game_studio agent tools or write files under games/<project-name>/.
Always regenerate playable files. Three.js for 3D. README with:
  cd games/<name> && python3 -m http.server 8080
  python3 server/multiplayer_server.py  (if multiplayer)
"""


def load_game_config() -> dict[str, Any]:
    with CONFIG_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def load_presets() -> dict[str, Any]:
    with PRESETS_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def _slug(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "my-game"


def _project_dir(project: str) -> Path:
    cfg = load_game_config()
    return get_workspace_root() / cfg.get("output_directory", "games") / _slug(project)


def _default_manifest(name: str, genre: str = "sandbox", dimension: str = "3d") -> dict[str, Any]:
    engine = "threejs" if dimension == "3d" else "canvas2d"
    return {
        "name": name,
        "slug": _slug(name),
        "version": "1.0.0",
        "engine": engine,
        "genre": genre,
        "dimension": dimension,
        "characters": [],
        "features": [],
        "gameplay": {"camera": "third-person" if dimension == "3d" else "top-down", "controls": "wasd"},
        "terrain": None,
        "map": None,
        "roads": [],
        "textures": [],
        "models": [],
        "multiplayer": {"enabled": False, "port": 8765, "max_players": 16},
        "objects": [],
    }


def _load_manifest(project: str) -> dict[str, Any]:
    path = _project_dir(project) / "game.json"
    if not path.exists():
        raise FileNotFoundError(f"Game project not found: {project}")
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def _save_manifest(project: str, manifest: dict[str, Any]) -> Path:
    proj = _project_dir(project)
    proj.mkdir(parents=True, exist_ok=True)
    path = proj / "game.json"
    path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return path


def _heightmap(width: int, height: int, seed: int, style: str) -> list[list[float]]:
    grid = [[0.0 for _ in range(width)] for _ in range(height)]
    for y in range(height):
        for x in range(width):
            nx, ny = x / width, y / height
            h = math.sin(nx * 12 + seed) * 0.3 + math.cos(ny * 10 + seed * 0.7) * 0.25
            if style == "mountains":
                h += math.exp(-((nx - 0.5) ** 2 + (ny - 0.5) ** 2) * 8) * 2.0
            elif style == "flat":
                h *= 0.2
            grid[y][x] = round(max(0, h * 20), 2)
    return grid


def _threejs_html() -> str:
    return """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title id="game-title">Game</title>
  <style>
    * { margin: 0; box-sizing: border-box; }
    body { overflow: hidden; background: #0a0a12; font-family: system-ui, sans-serif; }
    #hud { position: fixed; top: 12px; left: 12px; color: #fff; text-shadow: 0 1px 4px #000; z-index: 10; }
    #multiplayer-status { position: fixed; top: 12px; right: 12px; color: #8cf; font-size: 12px; }
  </style>
</head>
<body>
  <div id="hud"><h1 id="game-name">Game</h1><div id="features"></div><p id="player-info"></p></div>
  <div id="multiplayer-status"></div>
  <script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>
  <script src="game-data.js"></script>
  <script src="js/engine.js"></script>
</body>
</html>
"""


def _engine_js() -> str:
    return r"""const M = window.GAME_MANIFEST;
document.getElementById('game-name').textContent = M.name;
document.getElementById('game-title').textContent = M.name;
document.getElementById('features').innerHTML = (M.features || [])
  .map(f => `<span style="margin-right:8px">• ${f}</span>`).join('');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 80, 400);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
const light = new THREE.DirectionalLight(0xffffff, 1.2);
light.position.set(50, 100, 50);
light.castShadow = true;
scene.add(light);
scene.add(new THREE.AmbientLight(0x666688, 0.5));

const texCache = {};
function procTexture(id, c1, c2) {
  if (texCache[id]) return texCache[id];
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  for (let i = 0; i < 64; i++) for (let j = 0; j < 64; j++) {
    g.fillStyle = (i + j) % 8 < 4 ? c1 : c2;
    g.fillRect(i, j, 1, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return texCache[id] = t;
}
(M.textures || []).forEach(t => procTexture(t.id, t.color1 || '#3a5', t.color2 || '#2a4'));

const playerDef = (M.characters || []).find(c => c.role === 'player') ||
  { name: 'Hero', color: '#4488ff', speed: 8, health: 100 };
let playerHealth = playerDef.health || 100;
const player = new THREE.Group();
const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1.2, 4, 8),
  new THREE.MeshStandardMaterial({ color: playerDef.color || 0x4488ff }));
body.castShadow = true;
player.add(body);
player.position.set(0, 5, 0);
scene.add(player);

(M.characters || []).filter(c => c.role !== 'player').forEach((c, i) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.6, 0.8),
    new THREE.MeshStandardMaterial({ color: c.color || 0xff4444 }));
  m.position.set((i + 1) * 4, 3, (i % 2) * 4);
  m.castShadow = true;
  scene.add(m);
});

if (M.terrain) {
  const tw = M.terrain.width, th = M.terrain.height, hs = M.terrain.heights;
  const geo = new THREE.PlaneGeometry(tw, th, tw - 1, th - 1);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const ix = i % tw, iy = Math.floor(i / tw);
    pos.setY(i, (hs[iy] && hs[iy][ix]) || 0);
  }
  geo.computeVertexNormals();
  const grass = procTexture('grass', '#3a7a3a', '#2d6b2d');
  grass.repeat.set(tw / 4, th / 4);
  scene.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: grass })));
} else {
  const g = new THREE.Mesh(new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({ color: 0x3a7a3a }));
  g.rotation.x = -Math.PI / 2;
  scene.add(g);
}

(M.roads || []).forEach(road => {
  const pts = road.points || [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, z1] = pts[i], [x2, z2] = pts[i + 1];
    const len = Math.hypot(x2 - x1, z2 - z1);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(road.width || 4, 0.15, len),
      new THREE.MeshStandardMaterial({ color: 0x333333 }));
    mesh.position.set((x1 + x2) / 2, 0.1, (z1 + z2) / 2);
    mesh.rotation.y = Math.atan2(x2 - x1, z2 - z1);
    scene.add(mesh);
  }
});

(M.models || []).forEach((md, i) => {
  let geo = new THREE.BoxGeometry(...(md.scale || [1, 1, 1]));
  if (md.shape === 'sphere') geo = new THREE.SphereGeometry(md.radius || 1, 16, 16);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: md.color || 0x888888 }));
  mesh.position.set(...(md.position || [i * 3, 2, -5]));
  scene.add(mesh);
});

if (M.map && M.map.spawn) player.position.set(M.map.spawn[0], M.map.spawn[1], M.map.spawn[2]);

const keys = {};
addEventListener('keydown', e => keys[e.code] = true);
addEventListener('keyup', e => keys[e.code] = false);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

let mpSocket = null;
const remotePlayers = {};
if (M.multiplayer && M.multiplayer.enabled) {
  const status = document.getElementById('multiplayer-status');
  const port = M.multiplayer.port || 8765;
  mpSocket = new WebSocket(`ws://${location.hostname}:${port}`);
  mpSocket.onopen = () => { status.textContent = 'Multiplayer: connected'; };
  mpSocket.onclose = () => { status.textContent = 'Multiplayer: run server/multiplayer_server.py'; };
  mpSocket.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.players) Object.entries(msg.players).forEach(([id, p]) => {
      if (id === msg.self) return;
      if (!remotePlayers[id]) {
        remotePlayers[id] = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.8, 0.8),
          new THREE.MeshStandardMaterial({ color: 0xffaa00 }));
        scene.add(remotePlayers[id]);
      }
      remotePlayers[id].position.set(p.x, p.y, p.z);
    });
  };
}

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  const spd = (playerDef.speed || 8) * dt;
  if (keys['KeyW']) player.position.z -= spd;
  if (keys['KeyS']) player.position.z += spd;
  if (keys['KeyA']) player.position.x -= spd;
  if (keys['KeyD']) player.position.x += spd;
  if (keys['Space']) player.position.y += spd * 2;
  player.position.y = Math.max(1, player.position.y - dt * 5);
  camera.position.set(player.position.x, player.position.y + 8, player.position.z + 14);
  camera.lookAt(player.position);
  if (mpSocket && mpSocket.readyState === 1) {
    mpSocket.send(JSON.stringify({ type: 'move', x: player.position.x, y: player.position.y, z: player.position.z }));
  }
  document.getElementById('player-info').textContent = `${playerDef.name} HP:${playerHealth} | WASD Space`;
  renderer.render(scene, camera);
}
animate();
"""


def _multiplayer_server_py(port: int, max_players: int) -> str:
    return f'''"""Multiplayer server — pip install websockets && python3 server/multiplayer_server.py"""
from __future__ import annotations
import asyncio, json
try:
    import websockets
except ImportError:
    raise SystemExit("pip install websockets")
PORT, MAX = {port}, {max_players}
CLIENTS: dict = {{}}
STATE: dict = {{}}

async def broadcast(exclude=None):
    for pid, ws in list(CLIENTS.items()):
        if pid != exclude:
            try:
                await ws.send(json.dumps({{"type": "state", "self": pid, "players": STATE}}))
            except Exception:
                pass

async def handler(ws):
    if len(CLIENTS) >= MAX:
        await ws.close(1013, "full")
        return
    pid = str(id(ws))
    CLIENTS[pid] = ws
    STATE[pid] = {{"x": 0, "y": 5, "z": 0}}
    await ws.send(json.dumps({{"type": "state", "self": pid, "players": STATE}}))
    try:
        async for raw in ws:
            msg = json.loads(raw)
            if msg.get("type") == "move":
                STATE[pid].update(x=msg["x"], y=msg["y"], z=msg["z"])
                await broadcast(exclude=pid)
    finally:
        CLIENTS.pop(pid, None)
        STATE.pop(pid, None)

async def main():
    print(f"ws://0.0.0.0:{{PORT}}")
    async with websockets.serve(handler, "0.0.0.0", PORT):
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())
'''


def regenerate_playable(project: str) -> dict[str, Any]:
    manifest = _load_manifest(project)
    slug = manifest["slug"]
    base = f"games/{slug}"
    files_written: list[str] = []

    def w(path: str, content: str) -> None:
        write_file(path, content)
        files_written.append(path)

    w(f"{base}/game.json", json.dumps(manifest, indent=2))
    w(f"{base}/game-data.js", f"window.GAME_MANIFEST = {json.dumps(manifest)};\n")
    w(f"{base}/index.html", _threejs_html())
    w(f"{base}/js/engine.js", _engine_js())
    if manifest.get("multiplayer", {}).get("enabled"):
        w(f"{base}/server/multiplayer_server.py",
          _multiplayer_server_py(manifest["multiplayer"].get("port", 8765),
                                 manifest["multiplayer"].get("max_players", 16)))
    w(f"{base}/README.md", f"# {manifest['name']}\n\nPlay: `cd games/{slug} && python3 -m http.server 8080`\n")
    return {"project": slug, "files_written": files_written}


def create_project(name: str, genre: str = "sandbox", dimension: str = "3d",
                   features: list[str] | None = None) -> dict[str, Any]:
    slug = _slug(name)
    manifest = _default_manifest(name, genre, dimension)
    if features:
        manifest["features"] = features
    manifest["characters"].append({
        "id": "player-1", "name": "Hero", "role": "player", "health": 100,
        "speed": 10, "color": "#4488ff", "mesh": "capsule", "abilities": ["move", "jump"],
    })
    manifest["textures"] = [
        {"id": "grass", "type": "grass", "color1": "#3a7a3a", "color2": "#2d6b2d"},
        {"id": "road", "type": "road", "color1": "#444444", "color2": "#333333"},
    ]
    _save_manifest(slug, manifest)
    reg = regenerate_playable(slug)
    return {"created": True, "slug": slug, "manifest": manifest, **reg}


def add_character(project: str, name: str, role: str = "npc", health: int = 50,
                  speed: float = 5, color: str = "#ff6644", mesh: str = "box",
                  abilities: list[str] | None = None) -> dict[str, Any]:
    manifest = _load_manifest(project)
    char = {"id": f"{_slug(name)}-{len(manifest['characters'])}", "name": name, "role": role,
            "health": health, "speed": speed, "color": color, "mesh": mesh,
            "abilities": abilities or []}
    manifest["characters"].append(char)
    _save_manifest(project, manifest)
    return {"character": char, **regenerate_playable(project)}


def add_feature(project: str, feature: str, config: dict[str, Any] | None = None) -> dict[str, Any]:
    manifest = _load_manifest(project)
    if feature not in manifest["features"]:
        manifest["features"].append(feature)
    if config:
        manifest.setdefault("feature_config", {})[feature] = config
    _save_manifest(project, manifest)
    return {"feature": feature, **regenerate_playable(project)}


def generate_terrain(project: str, width: int = 128, height: int = 128,
                     seed: int = 42, style: str = "hills") -> dict[str, Any]:
    max_size = load_game_config().get("capabilities", {}).get("terrain", {}).get("max_size", 512)
    width, height = min(max(width, 16), max_size), min(max(height, 16), max_size)
    manifest = _load_manifest(project)
    manifest["terrain"] = {"width": width, "height": height, "seed": seed, "style": style,
                           "heights": _heightmap(width, height, seed, style)}
    _save_manifest(project, manifest)
    return {"terrain": {"width": width, "height": height, "style": style}, **regenerate_playable(project)}


def generate_map(project: str, name: str = "World", size: int = 200,
                 spawn: list[float] | None = None) -> dict[str, Any]:
    manifest = _load_manifest(project)
    manifest["map"] = {
        "name": name, "size": size, "spawn": spawn or [0, 8, 0],
        "zones": [{"id": "town", "label": "Town", "center": [0, 0], "radius": 20}],
        "pois": [{"id": "portal", "label": "Portal", "position": [30, 5, 30]}],
    }
    _save_manifest(project, manifest)
    return {"map": manifest["map"], **regenerate_playable(project)}


def add_roads(project: str, roads: list[dict[str, Any]] | None = None,
              grid_size: int | None = None) -> dict[str, Any]:
    manifest = _load_manifest(project)
    if roads:
        manifest["roads"].extend(roads)
    elif grid_size:
        for i in range(-2, 3):
            step = grid_size
            manifest["roads"].append({"id": f"h{i}", "width": 4, "points": [[-100, i * step], [100, i * step]]})
            manifest["roads"].append({"id": f"v{i}", "width": 4, "points": [[i * step, -100], [i * step, 100]]})
    else:
        manifest["roads"].append({"id": "main", "width": 5, "points": [[-60, 0], [0, 0], [80, 20]]})
    _save_manifest(project, manifest)
    return {"roads_count": len(manifest["roads"]), **regenerate_playable(project)}


def setup_multiplayer(project: str, enabled: bool = True, port: int = 8765,
                      max_players: int = 16) -> dict[str, Any]:
    manifest = _load_manifest(project)
    manifest["multiplayer"] = {"enabled": enabled, "port": port, "max_players": max_players}
    if enabled and "multiplayer" not in manifest["features"]:
        manifest["features"].append("multiplayer")
    _save_manifest(project, manifest)
    return {"multiplayer": manifest["multiplayer"], **regenerate_playable(project)}


def add_asset(project: str, asset_type: str, asset_id: str, shape: str = "box",
              color: str = "#888888", scale: list[float] | None = None,
              position: list[float] | None = None, texture_type: str = "custom",
              color1: str = "#888888", color2: str = "#666666") -> dict[str, Any]:
    manifest = _load_manifest(project)
    if asset_type == "texture":
        manifest["textures"].append({"id": asset_id, "type": texture_type, "color1": color1, "color2": color2})
    else:
        manifest["models"].append({"id": asset_id, "shape": shape, "color": color,
                                   "scale": scale or [1, 1, 1], "position": position or [0, 2, 0]})
    _save_manifest(project, manifest)
    return {"asset_type": asset_type, "id": asset_id, **regenerate_playable(project)}


def list_projects() -> list[dict[str, Any]]:
    games_dir = get_workspace_root() / load_game_config().get("output_directory", "games")
    if not games_dir.is_dir():
        return []
    out = []
    for path in sorted(games_dir.iterdir()):
        if path.is_dir() and (path / "game.json").is_file():
            with (path / "game.json").open(encoding="utf-8") as f:
                m = json.load(f)
            out.append({"slug": path.name, "name": m.get("name"), "genre": m.get("genre"),
                        "features": m.get("features", []), "multiplayer": m.get("multiplayer", {}).get("enabled")})
    return out


def build_design_prompt(preset_id: str | None = None, extras: str = "") -> str:
    if preset_id:
        preset = next((p for p in load_presets().get("presets", []) if p["id"] == preset_id), None)
        if preset:
            return preset["prompt"] + (f"\n\nAdditional: {extras}" if extras.strip() else "")
    return extras.strip() or "Create a full 3D game with characters, terrain, roads, map, and multiplayer."
