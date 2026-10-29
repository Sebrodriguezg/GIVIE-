// Pruebas del módulo 0 (ficha 0 y prueba P10 del plan): el álgebra geométrica proyectiva R(3,0,1).
// Correr desde la carpeta taller:  node --test "pruebas/*.test.js"
//
// Las pruebas fijan *qué* debe cumplir cada función, no *cómo* se implementa. Están ordenadas como la tabla
// de la ficha 0 (§6): cada bloque usa lo del bloque anterior.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as pga from '../nucleo/pga.js';

const TOL = 1e-12;

// --- ayudas de las pruebas (no son parte de pga.js) -----------------------------------------------
function blade(indice, valor = 1) {
  const m = new Float64Array(16);
  m[indice] = valor;
  return m;
}
const E = Object.fromEntries(pga.BASE.map((nombre, i) => [nombre, blade(i)]));

function cerca(a, b, tol = TOL, mensaje = '') {
  for (let i = 0; i < 16; i++) {
    if (Math.abs(a[i] - b[i]) > tol) {
      assert.fail(`${mensaje} componente ${pga.BASE[i]}: ${a[i]} ≠ ${b[i]}`);
    }
  }
}
function casiCero(a, tol = TOL, mensaje = '') { cerca(a, new Float64Array(16), tol, mensaje); }
function cercaNum(a, b, tol = TOL, mensaje = '') {
  if (Math.abs(a - b) > tol) assert.fail(`${mensaje} ${a} ≠ ${b}`);
}
function cercaVec(a, b, tol = TOL, mensaje = '') { a.forEach((v, i) => cercaNum(v, b[i], tol, `${mensaje}[${i}]`)); }

// generador pseudoaleatorio con semilla: las pruebas fallan siempre igual, nunca «a veces»
function aleatorio(semilla = 7) {
  let s = semilla;
  return () => (s = (s * 16807) % 2147483647) / 2147483647 * 2 - 1;
}
function multivectorAzar(azar) { return Float64Array.from({ length: 16 }, azar); }
function bivectorAzar(azar, escala = 1) {
  const b = new Float64Array(16);
  for (const i of [3, 5, 6, 9, 10, 12]) b[i] = azar() * escala;
  return b;
}

// ---------------------------------------------------------------------------------------------------
describe('1. productoBlades: índice y signo (ficha §5.1)', () => {
  test('e1 e2 = e12 y e2 e1 = -e12', () => {
    assert.deepEqual(pga.productoBlades(0b0010, 0b0100), [0b0110, 1]);
    assert.deepEqual(pga.productoBlades(0b0100, 0b0010), [0b0110, -1]);
  });
  test('cuadrados: e1² = 1, e0² = 0, e12² = -1, I² = 0', () => {
    assert.deepEqual(pga.productoBlades(0b0010, 0b0010), [0, 1]);
    assert.equal(pga.productoBlades(0b0001, 0b0001)[1], 0);
    assert.deepEqual(pga.productoBlades(0b0110, 0b0110), [0, -1]);
    assert.equal(pga.productoBlades(0b1111, 0b1111)[1], 0);
  });
  test('e123 e123 = -1', () => {
    assert.deepEqual(pga.productoBlades(0b1110, 0b1110), [0, -1]);
  });
});

describe('2. producto geométrico, suma y escalar', () => {
  test('es asociativo', () => {
    const azar = aleatorio(11);
    for (let k = 0; k < 20; k++) {
      const a = multivectorAzar(azar), b = multivectorAzar(azar), c = multivectorAzar(azar);
      cerca(pga.gp(pga.gp(a, b), c), pga.gp(a, pga.gp(b, c)), 1e-10);
    }
  });
  test('distribuye sobre la suma', () => {
    const azar = aleatorio(12);
    const a = multivectorAzar(azar), b = multivectorAzar(azar), c = multivectorAzar(azar);
    cerca(pga.gp(a, pga.suma(b, c)), pga.suma(pga.gp(a, b), pga.gp(a, c)), 1e-12);
  });
  test('ab = a·b + a∧b para vectores: ab + ba = 2 a·b', () => {
    const a = pga.plano(1, 2, 3, 4), b = pga.plano(-2, 1, 5, 0);
    const simetrica = pga.escalar(pga.suma(pga.gp(a, b), pga.gp(b, a)), 0.5);
    cerca(simetrica, blade(0, 1 * -2 + 2 * 1 + 3 * 5)); // e0 no aporta: e0² = 0
  });
});

