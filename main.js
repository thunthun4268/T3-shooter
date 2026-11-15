import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7ec0ee);
scene.fog = new THREE.Fog(0x99ccee, 50, 200);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.005, 250);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));
const sol = new THREE.DirectionalLight(0xffffff, 1.8);
sol.position.set(20, 40, 20);
scene.add(sol); 

const RUTA_TEXTURAS = '/textures/';
const texLoader = new THREE.TextureLoader();

function aplicarTextura(material, archivo, repX, repY) {
  texLoader.load(
    RUTA_TEXTURAS + archivo,
    (t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repX, repY);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      material.map = t;
      material.color.set(0xffffff);
      material.needsUpdate = true;
    },
    undefined,
    () => console.warn(`No se encontró ${RUTA_TEXTURAS + archivo}, se usa color sólido.`)
  );
  return material;
}

// Suelo general (.jpg)
const suelo = new THREE.Mesh(
  new THREE.PlaneGeometry(400, 400),
  aplicarTextura(new THREE.MeshStandardMaterial({ color: 0x2b3a2b }), 'pasto.jpg', 80, 80)
);
suelo.rotation.x = -Math.PI / 2;
scene.add(suelo);

// Calles (.jpg)
const callesConfig = [
  { x: 0, z: -40, w: 12, h: 160 },
  { x: -18, z: -20, w: 10, h: 70 },
  { x: 16, z: -60, w: 10, h: 80 },
  { x: 0, z: 10, w: 45, h: 10 },
  { x: -10, z: -55, w: 30, h: 8 },
  { x: 5, z: -95, w: 35, h: 10 }
];

callesConfig.forEach(c => {
  const calleMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(c.w, c.h),
    aplicarTextura(new THREE.MeshStandardMaterial({ color: 0x1f2227 }), 'asfalto.jpg', Math.max(2, c.w / 5), Math.max(4, c.h / 5))
  );
  calleMesh.rotation.x = -Math.PI / 2;
  calleMesh.position.set(c.x, 0.005, c.z);
  scene.add(calleMesh);
});

const paredes = [];
const cajasColision = [];

// Función para edificios altos (20 de altura) con bloque marrón de puerta
function edificioConPuerta(x, z, ancho, fondo, alto, textura) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x3a3f47 });
  if (textura) aplicarTextura(mat, textura, Math.max(ancho, fondo) / 4, alto / 4);
  
  const meshEdificio = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, fondo), mat);
  meshEdificio.position.set(x, alto / 2, z);
  scene.add(meshEdificio);
  meshEdificio.updateMatrixWorld(true);
  paredes.push(meshEdificio);
  cajasColision.push(new THREE.Box3().setFromObject(meshEdificio));

  // Puerta marrón representativa
  const matPuerta = new THREE.MeshStandardMaterial({ color: 0x4a2e18 });
  const puertaW = 1.2;
  const puertaH = 2.2;
  const puertaD = 0.15;

  let puertaX = x;
  let puertaZ = z;
  let rotY = 0;

  if (Math.abs(x) > Math.abs(z)) {
    puertaX = x > 0 ? x - ancho / 2 - 0.05 : x + ancho / 2 + 0.05;
    rotY = Math.PI / 2;
  } else {
    puertaZ = z > 0 ? z - fondo / 2 - 0.05 : z + fondo / 2 + 0.05;
  }

  const meshPuerta = new THREE.Mesh(new THREE.BoxGeometry(puertaW, puertaH, puertaD), matPuerta);
  meshPuerta.position.set(puertaX, puertaH / 2, puertaZ);
  meshPuerta.rotation.y = rotY;
  scene.add(meshPuerta);
}

