import * as THREE from 'three';

/* ============================================================
   Marathon Runner 3D — a web-based animated marathon race game
   1 world meter = 10 marathon meters → 4220 world m = 42.2 km
   ============================================================ */

const WORLD_TO_KM = 10 / 1000;           // world meters → marathon km
// world meters (= 42.2 km); override with ?course=<meters> for a shorter race
const COURSE_LENGTH =
  Number(new URLSearchParams(location.search).get('course')) || 4220;
const ROAD_WIDTH = 12;
const LANE_LIMIT = 5;                    // max |x| for runners
const CHUNK_LEN = 100;
const NUM_CHUNKS = 8;                    // recycled scenery chunks
const WATER_INTERVAL = 500;              // world m between aid stations

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87c5eb);
scene.fog = new THREE.Fog(0x87c5eb, 90, 320);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 600);

// ---------- lights ----------
scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x557755, 0.9));
const sun = new THREE.DirectionalLight(0xfff2d9, 1.6);
sun.position.set(-40, 70, -30);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -60;
sun.shadow.camera.right = 60;
sun.shadow.camera.top = 60;
sun.shadow.camera.bottom = -60;
sun.shadow.camera.far = 220;
scene.add(sun);
scene.add(sun.target);

// ---------- shared materials / geometries ----------
const MAT = {
  road: new THREE.MeshLambertMaterial({ color: 0x3d4450 }),
  line: new THREE.MeshBasicMaterial({ color: 0xe8e8e8 }),
  grass: new THREE.MeshLambertMaterial({ color: 0x5da24c }),
  curb: new THREE.MeshLambertMaterial({ color: 0xb8bcc4 }),
  trunk: new THREE.MeshLambertMaterial({ color: 0x6b4a2b }),
  leaf: new THREE.MeshLambertMaterial({ color: 0x3e7d32 }),
  leaf2: new THREE.MeshLambertMaterial({ color: 0x559944 }),
  table: new THREE.MeshLambertMaterial({ color: 0x2277cc }),
  cup: new THREE.MeshLambertMaterial({ color: 0xffffff }),
  barrier: new THREE.MeshLambertMaterial({ color: 0xdddddd }),
  archPost: new THREE.MeshLambertMaterial({ color: 0xdd3344 }),
  skin: new THREE.MeshLambertMaterial({ color: 0xd9a066 }),
};

const GEO = {
  trunk: new THREE.CylinderGeometry(0.25, 0.35, 2.2, 6),
  leaf: new THREE.ConeGeometry(1.6, 3.2, 7),
  crowdBody: new THREE.BoxGeometry(0.55, 1.1, 0.4),
  crowdHead: new THREE.SphereGeometry(0.24, 8, 8),
  building: new THREE.BoxGeometry(1, 1, 1),
};

// ============================================================
// Ground + road (long static strips, cheap)
// ============================================================
{
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(600, COURSE_LENGTH + 800),
    MAT.grass
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.02, COURSE_LENGTH / 2);
  ground.receiveShadow = true;
  scene.add(ground);

  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(ROAD_WIDTH, COURSE_LENGTH + 200),
    MAT.road
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0, COURSE_LENGTH / 2);
  road.receiveShadow = true;
  scene.add(road);

  for (const x of [-ROAD_WIDTH / 2 - 0.3, ROAD_WIDTH / 2 + 0.3]) {
    const curb = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.22, COURSE_LENGTH + 200),
      MAT.curb
    );
    curb.position.set(x, 0.11, COURSE_LENGTH / 2);
    scene.add(curb);
  }
}

// ============================================================
// Recycled scenery chunks: dashes, trees, crowd, buildings
// ============================================================
const chunks = [];

function rand(a, b) { return a + Math.random() * (b - a); }

