// Pantógrafo: dibuja en la libreta (o arrastra el punzón) y el lápiz copia el dibujo al doble.
// Usa el mismo modelo del kit que la vista animada (modelos/mecanismos/pantografo.glb), pero mueve
// sus barras desde aquí con la geometría de herramientas/mecanismos.py (pantografo).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { rutaBase, MM } from './piezas3d.js';
import { verEnMesa } from './ar.js';
import { MECANISMOS } from './datos.js';

// medidas del modelo, en mm (iguales a mecanismos.py)
const L = 70;                  // medio largo de las barras largas
const Y1 = 17, Y2 = 27;        // alturas de las dos capas de barras
const PAPEL = { x0: -40, z0: -95, ancho: 300, alto: 150, y: 2.2 };
// zona donde puede andar el punzón: la libreta se dibuja aquí y el lápiz la copia al doble
const ZONA = { x0: 70, z0: -26, lado: 44 };
const VELOCIDAD = 30;          // mm/s del punzón mientras dibuja
const DURACION_MAX = 25;       // s: los dibujos largos se aceleran para no pasar de aquí
const AZUL = '#1f4fd6', ROJO = '#c4142c';

/** Posición de las cuatro barras para el punzón en p (mm, plano XZ). */
function pose(p) {
  const q = p.clone().multiplyScalar(2);
  const d = q.length() / 2;
  const h = Math.sqrt((2 * L) ** 2 - d * d);
  const n = new THREE.Vector2(q.y, -q.x).normalize();          // hacia atrás (-Z)
  const a = q.clone().multiplyScalar(0.5).addScaledVector(n, h);
  const c = a.clone().multiplyScalar(0.5);
  const dp = a.clone().add(q).multiplyScalar(0.5);
  return { o: new THREE.Vector2(), a, c, d: dp, p, q };
}

function corazon() {
  const puntos = [];
  for (let i = 0; i <= 120; i++) {
    const u = Math.PI * 2 * i / 120;
    const x = 16 * Math.sin(u) ** 3;
    const y = 13 * Math.cos(u) - 5 * Math.cos(2 * u) - 2 * Math.cos(3 * u) - Math.cos(4 * u);
    puntos.push(new THREE.Vector2(92 + x, -4 - y));
  }
  return [puntos];
}