function bloque(x, z, ancho, fondo, alto, color, textura) {
  const mat = new THREE.MeshStandardMaterial({ color });
  if (textura) aplicarTextura(mat, textura, Math.max(ancho, fondo) / 4, alto / 4);
  const m = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, fondo), mat);
  m.position.set(x, alto / 2, z);
  scene.add(m);
  m.updateMatrixWorld(true);
  paredes.push(m);
  cajasColision.push(new THREE.Box3().setFromObject(m));
}

// Limites del mapa
const LIMITE_MAPA = { minX: -35, maxX: 35, minZ: -122, maxZ: 32 };

function choca(p, r) {
  if (p.x - r < LIMITE_MAPA.minX || p.x + r > LIMITE_MAPA.maxX || 
      p.z - r < LIMITE_MAPA.minZ || p.z + r > LIMITE_MAPA.maxZ) {
    return true;
  }
  for (const b of cajasColision) {
    if (p.x + r > b.min.x && p.x - r < b.max.x && p.z + r > b.min.z && p.z - r < b.max.z) return true;
  }
  return false;
}

function mover(obj, dx, dz, radio) {
  obj.position.x += dx;
  if (choca(obj.position, radio)) obj.position.x -= dx;
  obj.position.z += dz;
  if (choca(obj.position, radio)) obj.position.z -= dz;
}

// Edificios (20 de altura)
const edificiosConfig = [
  { x: -28, z: 20, w: 18, d: 24, h: 20 },
  { x: -26, z: -6, w: 14, d: 18, h: 20 },
  { x: -30, z: -32, w: 18, d: 22, h: 20 },
  { x: 28, z: 22, w: 20, d: 20, h: 20 },
  { x: 25, z: -4, w: 14, d: 20, h: 20 },
  { x: 29, z: -35, w: 18, d: 26, h: 20 },
  { x: -10, z: -22, w: 10, d: 14, h: 20 },
  { x: 8, z: -28, w: 12, d: 10, h: 20 },
  { x: -14, z: -50, w: 12, d: 16, h: 20 },
  { x: 12, z: -52, w: 10, d: 14, h: 20 },
  { x: -6, z: -76, w: 14, d: 18, h: 20 },
  { x: 14, z: -80, w: 16, d: 14, h: 20 },
  { x: -28, z: -70, w: 18, d: 20, h: 20 },
  { x: 30, z: -75, w: 18, d: 25, h: 20 },
  { x: -22, z: -110, w: 22, d: 18, h: 20 },
  { x: 22, z: -112, w: 20, d: 20, h: 20 }
];

edificiosConfig.forEach(ed => {
  edificioConPuerta(ed.x, ed.z, ed.w, ed.d, ed.h, 'edificio.jpg');
});

// Obstáculos de concreto
[
  [-6, -12, 3, 2, 1.8, 0x5a5a5a],
  [6, -18, 2, 4, 1.5, 0x4a525a],
  [-12, -38, 4, 2, 1.6, 0x614838],
  [4, -42, 2.5, 2.5, 1.5, 0x3d4a3a],
  [-4, -62, 3, 3, 1.7, 0x554433],
  [8, -68, 4, 2, 1.5, 0x444444],
  [-8, -88, 2, 5, 1.8, 0x505050]
].forEach(([x, z, w, d, h, col]) => bloque(x, z, w, d, h, col));

// Cajas en calles (.jpg)
[
  [-16, -14, 2.2, 1.4],
  [2, -24, 1.5, 1.5],
  [12, -32, 2, 1.2],
  [-5, -45, 1.8, 2.2],
  [-14, -65, 2.5, 1.5],
  [6, -84, 1.5, 1.8],
  [-2, -92, 2, 2]
].forEach(([x, z, w, d]) => bloque(x, z, w, d, 1.3, 0x6b4a2b, 'caja.jpg'));

function crearEtiqueta(texto, color, x, y, z) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d');
  g.font = 'bold 72px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = color;
  g.fillText(texto, 256, 64);
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, fog: false })
  );
  s.position.set(x, y, z);
  s.scale.set(8, 2, 1);
  scene.add(s);
}