function makeChunk(index) {
  const g = new THREE.Group();

  // center dashed line
  for (let z = 2; z < CHUNK_LEN; z += 8) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 3.2), MAT.line);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(0, 0.01, z);
    g.add(dash);
  }
  // edge lines
  for (const x of [-ROAD_WIDTH / 2 + 0.4, ROAD_WIDTH / 2 - 0.4]) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.22, CHUNK_LEN), MAT.line);
    line.rotation.x = -Math.PI / 2;
    line.position.set(x, 0.01, CHUNK_LEN / 2);
    g.add(line);
  }

  // barriers along both sides
  for (const side of [-1, 1]) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.9, CHUNK_LEN),
      MAT.barrier
    );
    bar.position.set(side * (ROAD_WIDTH / 2 + 1.1), 0.55, CHUNK_LEN / 2);
    g.add(bar);
  }

  // trees
  for (let i = 0; i < 10; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(GEO.trunk, MAT.trunk);
    trunk.position.y = 1.1;
    const leaf = new THREE.Mesh(GEO.leaf, i % 3 === 0 ? MAT.leaf2 : MAT.leaf);
    leaf.position.y = 3.4;
    leaf.castShadow = true;
    tree.add(trunk, leaf);
    const s = rand(0.8, 1.5);
    tree.scale.setScalar(s);
    tree.position.set(side * rand(11, 26), 0, rand(0, CHUNK_LEN));
    g.add(tree);
  }

  // buildings further out (alternating city blocks)
  for (let i = 0; i < 6; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const h = rand(6, 22);
    const b = new THREE.Mesh(
      GEO.building,
      new THREE.MeshLambertMaterial({
        color: new THREE.Color().setHSL(rand(0.05, 0.65), 0.25, rand(0.45, 0.7)),
      })
    );
    b.scale.set(rand(6, 12), h, rand(8, 16));
    b.position.set(side * rand(32, 55), h / 2, rand(0, CHUNK_LEN));
    g.add(b);
  }

  // cheering crowd (instanced, bobbing)
  const crowdCount = 26;
  const crowd = new THREE.InstancedMesh(GEO.crowdBody, undefined, crowdCount);
  crowd.material = new THREE.MeshLambertMaterial();
  const heads = new THREE.InstancedMesh(GEO.crowdHead, MAT.skin, crowdCount);
  const crowdData = [];
  const color = new THREE.Color();
  for (let i = 0; i < crowdCount; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    crowdData.push({
      x: side * rand(ROAD_WIDTH / 2 + 1.9, ROAD_WIDTH / 2 + 4.5),
      z: rand(0, CHUNK_LEN),
      phase: rand(0, Math.PI * 2),
      speed: rand(4, 9),
    });
    color.setHSL(Math.random(), 0.7, 0.55);
    crowd.setColorAt(i, color);
  }
  g.add(crowd, heads);

  g.userData = { crowd, heads, crowdData, index };
  scene.add(g);
  return g;
}

const dummy = new THREE.Object3D();

function animateChunkCrowd(chunk, t) {
  const { crowd, heads, crowdData } = chunk.userData;
  for (let i = 0; i < crowdData.length; i++) {
    const d = crowdData[i];
    const hop = Math.abs(Math.sin(t * d.speed + d.phase)) * 0.35;
    dummy.position.set(d.x, 0.55 + hop, d.z);
    dummy.rotation.set(0, d.x > 0 ? -Math.PI / 2 : Math.PI / 2, 0);
    dummy.updateMatrix();
    crowd.setMatrixAt(i, dummy.matrix);
    dummy.position.y = 1.35 + hop;
    dummy.updateMatrix();
    heads.setMatrixAt(i, dummy.matrix);
  }
  crowd.instanceMatrix.needsUpdate = true;
  heads.instanceMatrix.needsUpdate = true;
}

for (let i = 0; i < NUM_CHUNKS; i++) {
  const c = makeChunk(i);
  c.position.z = i * CHUNK_LEN;
  chunks.push(c);
}

function recycleChunks(playerZ) {
  for (const c of chunks) {
    if (c.position.z + CHUNK_LEN < playerZ - 60) {
      const newZ = c.position.z + NUM_CHUNKS * CHUNK_LEN;
      if (newZ < COURSE_LENGTH + 100) c.position.z = newZ;
    }
  }
}

// ============================================================
// Text banners (canvas textures) + start/finish arches
// ============================================================
function makeTextTexture(text, bg = '#dd3344', fg = '#ffffff') {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = fg;
  ctx.font = 'bold 84px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cv.width / 2, cv.height / 2 + 4);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeArch(z, label, bg) {
  const g = new THREE.Group();
  for (const x of [-ROAD_WIDTH / 2 - 0.8, ROAD_WIDTH / 2 + 0.8]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 6.4, 8), MAT.archPost);
    post.position.set(x, 3.2, 0);
    g.add(post);
  }
  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(ROAD_WIDTH + 3, 2),
    new THREE.MeshBasicMaterial({ map: makeTextTexture(label, bg), side: THREE.DoubleSide })
  );
  banner.position.set(0, 5.8, 0);
  banner.rotation.y = Math.PI; // face the approaching runners
  g.position.z = z;
  scene.add(g);
  return g;
}