export async function montar(contenedor, { abrirVentana }) {
  // botones y textos del mismo panel (no de otro que se haya abierto mientras esto cargaba)
  const deLab = id => contenedor.closest('.lab').querySelector(`#${id}`);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const escena = new THREE.Scene();
  escena.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const centro = new THREE.Vector3(0.11, 0.02, -0.03);
  const luz = new THREE.DirectionalLight(0xffffff, 1.5);
  luz.position.copy(centro).add(new THREE.Vector3(0.15, 0.6, 0.3));
  luz.target.position.copy(centro);
  luz.castShadow = true;
  luz.shadow.mapSize.set(2048, 2048);
  Object.assign(luz.shadow.camera, { left: -0.25, right: 0.25, top: 0.25, bottom: -0.25, near: 0.2, far: 1.4 });
  luz.shadow.bias = -0.0004;
  luz.shadow.normalBias = 0.0015;
  luz.shadow.radius = 4;
  escena.add(luz, luz.target, new THREE.HemisphereLight(0xfff8e8, 0x8a7f6a, 0.7));

  // misma vista que el modelo animado: 15° de lado, 50° desde arriba
  const camara = new THREE.PerspectiveCamera(35, 1, 0.01, 10);
  const orbita = new THREE.Spherical(0.46, THREE.MathUtils.degToRad(50), THREE.MathUtils.degToRad(15));
  camara.position.setFromSpherical(orbita).add(centro);
  const controles = new OrbitControls(camara, renderer.domElement);
  controles.target.copy(centro);
  controles.enablePan = false;
  controles.enableDamping = true;
  controles.minDistance = 0.22;
  controles.maxDistance = 0.9;
  controles.maxPolarAngle = Math.PI * 0.47;

  const gltf = await new GLTFLoader().loadAsync(`${rutaBase()}modelos/mecanismos/pantografo.glb`);
  const modelo = gltf.scene;
  modelo.getObjectByName('fijo-1-0').visible = false; // el corazón de la animación: aquí se dibuja en vivo
  const barras = Object.fromEntries(['oa', 'aq', 'cp', 'dp'].map(n => [n, modelo.getObjectByName(n)]));
  escena.add(modelo);
  modelo.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  // ---------- lo dibujado sobre el papel: una textura de lienzo encima de la hoja
  const lienzo = document.createElement('canvas');
  lienzo.width = 2048; lienzo.height = 1024;
  const tinta = lienzo.getContext('2d');
  tinta.lineCap = tinta.lineJoin = 'round';
  const textura = new THREE.CanvasTexture(lienzo);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const hoja = new THREE.Mesh(new THREE.PlaneGeometry(PAPEL.ancho * MM, PAPEL.alto * MM),
    new THREE.MeshBasicMaterial({ map: textura, transparent: true, depthWrite: false }));
  hoja.rotation.x = -Math.PI / 2;
  hoja.position.set((PAPEL.x0 + PAPEL.ancho / 2) * MM, PAPEL.y * MM, (PAPEL.z0 + PAPEL.alto / 2) * MM);
  hoja.receiveShadow = false;
  escena.add(hoja);

  const enLienzo = v => [(v.x - PAPEL.x0) / PAPEL.ancho * lienzo.width, (v.y - PAPEL.z0) / PAPEL.alto * lienzo.height];
  function raya(desde, hasta, color, grosor) {
    tinta.strokeStyle = color;
    tinta.lineWidth = grosor * lienzo.width / PAPEL.ancho;
    tinta.beginPath();
    tinta.moveTo(...enLienzo(desde));
    tinta.lineTo(...enLienzo(hasta));
    tinta.stroke();
    textura.needsUpdate = true;
  }
  function limpiarPapel() {
    tinta.clearRect(0, 0, lienzo.width, lienzo.height);
    textura.needsUpdate = true;
  }

  // ---------- mover el pantógrafo
  const EJE_Y = new THREE.Vector3(0, 1, 0);
  function barra(nodo, a, b, y) {
    nodo.position.set(a.x * MM, y * MM, a.y * MM);
    nodo.quaternion.setFromAxisAngle(EJE_Y, Math.atan2(-(b.y - a.y), b.x - a.x));
  }
  const punzon = new THREE.Vector2();
  function ubicar(p) {
    punzon.copy(p);
    const { o, a, c, d, q } = pose(p);
    barra(barras.oa, o, a, Y1);
    barra(barras.aq, a, q, Y2);
    barra(barras.cp, c, p, Y2);
    barra(barras.dp, d, p, Y1);
  }
  const dentro = p => new THREE.Vector2(
    THREE.MathUtils.clamp(p.x, ZONA.x0, ZONA.x0 + ZONA.lado),
    THREE.MathUtils.clamp(p.y, ZONA.z0, ZONA.z0 + ZONA.lado));
  function trazar(desde, hasta) {
    raya(desde, hasta, AZUL, 0.7);
    raya(desde.clone().multiplyScalar(2), hasta.clone().multiplyScalar(2), ROJO, 1.4);
  }
  ubicar(new THREE.Vector2(ZONA.x0 + ZONA.lado / 2, ZONA.z0 + ZONA.lado / 2));

  contenedor.querySelector('.lab-cargando')?.remove();
  contenedor.append(renderer.domElement);
  const pista = Object.assign(document.createElement('div'), { className: 'lab-pista' });
  contenedor.append(pista);

  // ---------- recorrido automático de un dibujo (lista de trazos en mm)
  let recorrido = null; // { tramos: [{desde, hasta, pinta, largo}], i, enTramo, velocidad, fin }
  function recorrer(trazos, aviso, fin = '¡Listo! El dibujo rojo es el doble de grande') {
    const tramos = [];
    let previo = punzon.clone();
    for (const t of trazos) {
      tramos.push({ desde: previo, hasta: t[0], pinta: false });
      for (let i = 1; i < t.length; i++) tramos.push({ desde: t[i - 1], hasta: t[i], pinta: true });
      previo = t[t.length - 1];
    }
    for (const t of tramos) t.largo = t.desde.distanceTo(t.hasta) / (t.pinta ? 1 : 3); // sin pintar va más rápido
    const total = tramos.reduce((s, t) => s + t.largo, 0);
    recorrido = { tramos, i: 0, enTramo: 0, velocidad: Math.max(VELOCIDAD, total / DURACION_MAX), fin };
    pista.textContent = aviso;
  }
  function avanzar(dt) {
    if (!recorrido) return;
    let paso = recorrido.velocidad * dt;
    while (paso > 0 && recorrido.i < recorrido.tramos.length) {
      const t = recorrido.tramos[recorrido.i];
      const resta = t.largo - recorrido.enTramo;
      const usa = Math.min(paso, resta);
      const antes = t.largo ? recorrido.enTramo / t.largo : 1;
      recorrido.enTramo += usa;
      paso -= usa;
      const despues = t.largo ? recorrido.enTramo / t.largo : 1;
      const p0 = t.desde.clone().lerp(t.hasta, antes), p1 = t.desde.clone().lerp(t.hasta, despues);
      if (t.pinta) raya(p0.clone().multiplyScalar(2), p1.clone().multiplyScalar(2), ROJO, 1.4);
      ubicar(p1);
      if (recorrido.enTramo >= t.largo) { recorrido.i++; recorrido.enTramo = 0; }
    }
    if (recorrido.i >= recorrido.tramos.length) {
      pista.textContent = recorrido.fin;
      recorrido = null;
    }
  }

  // ---------- libreta
  const libreta = deLab('lab-libreta');
  const lapizLibreta = libreta.getContext('2d');
  const botonDibujar = deLab('lab-dibujar');
  let trazos = [];   // en coordenadas 0..1 de la libreta
  let trazoActual = null;
  function pintarLibreta() {
    const { width, height } = libreta;
    lapizLibreta.clearRect(0, 0, width, height);
    lapizLibreta.strokeStyle = AZUL;
    lapizLibreta.lineWidth = Math.max(3, width / 90);
    lapizLibreta.lineCap = lapizLibreta.lineJoin = 'round';
    for (const t of trazos) {
      lapizLibreta.beginPath();
      t.forEach(([u, v], i) => lapizLibreta[i ? 'lineTo' : 'moveTo'](u * width, v * height));
      if (t.length === 1) lapizLibreta.lineTo(t[0][0] * width + 0.1, t[0][1] * height);
      lapizLibreta.stroke();
    }
  }
  function ajustarLibreta() {
    const r = libreta.getBoundingClientRect();
    libreta.width = Math.round(r.width * Math.min(devicePixelRatio, 2));
    libreta.height = Math.round(r.height * Math.min(devicePixelRatio, 2));
    pintarLibreta();
  }
  function puntoLibreta(e) {
    const r = libreta.getBoundingClientRect();
    return [THREE.MathUtils.clamp((e.clientX - r.left) / r.width, 0, 1), THREE.MathUtils.clamp((e.clientY - r.top) / r.height, 0, 1)];
  }
  const libretaBajar = e => {
    libreta.setPointerCapture(e.pointerId);
    trazoActual = [puntoLibreta(e)];
    trazos.push(trazoActual);
    pintarLibreta();
  };
  const libretaMover = e => {
    if (!trazoActual) return;
    const p = puntoLibreta(e), u = trazoActual[trazoActual.length - 1];
    if (Math.hypot(p[0] - u[0], p[1] - u[1]) < 0.006) return;
    trazoActual.push(p);
    pintarLibreta();
  };
  const libretaSoltar = () => {
    if (!trazoActual) return;
    trazoActual = null;
    botonDibujar.disabled = false;
    pista.textContent = 'Ahora toca «¡Que lo dibuje el pantógrafo!»';
  };
  libreta.addEventListener('pointerdown', libretaBajar);
  libreta.addEventListener('pointermove', libretaMover);
  libreta.addEventListener('pointerup', libretaSoltar);
  libreta.addEventListener('pointercancel', libretaSoltar);

  const aZona = ([u, v]) => new THREE.Vector2(ZONA.x0 + u * ZONA.lado, ZONA.z0 + v * ZONA.lado);
  botonDibujar.addEventListener('click', () => {
    if (!trazos.length) return;
    const enMm = trazos.map(t => t.map(aZona));
    limpiarPapel();
    // el modelo que recorre el punzón queda en azul; el lápiz lo copia en rojo
    for (const t of enMm) for (let i = 1; i < t.length; i++) raya(t[i - 1], t[i], AZUL, 0.7);
    recorrer(enMm, 'El punzón sigue tu dibujo azul…');
    // en el celular la libreta queda debajo: subir para ver al pantógrafo dibujar
    if (matchMedia('(max-width: 860px)').matches) contenedor.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  deLab('lab-borrar').addEventListener('click', () => {
    trazos = []; trazoActual = null; recorrido = null;
    botonDibujar.disabled = true;
    pintarLibreta();
    limpiarPapel();
    pista.textContent = 'Dibuja en la libreta';
  });
  deLab('lab-ar').addEventListener('click', () => verEnMesa(MECANISMOS[1], abrirVentana));

  // ---------- arrastrar el punzón sobre el papel
  const rayo = new THREE.Raycaster();
  const puntero = new THREE.Vector2();
  const planoPapel = new THREE.Plane(new THREE.Vector3(0, 1, 0), -PAPEL.y * MM);
  let arrastrando = false;
  function sobrePapel(e) {
    const r = renderer.domElement.getBoundingClientRect();
    puntero.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    rayo.setFromCamera(puntero, camara);
    const p = new THREE.Vector3();
    return rayo.ray.intersectPlane(planoPapel, p) ? new THREE.Vector2(p.x / MM, p.z / MM) : null;
  }
  const cercaDelPunzon = p => p && p.distanceTo(punzon) < 18;
  function alBajar(e) {
    if (!cercaDelPunzon(sobrePapel(e))) return;
    e.stopPropagation(); // que OrbitControls no gire la cámara
    arrastrando = true;
    recorrido = null;
    controles.enabled = false;
    renderer.domElement.setPointerCapture(e.pointerId);
    renderer.domElement.style.cursor = 'grabbing';
    pista.textContent = 'Mira cómo el lápiz copia lo que haces';
  }
  function alMover(e) {
    const p = sobrePapel(e);
    if (!arrastrando) {
      renderer.domElement.style.cursor = cercaDelPunzon(p) ? 'grab' : '';
      return;
    }
    if (!p) return;
    const nuevo = dentro(p);
    if (nuevo.distanceTo(punzon) < 0.3) return;
    trazar(punzon.clone(), nuevo);
    ubicar(nuevo);
  }
  function alSoltar() {
    if (!arrastrando) return;
    arrastrando = false;
    controles.enabled = true;
    renderer.domElement.style.cursor = '';
  }
  contenedor.addEventListener('pointerdown', alBajar, { capture: true });
  renderer.domElement.addEventListener('pointermove', alMover);
  renderer.domElement.addEventListener('pointerup', alSoltar);
  renderer.domElement.addEventListener('pointercancel', alSoltar);

  // ---------- tamaño y bucle
  function ajustar() {
    const { width, height } = contenedor.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camara.aspect = width / height;
    camara.updateProjectionMatrix();
    ajustarLibreta();
  }
  const observador = new ResizeObserver(ajustar);
  observador.observe(contenedor);
  observador.observe(libreta);

  let previo = performance.now();
  renderer.setAnimationLoop(ahora => {
    const dt = Math.min(Math.max((ahora - previo) / 1000, 0), 0.05);
    previo = ahora;
    avanzar(dt);
    controles.update();
    renderer.render(escena, camara);
  });

  // al llegar, el pantógrafo dibuja un corazón para mostrar cómo funciona
  const ejemplo = corazon();
  for (const t of ejemplo) for (let i = 1; i < t.length; i++) raya(t[i - 1], t[i], AZUL, 0.7);
  recorrer(ejemplo, 'Así copia un corazón…', 'Ahora dibuja tú en la libreta');
  contenedor.pantografo = { ubicar, pose, punzon, camara, get dibujando() { return !!recorrido; } }; // para pruebas

  return () => {
    renderer.setAnimationLoop(null);
    observador.disconnect();
    controles.dispose();
    textura.dispose();
    renderer.dispose();
  };
}
