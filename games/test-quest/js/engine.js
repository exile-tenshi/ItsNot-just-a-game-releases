const M = window.GAME_MANIFEST;
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