makeArch(0, 'START', '#2277cc');
makeArch(COURSE_LENGTH, 'FINISH  42.2 km', '#dd3344');

// km signs every 5 km (500 world m)
for (let z = 500; z < COURSE_LENGTH; z += 500) {
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(3, 0.8),
    new THREE.MeshBasicMaterial({
      map: makeTextTexture(`${(z * WORLD_TO_KM).toFixed(0)} km`, '#114488'),
      side: THREE.DoubleSide,
    })
  );
  sign.position.set(-ROAD_WIDTH / 2 - 2.2, 2.2, z);
  sign.rotation.y = Math.PI;
  scene.add(sign);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 6), MAT.curb);
  pole.position.set(-ROAD_WIDTH / 2 - 2.2, 1.1, z);
  scene.add(pole);
}

// ============================================================
// Water / aid stations
// ============================================================
const waterStations = [];
for (let z = WATER_INTERVAL; z < COURSE_LENGTH; z += WATER_INTERVAL) {
  for (const side of [-1, 1]) {
    const g = new THREE.Group();
    const table = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.85, 6), MAT.table);
    table.position.y = 0.43;
    g.add(table);
    for (let i = 0; i < 5; i++) {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.22, 8), MAT.cup);
      cup.position.set(rand(-0.35, 0.35), 0.97, -2.4 + i * 1.2);
      g.add(cup);
    }
    g.position.set(side * (ROAD_WIDTH / 2 - 0.9), 0, z);
    scene.add(g);
    waterStations.push({ z, side, mesh: g });
  }
}

// ============================================================
// Runner: articulated low-poly humanoid with procedural gait
// ============================================================
function makeRunner({ shirt, shorts, skin = 0xd9a066, isPlayer = false }) {
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const shortsMat = new THREE.MeshLambertMaterial({ color: shorts });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const shoeMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });

  const root = new THREE.Group();
  const body = new THREE.Group(); // bobs up and down
  root.add(body);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.3), shirtMat);
  torso.position.y = 1.08;
  torso.castShadow = true;
  body.add(torso);

  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.22, 0.28), shortsMat);
  hips.position.y = 0.68;
  body.add(hips);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 10), skinMat);
  head.position.y = 1.6;
  head.castShadow = true;
  body.add(head);

  // race bib
  if (isPlayer) {
    const bib = new THREE.Mesh(
      new THREE.PlaneGeometry(0.34, 0.24),
      new THREE.MeshBasicMaterial({ map: makeTextTexture('1', '#ffffff', '#111111') })
    );
    bib.position.set(0, 1.1, -0.16);
    bib.rotation.y = Math.PI;
    body.add(bib);
  }

  function limb(pivotY, upperGeo, upperMat, upperY, lowerGeo, lowerMat, lowerPivotY, lowerY, footGeo) {
    const pivot = new THREE.Group();
    pivot.position.y = pivotY;
    const upper = new THREE.Mesh(upperGeo, upperMat);
    upper.position.y = upperY;
    upper.castShadow = true;
    pivot.add(upper);
    const lowerPivot = new THREE.Group();
    lowerPivot.position.y = lowerPivotY;
    const lower = new THREE.Mesh(lowerGeo, lowerMat);
    lower.position.y = lowerY;
    lower.castShadow = true;
    lowerPivot.add(lower);
    if (footGeo) {
      const foot = new THREE.Mesh(footGeo, shoeMat);
      foot.position.set(0, lowerY * 2 - 0.02, 0.07);
      lowerPivot.add(foot);
    }
    pivot.add(lowerPivot);
    return { pivot, lowerPivot };
  }

  const upperLegGeo = new THREE.BoxGeometry(0.16, 0.36, 0.18);
  const lowerLegGeo = new THREE.BoxGeometry(0.13, 0.36, 0.14);
  const footGeo = new THREE.BoxGeometry(0.14, 0.09, 0.3);
  const upperArmGeo = new THREE.BoxGeometry(0.13, 0.3, 0.13);
  const lowerArmGeo = new THREE.BoxGeometry(0.11, 0.28, 0.11);

  const legL = limb(0.62, upperLegGeo, skinMat, -0.18, lowerLegGeo, skinMat, -0.36, -0.18, footGeo);
  const legR = limb(0.62, upperLegGeo, skinMat, -0.18, lowerLegGeo, skinMat, -0.36, -0.18, footGeo);
  legL.pivot.position.x = -0.13;
  legR.pivot.position.x = 0.13;
  body.add(legL.pivot, legR.pivot);

  const armL = limb(1.34, upperArmGeo, shirtMat, -0.15, lowerArmGeo, skinMat, -0.3, -0.14, null);
  const armR = limb(1.34, upperArmGeo, shirtMat, -0.15, lowerArmGeo, skinMat, -0.3, -0.14, null);
  armL.pivot.position.x = -0.34;
  armR.pivot.position.x = 0.34;
  body.add(armL.pivot, armR.pivot);

  root.userData = { body, legL, legR, armL, armR, phase: rand(0, Math.PI * 2) };
  scene.add(root);
  return root;
}