describe('3. grado y reverso', () => {
  test('grado(x, k) toma solo la parte de grado k', () => {
    const x = multivectorAzar(aleatorio(3));
    const suma = [0, 1, 2, 3, 4].map(k => pga.grado(x, k)).reduce((s, g) => pga.suma(s, g));
    cerca(suma, x);
    for (let i = 0; i < 16; i++) {
      const k = pga.grado(x, 2);
      if (![3, 5, 6, 9, 10, 12].includes(i)) assert.equal(k[i], 0);
    }
  });
  test('reverso: signos + + - - + por grado 0..4', () => {
    const signos = [1, 1, -1, -1, 1];
    for (let i = 0; i < 16; i++) {
      const g = pga.BASE[i] === '1' ? 0 : pga.BASE[i].length - 1;
      cercaNum(pga.reverso(blade(i))[i], signos[g]);
    }
  });
  test('reverso de un producto: (ab)~ = b~ a~', () => {
    const azar = aleatorio(4);
    const a = multivectorAzar(azar), b = multivectorAzar(azar);
    cerca(pga.reverso(pga.gp(a, b)), pga.gp(pga.reverso(b), pga.reverso(a)), 1e-12);
  });
});

describe('4. exterior, dual y regresivo (ficha §3)', () => {
  test('e1 ∧ e2 ∧ e3 = e123 y p ∧ p = 0', () => {
    cerca(pga.wedge(pga.wedge(E.e1, E.e2), E.e3), E.e123);
    casiCero(pga.wedge(pga.plano(1, 2, 3, 4), pga.plano(1, 2, 3, 4)));
  });
  test('dual: x ∧ J(x) = I para cada blade base', () => {
    for (let i = 0; i < 16; i++) cerca(pga.wedge(blade(i), pga.dual(blade(i))), E.e0123, TOL, pga.BASE[i]);
  });
  test('dualInverso deshace dual', () => {
    const x = multivectorAzar(aleatorio(5));
    cerca(pga.dualInverso(pga.dual(x)), x);
  });
  test('la recta por dos puntos (join) contiene a ambos y al punto medio, no a otro', () => {
    const P = pga.punto(1, 2, 3), Q = pga.punto(-2, 0, 5);
    const L = pga.vee(P, Q);
    casiCero(pga.vee(L, P), 1e-12, 'P');
    casiCero(pga.vee(L, Q), 1e-12, 'Q');
    casiCero(pga.vee(L, pga.punto(-0.5, 1, 4)), 1e-12, 'medio');
    assert.ok(Math.max(...pga.vee(L, pga.punto(0, 0, 0)).map(Math.abs)) > 1e-3, 'un punto fuera no debe estar');
  });
});

describe('5. planos y puntos (ficha §3.2)', () => {
  test('punto y puntoDe son inversos', () => {
    cercaVec(pga.puntoDe(pga.punto(1.5, -2, 7)), [1.5, -2, 7]);
  });
  test('el origen es e123', () => cerca(pga.punto(0, 0, 0), E.e123));
  test('meet de los planos x=0, y=0, z=0 es el origen', () => {
    cercaVec(pga.puntoDe(pga.wedge(pga.wedge(pga.plano(1, 0, 0, 0), pga.plano(0, 1, 0, 0)), pga.plano(0, 0, 1, 0))),
      [0, 0, 0]);
  });
  test('el plano x = 2 corta el eje x en (2, 0, 0)', () => {
    const ejeX = pga.wedge(pga.plano(0, 1, 0, 0), pga.plano(0, 0, 1, 0));
    cercaVec(pga.puntoDe(pga.wedge(pga.plano(1, 0, 0, -2), ejeX)), [2, 0, 0]);
  });
  test('un punto está en un plano si p ∧ P = 0', () => {
    casiCero(pga.wedge(pga.plano(1, 1, 1, -6), pga.punto(1, 2, 3)));
  });
});

describe('6. motores: trasladador, rotor y sándwich (ficha §4)', () => {
  test('trasladador(1,2,3) lleva el origen a (1,2,3)', () => {
    cercaVec(pga.puntoDe(pga.sandwich(pga.trasladador(1, 2, 3), pga.punto(0, 0, 0))), [1, 2, 3]);
  });
  test('trasladador mueve planos: x = 0 pasa a x = 1', () => {
    const p = pga.sandwich(pga.trasladador(1, 0, 0), pga.plano(1, 0, 0, 0));
    casiCero(pga.wedge(p, pga.punto(1, 5, -4)));
  });
  test('rotor: +90° alrededor de +z lleva (1,0,0) a (0,1,0) (mano derecha)', () => {
    cercaVec(pga.puntoDe(pga.sandwich(pga.rotor([0, 0, 1], Math.PI / 2), pga.punto(1, 0, 0))), [0, 1, 0]);
  });
  test('rotor con eje que no pasa por el origen: 180° alrededor de la recta x=1, y=0 lleva el origen a (2,0,0)', () => {
    cercaVec(pga.puntoDe(pga.sandwich(pga.rotor([0, 0, 1], Math.PI, [1, 0, 0]), pga.punto(0, 0, 0))), [2, 0, 0]);
  });
  test('los motores están normalizados: M M~ = 1', () => {
    const M = pga.gp(pga.trasladador(3, -1, 2), pga.rotor([1, 2, 2], 0.7, [0, 1, 0]));
    cerca(pga.gp(M, pga.reverso(M)), blade(0, 1));
  });
  test('componer es multiplicar: (M2 M1) X = M2 (M1 X)', () => {
    const M1 = pga.rotor([0, 1, 0], 1.1), M2 = pga.trasladador(0.5, 2, -1);
    const P = pga.punto(1, 2, 3);
    cerca(pga.sandwich(pga.gp(M2, M1), P), pga.sandwich(M2, pga.sandwich(M1, P)));
  });
  test('el orden importa: girar y trasladar no es lo mismo que trasladar y girar (ejercicio 0.6)', () => {
    const G = pga.rotor([0, 0, 1], Math.PI / 2), T = pga.trasladador(3, 0, 0), P = pga.punto(1, 0, 0);
    cercaVec(pga.puntoDe(pga.sandwich(pga.gp(T, G), P)), [3, 1, 0]);
    cercaVec(pga.puntoDe(pga.sandwich(pga.gp(G, T), P)), [0, 4, 0]);
  });
});