const INICIO = { x: 0, z: 25, tam: 5 };
const zonaInicioMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(INICIO.tam, INICIO.tam),
  new THREE.MeshBasicMaterial({ color: 0x4da3ff, side: THREE.DoubleSide, transparent: true, opacity: 0.4, fog: false })
);
zonaInicioMesh.rotation.x = -Math.PI / 2;
zonaInicioMesh.position.set(INICIO.x, 0.03, INICIO.z);
scene.add(zonaInicioMesh);
crearEtiqueta('INICIO', '#4da3ff', INICIO.x, 3.5, INICIO.z);

const EXTRACCION = { x: 0, z: -115, tam: 8 };
const zonaExtraccionMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(EXTRACCION.tam, EXTRACCION.tam),
  new THREE.MeshBasicMaterial({ color: 0x3dff7a, transparent: true, opacity: 0.35, side: THREE.DoubleSide, fog: false })
);
zonaExtraccionMesh.rotation.x = -Math.PI / 2;
zonaExtraccionMesh.position.set(EXTRACCION.x, 0.03, EXTRACCION.z);
scene.add(zonaExtraccionMesh);

const hazExtraccion = new THREE.Mesh(
  new THREE.BoxGeometry(EXTRACCION.tam, 40, EXTRACCION.tam),
  new THREE.MeshBasicMaterial({ color: 0x3dff7a, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false, fog: false })
);
hazExtraccion.position.set(EXTRACCION.x, 20, EXTRACCION.z);
scene.add(hazExtraccion);
crearEtiqueta('EXTRACCIÓN', '#3dff7a', EXTRACCION.x, 9, EXTRACCION.z);

const jugador = new THREE.Object3D();
jugador.position.set(INICIO.x, 0, INICIO.z);
scene.add(jugador);

const ALTURA_OJOS = 1.6;
camera.position.set(0, ALTURA_OJOS, 0);
jugador.add(camera);

const VELOCIDAD = 6;
const RADIO_JUGADOR = 0.4;
const SENSIBILIDAD = 0.002;
const LIMITE_PITCH = Math.PI / 2 - 0.05;

const RUTA_MODELOS = '/models/';

const ARMAS_CONFIG = [
  {
    nombre: 'Pistola',
    archivo: '/models/arma1.glb',
    escala: 0.05,
    rotY: -Math.PI / 2,
    pos: [0.25, -0.24, -0.5],
    boca: [0, 0.03, -0.4],
    retroceso: 0.07,
    municionInicial: 15,
    municionPorCaja: 8,
    provisional: { ancho: 0.07, alto: 0.12, largo: 0.3, color: 0x9aa0a6 },
  },
  {
    nombre: 'Rifle',
    archivo: '/models/arma2.glb',
    escala: 0.005,
    rotY: 0,
    pos: [0.28, -0.26, -0.55],
    boca: [0, 0.01, -2.35],
    retroceso: 0.05,
    municionInicial: 14,
    municionPorCaja: 12,
    provisional: { ancho: 0.08, alto: 0.12, largo: 0.7, color: 0x3b3f45 },
  },
];


function crearProvisional({ ancho, alto, largo, color }) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color });
  const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, largo), mat);
  cuerpo.position.z = -largo / 2;
  const mango = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto * 1.6, ancho * 1.4), mat);
  mango.position.set(0, -alto, -ancho);
  g.add(cuerpo, mango);
  return g;
}

const loader = new GLTFLoader();

