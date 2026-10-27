// Fondo: piezas del kit flotando y girando con el scroll. Cada visita trae un conjunto distinto.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { catalogo, pieza } from './piezas3d.js';

const CONJUNTOS = [
  { nombre: 'Lluvia de vigas', ids: ['viga-5', 'viga-9', 'viga-11', 'viga-15', 'pletina-7'] },
  { nombre: 'Ruedas y más ruedas', ids: ['rueda-grande', 'rueda-mediana', 'rueda-pequena', 'maza-grande', 'maza-mediana', 'maza-pequena'] },
  { nombre: 'Caja de tornillos', ids: ['tornillo-10', 'tornillo-20', 'tornillo-30', 'tuerca', 'tuerca-mariposa'] },
  { nombre: 'Vigas y mariposas', ids: ['viga-9', 'viga-15', 'tuerca-mariposa', 'tornillo-30', 'pletina-7', 'viga-5'] },
  { nombre: 'Todo el kit', ids: null },
];

const lienzo = document.getElementById('fondo');
const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
const celular = matchMedia('(max-width: 700px)').matches;

const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
const escena = new THREE.Scene();
escena.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const luz = new THREE.DirectionalLight(0xffffff, 1.6);
luz.position.set(3, 5, 6);
escena.add(luz, new THREE.HemisphereLight(0xfff6e0, 0x2a1b7e, 0.8));
const camara = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
camara.position.z = 10;
const ALTO_VISTA = 2 * 10 * Math.tan(THREE.MathUtils.degToRad(20)); // altura visible en z=0
const PARALAJE = 0.55;

function azar(a, b) { return a + Math.random() * (b - a); }

function elegirConjunto() {
  let anterior = null;
  try { anterior = localStorage.getItem('fondo-conjunto'); } catch { /* sin almacenamiento */ }
  const opciones = CONJUNTOS.filter(c => c.nombre !== anterior);
  const elegido = opciones[Math.floor(Math.random() * opciones.length)];
  try { localStorage.setItem('fondo-conjunto', elegido.nombre); } catch { /* sin almacenamiento */ }
  return elegido;
}

const flotantes = [];
let inicio = performance.now();

async function poblar() {
  const conjunto = elegirConjunto();
  document.dispatchEvent(new CustomEvent('fondo:conjunto', { detail: conjunto.nombre }));
  const cat = (await catalogo()).filter(p => p.categoria !== 'accesorios');
  const ids = conjunto.ids ?? cat.map(p => p.id);
  const paginas = document.documentElement.scrollHeight / altoFijo;
  const total = Math.round(Math.min(celular ? 40 : 72, 10 + paginas * PARALAJE * (celular ? 7.5 : 13)));
  const recorrido = (paginas - 1) * ALTO_VISTA * PARALAJE;

  const tareas = [];
  for (let i = 0; i < total; i++) {
    const id = ids[i % ids.length];
    tareas.push(pieza(id).then(obj => {
      const caja = new THREE.Box3().setFromObject(obj);
      const tam = caja.getSize(new THREE.Vector3());
      obj.position.sub(caja.getCenter(new THREE.Vector3()));
      const pivote = new THREE.Group();
      pivote.add(obj);
      const escala = azar(1.0, 1.9) / Math.max(tam.x, tam.y, tam.z);
      pivote.scale.setScalar(escala);
      // repartidas a lo largo de toda la página, alternando lados para no tapar el centro
      const lado = i % 2 ? 1 : -1;
      const destino = new THREE.Vector3(
        lado * (celular ? azar(0.9, 2.4) : azar(2.4, 4.6)),
        ALTO_VISTA / 2 - (i + Math.random()) / total * (recorrido + ALTO_VISTA),
        azar(-5, 1),
      );
      pivote.userData = {
        id, destino,
        salida: destino.clone().add(new THREE.Vector3(azar(-8, 8), azar(4, 10), azar(-8, 4))),
        retraso: i * 0.05,
        base: new THREE.Quaternion().setFromEuler(new THREE.Euler(azar(0, 6.28), azar(0, 6.28), azar(0, 6.28))),
        eje: new THREE.Vector3(azar(-1, 1), azar(-1, 1), azar(-1, 1)).normalize(),
        vel: azar(0.5, 1.4) * (Math.random() < 0.5 ? -1 : 1),
        empuje: 0,
      };
      pivote.position.copy(pivote.userData.salida);
      escena.add(pivote);
      flotantes.push(pivote);
    }));
  }
  await Promise.all(tareas);
  inicio = performance.now();
}