function animateRunner(r, speed, dt) {
  const u = r.userData;
  const running = speed > 0.3;
  // stride frequency scales with speed
  u.phase += dt * (running ? 4.5 + speed * 0.55 : 2);
  const p = u.phase;
  const amp = running ? Math.min(1, speed / 14) : 0.04;

  const legSwing = Math.sin(p) * 0.95 * amp;
  u.legL.pivot.rotation.x = legSwing;
  u.legR.pivot.rotation.x = -legSwing;
  // knees bend on the back-swing
  u.legL.lowerPivot.rotation.x = Math.max(0, Math.sin(p + Math.PI * 0.5)) * 1.5 * amp;
  u.legR.lowerPivot.rotation.x = Math.max(0, Math.sin(p + Math.PI * 1.5)) * 1.5 * amp;

  u.armL.pivot.rotation.x = -legSwing * 0.85;
  u.armR.pivot.rotation.x = legSwing * 0.85;
  u.armL.lowerPivot.rotation.x = -0.9 * amp;
  u.armR.lowerPivot.rotation.x = -0.9 * amp;

  // torso bob + lean
  u.body.position.y = running ? Math.abs(Math.sin(p)) * 0.07 * amp * 2 : 0;
  u.body.rotation.x = running ? 0.12 * amp : 0;
}

// ============================================================
// Race participants
// ============================================================
const AI_ROSTER = [
  { name: 'Kiptoo',  shirt: 0xe74c3c, shorts: 0x222222, skin: 0x6b4423, base: 13.4, kick: 1.5 },
  { name: 'Sato',    shirt: 0x3498db, shorts: 0xffffff, skin: 0xe8c39e, base: 13.1, kick: 1.2 },
  { name: 'Alvarez', shirt: 0xf1c40f, shorts: 0x2c3e50, skin: 0xc68642, base: 12.9, kick: 1.0 },
  { name: 'Okafor',  shirt: 0x9b59b6, shorts: 0x111111, skin: 0x5c3a21, base: 13.0, kick: 1.3 },
  { name: 'Berg',    shirt: 0x1abc9c, shorts: 0x34495e, skin: 0xf0d0b0, base: 12.7, kick: 0.8 },
  { name: 'Rossi',   shirt: 0xe67e22, shorts: 0xffffff, skin: 0xdba377, base: 12.5, kick: 1.1 },
  { name: 'Chen',    shirt: 0x2ecc71, shorts: 0x222222, skin: 0xe8c39e, base: 12.3, kick: 0.9 },
];

const state = {
  phase: 'menu',           // menu | countdown | race | finished
  time: 0,
  countdown: 0,
  finishers: [],
};

const player = {
  name: 'You',
  mesh: makeRunner({ shirt: 0xffd23f, shorts: 0x1b2a4a, isPlayer: true }),
  z: -4,
  x: 0,
  speed: 0,
  stamina: 100,
  finished: false,
  finishTime: 0,
  bonked: false,
  lastWaterZ: -1,
};