const armas = ARMAS_CONFIG.map((cfg) => {
  const grupo = new THREE.Group();
  grupo.position.set(...cfg.pos);

  const provisional = crearProvisional(cfg.provisional);
  grupo.add(provisional);

  const destello = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffd27a })
  );
  destello.position.set(...cfg.boca);
  destello.visible = false;
  grupo.add(destello);

  grupo.visible = false;
  camera.add(grupo);

  loader.load(
    cfg.archivo,
    (gltf) => {
      const modelo = gltf.scene;
      modelo.scale.setScalar(cfg.escala);
      modelo.rotation.y = cfg.rotY;
      modelo.traverse((o) => (o.frustumCulled = false));
      grupo.remove(provisional);
      grupo.add(modelo);
    },
    undefined,
    () => console.warn(`No se encontró ${cfg.archivo}, se usa el modelo provisional.`)
  );

  return { cfg, grupo, destello, municion: cfg.municionInicial, retroceso: 0, tDestello: 0 };
});

let armaActual = 0;
let estado = 'jugando';

function seleccionarArma(i) {
  armaActual = i;
  armas.forEach((a, k) => (a.grupo.visible = k === i));
  actualizarHUD();
}

const elMun = document.getElementById('hud-municion');
const elArma = document.getElementById('hud-arma');
const elAviso = document.getElementById('aviso');
const elObjetivo = document.getElementById('objetivo');
const elMira = document.getElementById('mira');
const elFinal = document.getElementById('final');
const elFinalTitulo = document.getElementById('final-titulo');
const elFinalTexto = document.getElementById('final-texto');
let tAviso;

function actualizarHUD() {
  const a = armas[armaActual];
  elMun.textContent = a.municion;
  elMun.classList.toggle('vacio', a.municion === 0);
  if (elArma) {
    elArma.textContent = a.cfg.nombre;
  }
}

function actualizarObjetivo() {
  const dist = Math.round(Math.hypot(EXTRACCION.x - jugador.position.x, EXTRACCION.z - jugador.position.z));
  const vivos = zombis.filter((z) => z.estado !== 'muerto').length;
  elObjetivo.innerHTML = `Meta de Extracción: <b>${dist} metros</b> --- Zombis activos: ${vivos}`;
}

function mostrarAviso(texto, color = '#ff4d4d') {
  elAviso.textContent = texto;
  elAviso.style.color = color;
  elAviso.classList.add('visible');
  clearTimeout(tAviso);
  tAviso = setTimeout(() => elAviso.classList.remove('visible'), 700);
}

let audioCtx;
function sonido(freq, dur, tipo = 'sawtooth') {
  audioCtx ??= new AudioContext();
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = tipo;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(40, t + dur);
  g.gain.setValueAtTime(0.15, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(audioCtx.destination);
  o.start();
  o.stop(t + dur);
}

function terminar(tipo) {
  if (estado !== 'jugando') return;
  estado = tipo;
  const victoria = tipo === 'victoria';
  elFinalTitulo.textContent = victoria ? '¡MISIÓN COMPLETADA!' : 'GAME OVER';
  elFinalTitulo.style.color = victoria ? '#7dff9b' : '#ff4d4d';
  elFinalTexto.textContent = victoria ? 'Has llegado a la zona de extracción' : 'Un zombi te atrapó';
  elFinal.style.display = 'flex';
  document.exitPointerLock();
  sonido(victoria ? 880 : 90, 0.6, victoria ? 'sine' : 'sawtooth');
}

const raycaster = new THREE.Raycaster();
raycaster.far = 100;
const centro = new THREE.Vector2(0, 0);
const impactos = [];

function crearImpacto(punto) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff3b3b })
  );
  m.position.copy(punto);
  scene.add(m);
  impactos.push({ m, t: 0.6 });
}

const ZOMBI = {
  archivo: '/models/zombie.glb',
  altura: 1.8,
  rotY: -Math.PI / 2,
  vida: 2,
  probabilidadRapido: 0.25,
  separacion: 4,
  zonas: [
    { xMin: -22, xMax: 22, zMin: -24, zMax: 3, cantidad: 5 },
    { xMin: -22, xMax: 22, zMin: -54, zMax: -28, cantidad: 5 },
    { xMin: -7, xMax: 7, zMin: -86, zMax: -63, cantidad: 5 },
    { xMin: -20, xMax: 20, zMin: -99, zMax: -91, cantidad: 6 },
  ],
};
const DISTANCIA_ATAQUE = 0.9;
const CONTACTO = 1.1;
const zombis = [];

