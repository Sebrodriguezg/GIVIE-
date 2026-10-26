// Balanza de brazos iguales: arrastra los objetos por el brazo y busca el equilibrio.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { armar, pieza, rutaBase, MM } from './piezas3d.js';

const PESAS = [
  { id: 'pesa-pesada', masa: 2, nombre: 'pesado' },
  { id: 'pesa-liviana', masa: 1, nombre: 'liviano' },
];
const INCLINACION_MAX = 0.3; // rad

export async function montar(contenedor, { abrirVentana }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const escena = new THREE.Scene();
  escena.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const luz = new THREE.DirectionalLight(0xffffff, 1.5);
  luz.position.set(0.3, 0.6, 0.5);
  escena.add(luz, new THREE.HemisphereLight(0xfff8e8, 0x8a7f6a, 0.7));

  const camara = new THREE.PerspectiveCamera(35, 1, 0.01, 10);
  camara.position.set(0.1, 0.15, 0.4);
  const controles = new OrbitControls(camara, renderer.domElement);
  controles.target.set(0, 0.118, 0);
  controles.enablePan = false;
  controles.enableDamping = true;
  controles.minDistance = 0.22;
  controles.maxDistance = 0.8;
  controles.maxPolarAngle = Math.PI * 0.55;

  const { raiz, grupos, definicion } = await armar('balanza');
  const brazo = grupos.brazo;
  const pivote = brazo.userData.pivote;
  escena.add(raiz);
  const piso = new THREE.Mesh(new THREE.CircleGeometry(0.11, 48), new THREE.MeshStandardMaterial({ color: 0xe6dcc2, roughness: 1 }));
  piso.rotation.x = -Math.PI / 2;
  piso.position.y = -0.0005;
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
  document.getElementById('lab-ar').addEventListener('click', () => verEnMesa(abrirVentana));

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

// ---------- realidad aumentada con <model-viewer>
let modelViewerListo;
function cargarScript(src) {
  return new Promise((ok, falla) => {
    const s = Object.assign(document.createElement('script'), { src, onload: ok, onerror: falla });
    if (src.includes('model-viewer')) s.type = 'module';
    document.head.append(s);
  });
}

async function verEnMesa(abrirVentana) {
  modelViewerListo ??= cargarScript('https://cdn.jsdelivr.net/npm/@google/model-viewer@3.5.0/dist/model-viewer.min.js');
  const caja = document.createElement('div');
  caja.innerHTML = `
    <h3 class="titulo" style="font-size:2rem;margin-bottom:8px">La balanza en tu mesa</h3>
    <model-viewer src="${rutaBase()}modelos/mecanismos/balanza.glb" alt="Balanza de brazos iguales armada con el kit ATA EPE"
      ar ar-modes="webxr scene-viewer quick-look" ar-scale="auto" camera-controls autoplay
      shadow-intensity="1" exposure="1.05" camera-orbit="20deg 75deg auto"
      style="width:min(84vw,620px);height:min(58vh,460px);background:radial-gradient(#fffaf0,#efe6cf);border-radius:16px">
      <button slot="ar-button" class="boton boton-rojo" style="position:absolute;left:50%;bottom:14px;transform:translateX(-50%)">Ponerla en mi mesa</button>
    </model-viewer>
    <div id="ar-ayuda"></div>`;
  abrirVentana(caja);
  await modelViewerListo;
  const visor = caja.querySelector('model-viewer');
  await customElements.whenDefined('model-viewer');
  const ayuda = caja.querySelector('#ar-ayuda');
  const explicar = () => {
    if (visor.canActivateAR) {
      ayuda.innerHTML = '<p>Apunta la cámara a una mesa o al piso y toca la pantalla para ubicarla.</p>';
      return;
    }
    const url = location.href.split('#')[0] + '#m-balanza';
    ayuda.innerHTML = `<p style="font-family:var(--mano);font-size:1.3rem;margin:12px 0 0">Ábrela en tu celular para verla sobre tu mesa:</p><div class="qr" id="qr"></div>`;
    cargarScript('https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js').then(() => {
      const qr = window.qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      ayuda.querySelector('#qr').innerHTML = qr.createSvgTag({ cellSize: 5, margin: 2, scalable: false });
    });
  };
  visor.addEventListener('load', explicar, { once: true });
  if (visor.loaded) explicar();
}