const ais = AI_ROSTER.map((r, i) => ({
  name: r.name,
  mesh: makeRunner({ shirt: r.shirt, shorts: r.shorts, skin: r.skin }),
  z: -4,
  x: 0,
  speed: 0,
  base: r.base,
  kick: r.kick,
  wob: rand(0, 100),
  finished: false,
  finishTime: 0,
  laneTarget: 0,
  slot: i,
}));

const everyone = [player, ...ais];

function gridStart() {
  const lanes = [-4.2, -3, -1.8, -0.6, 0.6, 1.8, 3, 4.2];
  const order = [...everyone];
  order.forEach((r, i) => {
    r.x = lanes[i % lanes.length];
    r.z = -4 - Math.floor(i / lanes.length) * 2;
    r.speed = 0;
    r.finished = false;
    r.finishTime = 0;
    r.mesh.position.set(r.x, 0, r.z);
    r.mesh.rotation.y = 0;
  });
  ais.forEach((a) => { a.laneTarget = a.x; });
  player.stamina = 100;
  player.bonked = false;
  player.lastWaterZ = -1;
}

// ============================================================
// Input
// ============================================================
const input = { run: false, sprint: false, left: false, right: false };

const keyMap = {
  KeyW: 'run', ArrowUp: 'run',
  ShiftLeft: 'sprint', ShiftRight: 'sprint', Space: 'sprint',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
};

window.addEventListener('keydown', (e) => {
  if (keyMap[e.code] !== undefined) { input[keyMap[e.code]] = true; e.preventDefault(); }
});
window.addEventListener('keyup', (e) => {
  if (keyMap[e.code] !== undefined) input[keyMap[e.code]] = false;
});

// touch controls
function bindTouch(id, prop) {
  const btn = document.getElementById(id);
  const on = (e) => { e.preventDefault(); input[prop] = true; };
  const off = (e) => { e.preventDefault(); input[prop] = false; };
  btn.addEventListener('pointerdown', on);
  btn.addEventListener('pointerup', off);
  btn.addEventListener('pointerleave', off);
}
bindTouch('tRun', 'run');
bindTouch('tSprint', 'sprint');
bindTouch('tLeft', 'left');
bindTouch('tRight', 'right');
if ('ontouchstart' in window) document.body.classList.add('touchmode');

// ============================================================
// HUD
// ============================================================
const el = {
  clock: document.getElementById('clock'),
  dist: document.getElementById('dist'),
  pace: document.getElementById('pace'),
  rank: document.getElementById('rank'),
  progressbar: document.getElementById('progressbar'),
  progressdots: document.getElementById('progressdots'),
  staminafill: document.getElementById('staminafill'),
  toast: document.getElementById('toast'),
  menu: document.getElementById('menu'),
  results: document.getElementById('results'),
  resultTitle: document.getElementById('resultTitle'),
  resultPlace: document.getElementById('resultPlace'),
  resultTime: document.getElementById('resultTime'),
  resultBoard: document.getElementById('resultBoard'),
};

// progress dots (one per runner)
const dots = everyone.map((r) => {
  const d = document.createElement('div');
  d.className = 'pdot' + (r === player ? ' player' : '');
  el.progressdots.appendChild(d);
  return d;
});
// give AI dots their shirt colors
ais.forEach((a, i) => {
  dots[i + 1].style.background = '#' + AI_ROSTER[i].shirt.toString(16).padStart(6, '0');
});

function fmtTime(t) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

let toastTimer = 0;
function toast(msg, ms = 1600) {
  el.toast.textContent = msg;
  el.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('show'), ms);
}

function currentRank() {
  const sorted = [...everyone].sort((a, b) => {
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.z - a.z;
  });
  return sorted.indexOf(player) + 1;
}

function updateHUD() {
  el.clock.textContent = fmtTime(state.time);
  el.dist.textContent = `${Math.max(0, player.z * WORLD_TO_KM).toFixed(1)} km`;
  el.pace.textContent = player.speed > 0.5
    ? `${(player.speed * 3.6).toFixed(0)} km/h`
    : '--';
  el.rank.textContent = `${currentRank()}/${everyone.length}`;
  el.progressbar.style.width = `${Math.min(100, (player.z / COURSE_LENGTH) * 100)}%`;
  everyone.forEach((r, i) => {
    dots[i].style.left = `${Math.min(100, Math.max(0, (r.z / COURSE_LENGTH) * 100))}%`;
  });
  el.staminafill.style.width = `${player.stamina}%`;
}