function generarPosiciones() {
  const lista = [];
  ZOMBI.zonas.forEach((zona) => {
    let creados = 0;
    for (let intento = 0; intento < 300 && creados < zona.cantidad; intento++) {
      const x = zona.xMin + Math.random() * (zona.xMax - zona.xMin);
      const z = zona.zMin + Math.random() * (zona.zMax - zona.zMin);
      if (choca({ x, z }, 0.8)) continue;
      if (lista.some((p) => Math.hypot(p[0] - x, p[1] - z) < ZOMBI.separacion)) continue;
      const rapido = Math.random() < ZOMBI.probabilidadRapido;
      lista.push([x, z, rapido ? 4.2 : 2.5, rapido ? 14 : 12]);
      creados++;
    }
  });
  return lista;
}

function activar(z) {
  if (z.estado !== 'inactivo') return;
  z.estado = 'activo';
  if (z.accion) z.accion.paused = false;
}

function morir(z) {
  z.estado = 'muerto';
  if (z.accion) z.accion.paused = true;
  sonido(110, 0.3, 'sawtooth');
}

function golpear(z) {
  z.vida--;
  activar(z);
  elMira.classList.add('impacto');
  setTimeout(() => elMira.classList.remove('impacto'), 100);
  if (z.vida <= 0) morir(z);
  else sonido(240, 0.08, 'square');
}
















function disparar() {
  if (estado !== 'jugando') return;
  const arma = armas[armaActual];

  if (arma.municion <= 0) {
    sonido(150, 0.08, 'square');
    mostrarAviso('SIN MUNICIÓN');
    return;
  }

  arma.municion--;
  arma.retroceso = 1;
  arma.destello.visible = true;
  arma.tDestello = 0.05;
  sonido(arma.cfg.nombre === 'Rifle' ? 420 : 320, 0.12);

  raycaster.setFromCamera(centro, camera);
  const vivos = zombis.filter((z) => z.estado !== 'muerto').map((z) => z.hitbox);
  const hits = raycaster.intersectObjects([...paredes, ...vivos], false);
  if (hits.length > 0) {
    crearImpacto(hits[0].point);
    const z = hits[0].object.userData.zombi;
    if (z) golpear(z);
  }

  actualizarHUD();
}
























const DISTANCIA_RECOGER = 1.5;
// Colores exclusivos: Amarillo (0xffc933) o Azul (0x4da3ff)
const COLORES_MUNICION = [0xffc933, 0x4da3ff];
const cajasMunicion = [];

function crearCajaMunicion(x, z, indiceArma) {
  const color = COLORES_MUNICION[indiceArma];
  const g = new THREE.Group();

  const cuerpo = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.4, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x3d4a2f })
  );
  const franja = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.12, 0.42),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6 })
  );
  franja.position.y = 0.1;
  const haz = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 8, 12, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, depthWrite: false })
  );
  haz.position.y = 4;

  g.add(cuerpo, franja, haz);
  g.position.set(x, 0.7, z);
  scene.add(g);
  cajasMunicion.push({ g, indiceArma, baseY: 0.7 });
}

crearCajaMunicion(-10, 12, 0);
crearCajaMunicion(10, -5, 1);
crearCajaMunicion(-15, -35, 0);
crearCajaMunicion(12, -48, 0);
crearCajaMunicion(-12, -72, 1);
crearCajaMunicion(10, -90, 0);

