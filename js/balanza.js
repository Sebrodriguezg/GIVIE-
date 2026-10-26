// Balanza de brazos iguales: arrastra los objetos por el brazo y busca el equilibrio.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { armar, pieza, MM } from './piezas3d.js';
import { verEnMesa } from './ar.js';
import { MECANISMOS } from './datos.js';

const PESAS = [
  { id: 'pesa-pesada', masa: 2, nombre: 'pesado' },
  { id: 'pesa-liviana', masa: 1, nombre: 'liviano' },
];
const INCLINACION_MAX = 0.3; // rad

export async function montar(contenedor, { abrirVentana }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const escena = new THREE.Scene();
  escena.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const luz = new THREE.DirectionalLight(0xffffff, 1.5);
  luz.position.set(0.25, 0.6, 0.35);
  // sombras: el brazo y las pesas proyectan sombra sobre la estructura y el piso
  luz.castShadow = true;
  luz.shadow.mapSize.set(1024, 1024);
  Object.assign(luz.shadow.camera, { left: -0.28, right: 0.28, top: 0.28, bottom: -0.28, near: 0.2, far: 1.4 });
  luz.shadow.bias = -0.0004;
  luz.shadow.normalBias = 0.0015;
  luz.shadow.radius = 4;
  escena.add(luz, new THREE.HemisphereLight(0xfff8e8, 0x8a7f6a, 0.7));

  const camara = new THREE.PerspectiveCamera(35, 1, 0.01, 10);
  camara.position.set(0.1, 0.14, 0.44);
  const controles = new OrbitControls(camara, renderer.domElement);
  controles.target.set(0, 0.104, 0);
  controles.enablePan = false;
  controles.enableDamping = true;
  controles.minDistance = 0.22;
  controles.maxDistance = 0.8;
  controles.maxPolarAngle = Math.PI * 0.55;

  const { raiz, grupos, definicion } = await armar('balanza');
  const brazo = grupos.brazo;
  const pivote = brazo.userData.pivote;
  escena.add(raiz);
  // piso invisible: solo muestra la sombra de la balanza sobre el fondo
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), new THREE.ShadowMaterial({ opacity: 0.22 }));
  piso.rotation.x = -Math.PI / 2;
  piso.position.y = -0.0005;
  piso.receiveShadow = true;
  escena.add(piso);

  const posiciones = definicion.pesas.posiciones;
  const colgantes = await Promise.all(PESAS.map(async p => {
    const g = new THREE.Group();
    g.add(await pieza(p.id));
    g.userData = { ...p, x: 0 };
    g.position.set(0, (definicion.pesas.altura - pivote[1]) * MM, (definicion.pesas.z - pivote[2]) * MM);
    brazo.add(g);
    return g;
  }));

  escena.traverse(o => { if (o.isMesh && o !== piso) { o.castShadow = true; o.receiveShadow = true; } });

  contenedor.querySelector('.lab-cargando')?.remove();
  contenedor.append(renderer.domElement);
  const estado = Object.assign(document.createElement('div'), { className: 'lab-estado' });
  const pista = Object.assign(document.createElement('div'), { className: 'lab-pista', textContent: 'Arrastra los objetos de colores ↔' });
  contenedor.append(estado, pista);
  const cuentas = document.getElementById('lab-cuentas');

  // ---------- física sencilla: el brazo busca el ángulo que pide el torque
  let angulo = 0, velocidad = 0, tocado = false, celebrado = false;
  const torque = () => colgantes.reduce((s, c) => s + c.userData.masa * c.userData.x / 10, 0);

  function ubicar(c, x) {
    c.userData.x = x;
    c.position.x = x * MM;
  }

  function sortear() {
    const izq = posiciones.filter(x => x < 0), der = posiciones.filter(x => x > 0);
    const lado = Math.random() < 0.5;
    let a, b;
    do {
      a = (lado ? izq : der)[Math.floor(Math.random() * izq.length)];
      b = (lado ? der : izq)[Math.floor(Math.random() * der.length)];
      ubicar(colgantes[0], a); ubicar(colgantes[1], b);
    } while (Math.abs(torque()) < 0.01);
    tocado = false; celebrado = false;
    actualizarTextos();
  }

  function describirLado(signo) {
    const aqui = colgantes.filter(c => Math.sign(c.userData.x) === signo);
    if (!aqui.length) return 'nada · 0';
    const partes = aqui.map(c => `${c.userData.nombre} ${c.userData.masa} × ${Math.abs(c.userData.x) / 10}`);
    const suma = aqui.reduce((s, c) => s + c.userData.masa * Math.abs(c.userData.x) / 10, 0);
    return `${partes.join(' + ')} = ${suma}`;
  }

  function actualizarTextos() {
    const t = torque();
    const equilibrio = Math.abs(t) < 0.01;
    estado.textContent = equilibrio ? '¡Equilibrio!' : t > 0 ? 'Se inclina a la derecha' : 'Se inclina a la izquierda';
    estado.classList.toggle('equilibrio', equilibrio && tocado);
    if (equilibrio && tocado && !celebrado) { celebrado = true; pista.textContent = '¿Hay otra forma de equilibrarla?'; }
    if (!equilibrio) pista.textContent = 'Arrastra los objetos de colores ↔';
    cuentas.innerHTML = `Izquierda: ${describirLado(-1)}<br>Derecha: ${describirLado(1)}<br><small>(peso × agujeros desde el centro)</small>`;
  }

  // ---------- arrastrar los objetos
  const rayo = new THREE.Raycaster();
  const puntero = new THREE.Vector2();
  const plano = new THREE.Plane(new THREE.Vector3(0, 0, 1), -pivote[2] * MM);
  let arrastrando = null;

  function apuntar(e) {
    const r = renderer.domElement.getBoundingClientRect();
    puntero.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    rayo.setFromCamera(puntero, camara);
  }
  function objetoBajo(e) {
    apuntar(e);
    const golpe = rayo.intersectObjects(colgantes, true)[0];
    if (!golpe) return null;
    return colgantes.find(c => c === golpe.object || c.getObjectById(golpe.object.id));
  }
  function alBajar(e) {
    const c = objetoBajo(e);
    if (!c) return;
    e.stopPropagation(); // que OrbitControls no gire la cámara
    arrastrando = c;
    controles.enabled = false;
    renderer.domElement.setPointerCapture(e.pointerId);
    c.scale.setScalar(1.15);
    renderer.domElement.style.cursor = 'grabbing';
  }
  function alMover(e) {
    if (!arrastrando) {
      renderer.domElement.style.cursor = objetoBajo(e) ? 'grab' : '';
      return;
    }
    apuntar(e);
    const p = new THREE.Vector3();
    if (!rayo.ray.intersectPlane(plano, p)) return;
    const x = brazo.worldToLocal(p).x / MM;
    const otro = colgantes.find(c => c !== arrastrando).userData.x;
    const libre = posiciones.filter(v => v !== otro);
    const cerca = libre.reduce((a, b) => Math.abs(b - x) < Math.abs(a - x) ? b : a);
    if (cerca !== arrastrando.userData.x) {
      ubicar(arrastrando, cerca);
      tocado = true;
      actualizarTextos();
    }
  }
  function alSoltar() {
    if (!arrastrando) return;
    arrastrando.scale.setScalar(1);
    arrastrando = null;
    controles.enabled = true;
    renderer.domElement.style.cursor = '';
  }
  contenedor.addEventListener('pointerdown', alBajar, { capture: true });
  renderer.domElement.addEventListener('pointermove', alMover);
  renderer.domElement.addEventListener('pointerup', alSoltar);
  renderer.domElement.addEventListener('pointercancel', alSoltar);

  // ---------- botones del panel
  const verCuentas = document.getElementById('lab-ver-cuentas');
  const alternarCuentas = () => {
    cuentas.hidden = !cuentas.hidden;
    verCuentas.textContent = cuentas.hidden ? 'Ver las cuentas' : 'Ocultar las cuentas';
  };
  verCuentas.addEventListener('click', alternarCuentas);
  document.getElementById('lab-reiniciar').addEventListener('click', sortear);
  document.getElementById('lab-ar').addEventListener('click', () => verEnMesa(MECANISMOS[0], abrirVentana));

  // ---------- tamaño y bucle
  function ajustar() {
    const { width, height } = contenedor.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camara.aspect = width / height;
    camara.updateProjectionMatrix();
  }
  const observador = new ResizeObserver(ajustar);
  observador.observe(contenedor);

  let previo = performance.now();
  function cuadro(ahora) {
    const dt = Math.min(Math.max((ahora - previo) / 1000, 0), 0.05);
    previo = ahora;
    const objetivo = -INCLINACION_MAX * Math.tanh(torque() / 4);
    velocidad += ((objetivo - angulo) * 38 - velocidad * 5.5) * dt;
    angulo += velocidad * dt;
    brazo.rotation.z = angulo;
    for (const c of colgantes) c.rotation.z = -angulo; // cuelgan verticales
    controles.update();
    renderer.render(escena, camara);
  }
  renderer.setAnimationLoop(cuadro);
  sortear();
  contenedor.balanza = { brazo, colgantes, torque, camara }; // para inspección/pruebas

  return () => {
    renderer.setAnimationLoop(null);
    observador.disconnect();
    controles.dispose();
    renderer.dispose();
  };
}