// ============================================================
// Confetti (finish celebration)
// ============================================================
let confetti = null;
function spawnConfetti(z) {
  const count = 500;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const vel = [];
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    pos[i * 3] = rand(-8, 8);
    pos[i * 3 + 1] = rand(6, 14);
    pos[i * 3 + 2] = z + rand(-6, 6);
    c.setHSL(Math.random(), 0.9, 0.6);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    vel.push({ x: rand(-0.7, 0.7), y: rand(-2.2, -0.8), z: rand(-0.7, 0.7) });
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.22, vertexColors: true }));
  scene.add(pts);
  confetti = { pts, vel, life: 8 };
}

function updateConfetti(dt) {
  if (!confetti) return;
  confetti.life -= dt;
  if (confetti.life <= 0) {
    scene.remove(confetti.pts);
    confetti.pts.geometry.dispose();
    confetti.pts.material.dispose();
    confetti = null;
    return;
  }
  const pos = confetti.pts.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const v = confetti.vel[i];
    let y = pos.getY(i) + v.y * dt;
    if (y < 0.1) y = rand(8, 14);
    pos.setXYZ(i, pos.getX(i) + v.x * dt, y, pos.getZ(i) + v.z * dt);
  }
  pos.needsUpdate = true;
}

// ============================================================
// Race logic
// ============================================================
const kmMilestones = new Set();

function startRace() {
  gridStart();
  state.phase = 'countdown';
  state.countdown = 3.5;
  state.time = 0;
  state.finishers = [];
  kmMilestones.clear();
  el.menu.classList.add('hidden');
  el.results.classList.add('hidden');
}

document.getElementById('startBtn').addEventListener('click', startRace);
document.getElementById('restartBtn').addEventListener('click', startRace);

function updatePlayer(dt) {
  const p = player;
  if (p.finished) {
    p.speed = Math.max(0, p.speed - 6 * dt);
  } else {
    // target speed from inputs
    let target = 0;
    const sprinting = input.sprint && p.stamina > 0 && !p.bonked;
    if (sprinting) target = 18;
    else if (input.run || input.sprint) target = p.bonked ? 6.5 : 13;

    // stamina economy
    if (sprinting && p.speed > 1) {
      p.stamina -= 9 * dt;
    } else if (input.run && p.speed > 1) {
      p.stamina -= 1.1 * dt;          // even cruising slowly drains over 42 km
    } else {
      p.stamina += 4 * dt;            // recover while jogging/resting
    }
    p.stamina = Math.max(0, Math.min(100, p.stamina));

    if (p.stamina <= 0 && !p.bonked) {
      p.bonked = true;
      toast('YOU HIT THE WALL! 🧱', 2200);
    }
    if (p.bonked && p.stamina > 35) {
      p.bonked = false;
      toast('SECOND WIND!', 1600);
    }

    const accel = target > p.speed ? 9 : 12;
    p.speed += Math.sign(target - p.speed) * accel * dt;
    if (Math.abs(target - p.speed) < accel * dt) p.speed = target;

    // lateral movement
    const strafe = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    p.x += strafe * 6 * dt;
    p.x = Math.max(-LANE_LIMIT, Math.min(LANE_LIMIT, p.x));

    // water pickup
    for (const w of waterStations) {
      if (w.z !== p.lastWaterZ && Math.abs(p.z - w.z) < 3 && Math.abs(p.x) > 3.4 &&
          Math.sign(p.x) === w.side) {
        p.lastWaterZ = w.z;
        p.stamina = Math.min(100, p.stamina + 40);
        toast('WATER! +40 STAMINA 💧', 1400);
        break;
      }
    }
  }

  p.z += p.speed * dt;

  // km milestone toasts every 10 km
  const km = Math.floor(p.z * WORLD_TO_KM);
  if (km > 0 && km % 10 === 0 && !kmMilestones.has(km)) {
    kmMilestones.add(km);
    toast(`${km} KM!`, 1200);
  }

  if (!p.finished && p.z >= COURSE_LENGTH) {
    p.finished = true;
    p.finishTime = state.time;
    state.finishers.push(p);
    spawnConfetti(COURSE_LENGTH);
    setTimeout(showResults, 2600);
  }

  p.mesh.position.set(p.x, 0, p.z);
  p.mesh.rotation.y = -((input.right ? 1 : 0) - (input.left ? 1 : 0)) * 0.18;
  animateRunner(p.mesh, p.speed, dt);
}