function recogerMunicion(i) {
  const caja = cajasMunicion[i];
  const arma = armas[caja.indiceArma];
  const cantidad = arma.cfg.municionPorCaja;

  arma.municion += cantidad;
  scene.remove(caja.g);
  cajasMunicion.splice(i, 1);

  sonido(700, 0.15, 'sine');
  mostrarAviso(`+${cantidad} BALAS · ${arma.cfg.nombre}`, '#7dff7d');
  actualizarHUD();
}

function actualizarCajasMunicion(t) {
  for (let i = cajasMunicion.length - 1; i >= 0; i--) {
    const c = cajasMunicion[i];
    c.g.rotation.y = t * 1.5;
    c.g.position.y = c.baseY + Math.sin(t * 2 + i) * 0.1;

    const dx = c.g.position.x - jugador.position.x;
    const dz = c.g.position.z - jugador.position.z;
    if (dx * dx + dz * dz < DISTANCIA_RECOGER * DISTANCIA_RECOGER) {
      recogerMunicion(i);
    }
  }
}

function iniciarZombis(base, animaciones) {
  const caja = new THREE.Box3().setFromObject(base);
  const factor = ZOMBI.altura / (caja.max.y - caja.min.y);
  const offsetY = -caja.min.y * factor;
  const clip = animaciones.find((c) => /walk|run|camin|corr/i.test(c.name)) ?? animaciones[0];

  generarPosiciones().forEach(([x, zPos, velocidad, rango]) => {
    const obj = new THREE.Group();
    obj.rotation.order = 'YXZ';
    const modelo = clone(base);
    modelo.scale.setScalar(factor);
    modelo.position.y = offsetY;
    modelo.rotation.y = ZOMBI.rotY;
    modelo.traverse((o) => (o.frustumCulled = false));
    obj.add(modelo);
    obj.position.set(x, 0, zPos);
    scene.add(obj);

    const hitbox = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 1.8, 0.8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitbox.position.y = 0.9;
    obj.add(hitbox);

    let mixer = null;
    let accion = null;
    if (clip) {
      mixer = new THREE.AnimationMixer(modelo);
      accion = mixer.clipAction(clip);
      accion.play();
      accion.paused = true;
    }

    const z = { obj, hitbox, estado: 'inactivo', vida: ZOMBI.vida, velocidad, rango, mixer, accion, caida: 0 };
    hitbox.userData.zombi = z;
    zombis.push(z);
  });
}

function crearZombiProvisional() {
  const g = new THREE.Group();
  const cuerpo = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 1.8, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x4f7a3a })
  );
  cuerpo.position.y = 0.9;
  g.add(cuerpo);
  return g;
}

loader.load(
  ZOMBI.archivo,
  (gltf) => iniciarZombis(gltf.scene, gltf.animations),
  undefined,
  () => {
    console.warn(`No se encontró ${ZOMBI.archivo}, se usa el modelo provisional.`);
    iniciarZombis(crearZombiProvisional(), []);
  }
);

function actualizarZombis(dt) {
  for (const z of zombis) {
    if (z.estado === 'muerto') {
      if (z.caida < 1) {
        z.caida = Math.min(1, z.caida + dt * 3);
        z.obj.rotation.x = (-z.caida * Math.PI) / 2;
      }
      continue;
    }

    const dx = jugador.position.x - z.obj.position.x;
    const dz = jugador.position.z - z.obj.position.z;
    const dist = Math.hypot(dx, dz);

    if (z.estado === 'inactivo' && dist < z.rango) activar(z);

    if (z.estado === 'activo') {
      z.obj.rotation.y = Math.atan2(dx, dz);
      if (dist > DISTANCIA_ATAQUE) {
        mover(z.obj, (dx / dist) * z.velocidad * dt, (dz / dist) * z.velocidad * dt, 0.4);
      }
      if (z.mixer) z.mixer.update(dt);
      if (dist < CONTACTO) terminar('derrota');
    }
  }
}