describe('7. exponencial, logaritmo y tornillo (ficha §4.2)', () => {
  test('exp de un bivector es un motor: M M~ = 1', () => {
    const azar = aleatorio(21);
    for (let k = 0; k < 20; k++) {
      const M = pga.exp(bivectorAzar(azar));
      cerca(pga.gp(M, pga.reverso(M)), blade(0, 1), 1e-12);
    }
  });
  test('exp de una recta ideal es 1 + B (traslación pura)', () => {
    const B = blade(3, 0.4); // e01
    cerca(pga.exp(B), pga.suma(blade(0, 1), B));
  });
  test('log deshace exp (ángulos menores que π/2)', () => {
    const azar = aleatorio(22);
    for (let k = 0; k < 20; k++) {
      const B = bivectorAzar(azar, 0.5);
      cerca(pga.log(pga.exp(B)), B, 1e-10);
    }
  });
  test('exp(log M) = M para motores compuestos', () => {
    const M = pga.gp(pga.trasladador(1, -2, 0.5), pga.rotor([1, 1, 0], 0.9, [0, 0, 1]));
    cerca(pga.exp(pga.log(M)), M, 1e-12);
  });
  test('tornillo (Chasles): girar 90° en z y avanzar 2 en z es un tornillo de eje z', () => {
    const M = pga.gp(pga.trasladador(0, 0, 2), pga.rotor([0, 0, 1], Math.PI / 2));
    const { eje, angulo, avance } = pga.tornillo(M);
    cercaNum(Math.abs(angulo), Math.PI / 2, 1e-12, 'ángulo');
    cercaNum(Math.abs(avance), 2, 1e-12, 'avance');
    casiCero(pga.vee(eje, pga.punto(0, 0, 0)), 1e-12, 'el eje pasa por el origen');
    casiCero(pga.vee(eje, pga.punto(0, 0, 5)), 1e-12, 'el eje es el eje z');
  });
  test('tornillo de un giro puro alrededor de una recta desplazada recupera esa recta', () => {
    const { eje, avance } = pga.tornillo(pga.rotor([0, 0, 1], 1.2, [3, -1, 0]));
    cercaNum(avance, 0, 1e-12, 'avance');
    casiCero(pga.vee(eje, pga.punto(3, -1, 7)), 1e-12, 'el eje pasa por (3,-1,·)');
  });
});

describe('8. aMatriz: del motor a la matriz 4×4 de three.js (ficha §5.2)', () => {
  test('la identidad da la matriz identidad', () => {
    cercaVec(pga.aMatriz(blade(0, 1)), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  });
  test('trasladador: la traslación queda en los elementos 12, 13 y 14 (columna 4)', () => {
    cercaVec(pga.aMatriz(pga.trasladador(1, 2, 3)), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 2, 3, 1]);
  });
  test('rotor de 90° en z: la primera columna es el eje x girado, (0,1,0)', () => {
    cercaVec(pga.aMatriz(pga.rotor([0, 0, 1], Math.PI / 2)), [0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  });
  test('la matriz y el sándwich mueven igual cualquier punto', () => {
    const M = pga.gp(pga.trasladador(-1, 4, 2), pga.rotor([2, -1, 1], 2.2, [1, 1, 0]));
    const m = pga.aMatriz(M), [x, y, z] = [0.3, -2, 5];
    const conMatriz = [0, 1, 2].map(f => m[f] * x + m[4 + f] * y + m[8 + f] * z + m[12 + f]);
    cercaVec(conMatriz, pga.puntoDe(pga.sandwich(M, pga.punto(x, y, z))));
  });
});