// En el celular la barra de direcciones aparece y se esconde al hacer scroll y cambia innerHeight.
// Se usa un alto fijo (el mayor visto con este ancho) para que el fondo no salte ni se redimensione.
const tactil = matchMedia('(pointer: coarse)').matches;
let anchoVisto = 0, altoFijo = innerHeight;
function ajustar() {
  const w = innerWidth;
  if (tactil && w === anchoVisto && innerHeight <= altoFijo) return;
  altoFijo = tactil && w !== anchoVisto ? Math.max(innerHeight, document.documentElement.clientHeight) : innerHeight;
  anchoVisto = w;
  renderer.setSize(w, altoFijo, false);
  camara.aspect = w / altoFijo;
  camara.updateProjectionMatrix();
}

const q = new THREE.Quaternion();
let antes = performance.now();
let desplazado = 0;
function cuadro(ahora) {
  const t = (ahora - inicio) / 1000;
  const dt = Math.min((ahora - antes) / 1000, 0.05);
  antes = ahora;
  // el scroll se sigue con suavidad: un salto brusco se reparte en unos pocos cuadros
  const meta = scrollY / altoFijo;
  desplazado += (meta - desplazado) * (1 - Math.exp(-dt * 10));
  if (Math.abs(meta - desplazado) > 3) desplazado = meta; // saltos largos (enlaces del menú)
  camara.position.y = -desplazado * ALTO_VISTA * PARALAJE;
  for (const p of flotantes) {
    const d = p.userData;
    const k = Math.min(Math.max((t - d.retraso) / 1.4, 0), 1);
    const suave = 1 - Math.pow(1 - k, 3);
    p.position.lerpVectors(d.salida, d.destino, suave);
    if (!reducido) p.position.y += Math.sin(t * 0.6 + d.retraso * 9) * 0.06;
    d.empuje *= 0.96;
    const angulo = desplazado * 1.6 * d.vel + (reducido ? 0 : t * 0.12 * d.vel) + d.empuje;
    q.setFromAxisAngle(d.eje, angulo);
    p.quaternion.copy(d.base).premultiply(q);
  }
  renderer.render(escena, camara);
}

// tocar una pieza muestra su nombre
const etiqueta = document.getElementById('etiqueta-pieza');
const rayo = new THREE.Raycaster();
let nombres = {};
let ocultar;
// ¿Lo que hay bajo el dedo tapa el fondo? (una tarjeta, una imagen, una franja de color...)
function tapado(el) {
  for (; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
    if (el.matches('a, button, input, select, textarea, img, video, iframe, canvas, svg, model-viewer')) return true;
    const estilo = getComputedStyle(el);
    if (estilo.backgroundImage !== 'none') return true;
    const alfa = estilo.backgroundColor.match(/[\d.]+/g)?.[3];
    if (estilo.backgroundColor !== 'transparent' && (alfa === undefined || Number(alfa) > 0.3)) return true;
  }
  return false;
}

addEventListener('pointerdown', e => {
  if (tapado(e.target)) return;
  rayo.setFromCamera(new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / altoFijo) * 2 + 1), camara);
  const golpe = rayo.intersectObjects(flotantes, true)[0];
  if (!golpe) return;
  let p = golpe.object;
  while (p.parent && !flotantes.includes(p)) p = p.parent;
  p.userData.empuje += 6;
  etiqueta.textContent = nombres[p.userData.id] ?? p.userData.id;
  etiqueta.style.left = e.clientX + 'px';
  etiqueta.style.top = e.clientY + 'px';
  etiqueta.hidden = false;
  clearTimeout(ocultar);
  ocultar = setTimeout(() => { etiqueta.hidden = true; }, 1800);
});

ajustar();
addEventListener('resize', ajustar);
catalogo().then(c => { nombres = Object.fromEntries(c.map(p => [p.id, p.nombre])); });
poblar();
renderer.setAnimationLoop(cuadro);
document.addEventListener('visibilitychange', () => {
  renderer.setAnimationLoop(document.hidden ? null : cuadro);
});