function updateAI(a, dt) {
  if (a.finished) {
    a.speed = Math.max(0, a.speed - 6 * dt);
  } else {
    a.wob += dt;
    // pacing: steady with noise, mid-race dip, finishing kick
    const progress = a.z / COURSE_LENGTH;
    let target = a.base + Math.sin(a.wob * 0.35) * 0.8;
    if (progress > 0.55 && progress < 0.75) target -= 0.7;       // rough patch
    if (progress > 0.88) target += a.kick;                        // final kick
    // light rubber-banding keeps the race close
    const gap = player.z - a.z;
    target += Math.max(-0.8, Math.min(0.8, gap * 0.004));

    a.speed += Math.sign(target - a.speed) * 6 * dt;

    // drift between lanes occasionally
    if (Math.random() < 0.004) a.laneTarget = rand(-4, 4);
    a.x += (a.laneTarget - a.x) * 0.8 * dt;
  }

  a.z += a.speed * dt;

  if (!a.finished && a.z >= COURSE_LENGTH) {
    a.finished = true;
    a.finishTime = state.time;
    state.finishers.push(a);
  }

  a.mesh.position.set(a.x, 0, a.z);
  animateRunner(a.mesh, a.speed, dt);
}

function showResults() {
  state.phase = 'finished';
  const place = state.finishers.indexOf(player) + 1;
  const suffix = place === 1 ? 'st' : place === 2 ? 'nd' : place === 3 ? 'rd' : 'th';
  el.resultTitle.textContent = place === 1 ? '🏆 CHAMPION!' : 'FINISHED!';
  el.resultPlace.textContent = `${place}${suffix} place`;
  el.resultTime.textContent = `Official time: ${fmtTime(player.finishTime)}`;

  // full board: finishers first, then projected order for the rest
  const done = [...state.finishers];
  const rest = everyone.filter((r) => !r.finished).sort((x, y) => y.z - x.z);
  el.resultBoard.innerHTML = '';
  [...done, ...rest].forEach((r, i) => {
    const row = document.createElement('div');
    row.className = 'boardrow' + (r === player ? ' me' : '');
    row.innerHTML = `<span>${i + 1}. ${r.name}</span><span>${r.finished ? fmtTime(r.finishTime) : (r.z * WORLD_TO_KM).toFixed(1) + ' km'}</span>`;
    el.resultBoard.appendChild(row);
  });
  el.results.classList.remove('hidden');
}

// ============================================================
// Camera
// ============================================================
function updateCamera(dt) {
  const targetPos = new THREE.Vector3(player.x * 0.6, 4.2, player.z - 8.5);
  camera.position.lerp(targetPos, Math.min(1, 5 * dt));
  camera.lookAt(player.x * 0.4, 1.6, player.z + 10);
  // keep the sun's shadow frustum centered on the player
  sun.position.set(player.x - 40, 70, player.z - 30);
  sun.target.position.set(player.x, 0, player.z);
}
camera.position.set(0, 4.2, -12);
camera.lookAt(0, 1.6, 10);

// ============================================================
// Main loop
// ============================================================
const clock = new THREE.Clock();

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  if (state.phase === 'countdown') {
    state.countdown -= dt;
    const n = Math.ceil(state.countdown - 0.5);
    if (state.countdown > 0.5) {
      toast(String(Math.max(1, n)), 400);
    } else if (state.phase === 'countdown') {
      state.phase = 'race';
      toast('GO! 🏁', 1000);
    }
    everyone.forEach((r) => animateRunner(r.mesh, 0, dt));
  } else if (state.phase === 'race' || state.phase === 'finished') {
    if (state.phase === 'race') state.time += dt;
    updatePlayer(dt);
    ais.forEach((a) => updateAI(a, dt));
    recycleChunks(player.z);
    updateHUD();
  } else {
    // menu: idle jog preview
    everyone.forEach((r) => animateRunner(r.mesh, 3, dt));
  }

  for (const c of chunks) {
    if (Math.abs(c.position.z + CHUNK_LEN / 2 - player.z) < 180) animateChunkCrowd(c, t);
  }
  updateConfetti(dt);
  updateCamera(dt);
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

gridStart();
tick();
