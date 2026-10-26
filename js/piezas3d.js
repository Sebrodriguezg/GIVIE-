// Carga de piezas del kit (GLB) y armado de mecanismos desde su JSON.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const MM = 0.001;
const cargador = new GLTFLoader();
const cache = new Map();

export function rutaBase() {
  // index.html está en la raíz; las páginas internas en secciones/
  return new URL('../', import.meta.url).href;
}

export async function catalogo() {
  return (await fetch(rutaBase() + 'modelos/piezas/catalogo.json')).json();
}

/** Devuelve una copia lista para usar de la pieza `id` (en metros). */
export async function pieza(id) {
  if (!cache.has(id)) {
    cache.set(id, cargador.loadAsync(`${rutaBase()}modelos/piezas/${id}.glb`).then(g => g.scene));
  }
  const original = await cache.get(id);
  const copia = original.clone(true);
  copia.userData.pieza = id;
  return copia;
}

function ubicar(obj, pos, rot = [0, 0, 0]) {
  obj.position.set(pos[0] * MM, pos[1] * MM, pos[2] * MM);
  obj.rotation.set(...rot.map(THREE.MathUtils.degToRad), 'XYZ');
}

/**
 * Arma un mecanismo. Devuelve { raiz, grupos, definicion } donde cada grupo
 * (p. ej. "brazo") es un Object3D ubicado en su pivote.
 */
export async function armar(id) {
  const definicion = await (await fetch(`${rutaBase()}modelos/mecanismos/${id}.json`)).json();
  const raiz = new THREE.Group();
  const grupos = {};
  for (const [nombre, g] of Object.entries(definicion.grupos || {})) {
    const grupo = new THREE.Group();
    grupo.name = nombre;
    grupo.position.set(...g.pivote.map(v => v * MM));
    grupo.userData.pivote = g.pivote;
    raiz.add(grupo);
    grupos[nombre] = grupo;
  }
  await Promise.all(definicion.piezas.map(async p => {
    const obj = await pieza(p.id);
    const pivote = p.grupo ? grupos[p.grupo].userData.pivote : [0, 0, 0];
    ubicar(obj, p.pos.map((v, i) => v - pivote[i]), p.rot);
    (p.grupo ? grupos[p.grupo] : raiz).add(obj);
  }));
  return { raiz, grupos, definicion };
}

export { MM };