const teclas = {};
window.addEventListener('keydown', (e) => {
  teclas[e.code] = true;
  if (e.code === 'KeyR' && estado !== 'jugando') location.reload();
  if (estado !== 'jugando') return;
  if (e.code === 'Digit1') seleccionarArma(0);
  if (e.code === 'Digit2') seleccionarArma(1);
});
window.addEventListener('keyup', (e) => (teclas[e.code] = false));

const panel = document.getElementById('instrucciones');
panel.addEventListener('click', () => renderer.domElement.requestPointerLock());
document.getElementById('reiniciar').addEventListener('click', () => location.reload());

document.addEventListener('pointerlockchange', () => {
  const activo = document.pointerLockElement === renderer.domElement;
  panel.style.display = activo || estado !== 'jugando' ? 'none' : 'flex';
});

document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== renderer.domElement || estado !== 'jugando') return;
  jugador.rotation.y -= e.movementX * SENSIBILIDAD;
  camera.rotation.x -= e.movementY * SENSIBILIDAD;
  camera.rotation.x = Math.max(-LIMITE_PITCH, Math.min(LIMITE_PITCH, camera.rotation.x));
});

document.addEventListener('mousedown', (e) => {
  if (e.button === 0 && document.pointerLockElement === renderer.domElement) disparar();
});

const adelante = new THREE.Vector3();
const derecha = new THREE.Vector3();
const direccion = new THREE.Vector3();
let moviendo = false;

function actualizarJugador(dt) {
  jugador.getWorldDirection(adelante);
  adelante.y = 0;
  adelante.normalize().negate();
  derecha.crossVectors(adelante, camera.up).normalize();

  direccion.set(0, 0, 0);
  if (teclas['KeyW']) direccion.add(adelante);
  if (teclas['KeyS']) direccion.sub(adelante);
  if (teclas['KeyD']) direccion.add(derecha);
  if (teclas['KeyA']) direccion.sub(derecha);

  moviendo = direccion.lengthSq() > 0;
  if (moviendo) {
    direccion.normalize();
    mover(jugador, direccion.x * VELOCIDAD * dt, direccion.z * VELOCIDAD * dt, RADIO_JUGADOR);
  }

  const mitadExt = EXTRACCION.tam / 2;
  if (
    jugador.position.x >= EXTRACCION.x - mitadExt &&
    jugador.position.x <= EXTRACCION.x + mitadExt &&
    jugador.position.z >= EXTRACCION.z - mitadExt &&
    jugador.position.z <= EXTRACCION.z + mitadExt
  ) {
    terminar('victoria');
  }
}

let tBalanceo = 0;

function actualizarArmas(dt) {
  tBalanceo += moviendo ? dt * 10 : 0;
  armas.forEach((a) => {
    a.retroceso = Math.max(0, a.retroceso - dt * 8);
    a.grupo.position.z = a.cfg.pos[2] + a.retroceso * a.cfg.retroceso;
    a.grupo.position.y = a.cfg.pos[1] + (moviendo ? Math.sin(tBalanceo) * 0.008 : 0);
    a.grupo.rotation.x = a.retroceso * 0.08;

    if (a.tDestello > 0) {
      a.tDestello -= dt;
      if (a.tDestello <= 0) a.destello.visible = false;
    }
  });

  for (let i = impactos.length - 1; i >= 0; i--) {
    impactos[i].t -= dt;
    if (impactos[i].t <= 0) {
      scene.remove(impactos[i].m);
      impactos.splice(i, 1);
    }
  }
}

const reloj = new THREE.Clock();
seleccionarArma(0);

function animar() {
  requestAnimationFrame(animar);
  const dt = Math.min(reloj.getDelta(), 0.05);

  if (estado === 'jugando' && document.pointerLockElement === renderer.domElement) {
    actualizarJugador(dt);
    actualizarZombis(dt);
  }
  actualizarArmas(dt);
  actualizarCajasMunicion(reloj.elapsedTime);
  actualizarObjetivo();

  renderer.render(scene, camera);
}
animar();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});