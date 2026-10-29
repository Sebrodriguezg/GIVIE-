// Álgebra geométrica proyectiva R(3,0,1): el lenguaje de todo el simulador.
// Teoría y ejercicios: estudio/ficha00_pga.tex.  Pruebas: pruebas/pga.test.js (node --test "pruebas/*.test.js").
//
// Representación (ficha §5): un multivector es un Float64Array(16). El índice de cada componente es el
// *bitmap* de su blade base: bit 0 = e0, bit 1 = e1, bit 2 = e2, bit 3 = e3, siempre en orden ascendente.
//   e12 → 0b0110 = 6     e013 → 0b1011 = 11     I = e0123 → 0b1111 = 15
// Métrica: e0² = 0, e1² = e2² = e3² = 1.
//
// Convenciones de este archivo (fijadas por las pruebas):
//   plano  a·x + b·y + c·z + d = 0   ↔   a e1 + b e2 + c e3 + d e0
//   punto  (x, y, z)                 ↔   e123 + x e032 + y e013 + z e021   (ojo: e032 = -e023, e021 = -e012)
//   motor  M actúa con el sándwich X' = M X M~ ; componer «primero M1, luego M2» es M2 M1.
//   rotor  ángulo positivo = regla de la mano derecha alrededor de la dirección del eje.

/** Nombre de cada blade base, por índice (bitmap). */
export const BASE = ['1', 'e0', 'e1', 'e01', 'e2', 'e02', 'e12', 'e012',
  'e3', 'e03', 'e13', 'e013', 'e23', 'e023', 'e123', 'e0123'];

const pendiente = seccion => { throw new Error(`Por implementar (ficha 0, ${seccion})`); };

// --------------------------------------------------------------------------------------------------
// 1. Producto de blades base (ficha §5.1)

/**
 * Producto de dos blades base dados por sus bitmaps.
 * Devuelve [índice, signo]: el blade resultante es a XOR b; el signo sale de reordenar los generadores
 * (cada intercambio de dos distintos cambia el signo) y de la métrica (e0² = 0 anula el producto).
 * @param {number} a bitmap del primer blade (0..15)
 * @param {number} b bitmap del segundo blade (0..15)
 * @returns {[number, number]} [a ^ b, +1 | -1 | 0]
 */
export function productoBlades(a, b) { return pendiente('§5.1'); }

// --------------------------------------------------------------------------------------------------
// 2. Producto geométrico y operaciones lineales (ficha §1 y §5.1)

/** Producto geométrico xy: suma de los productos de todas las componentes (precalcular la tabla 16×16). */
export function gp(x, y) { return pendiente('§5.1'); }

/** Suma de multivectores, componente a componente. */
export function suma(x, y) { return pendiente('§5.2'); }

/** Producto de un multivector por un número. */
export function escalar(x, k) { return pendiente('§5.2'); }

// --------------------------------------------------------------------------------------------------
// 3. Grado y reverso (ficha §2)

/** Parte de grado k de x: ⟨x⟩_k. El grado de un blade es el número de bits en 1 de su índice. */
export function grado(x, k) { return pendiente('§2'); }

/** Reverso x~: la parte de grado k se multiplica por (-1)^(k(k-1)/2). */
export function reverso(x) { return pendiente('§2'); }

// --------------------------------------------------------------------------------------------------
// 4. Exterior, dualidad y regresivo (ficha §3.2)

/** Producto exterior x ∧ y (meet): solo los pares de blades sin generadores comunes. */
export function wedge(x, y) { return pendiente('§3.2'); }

/** Dualidad de Poincaré J: el blade i va al 15 - i, con el signo que hace e_i ∧ J(e_i) = I. */
export function dual(x) { return pendiente('§3.2'); }

/** Inversa de J: dualInverso(dual(x)) = x. */
export function dualInverso(x) { return pendiente('§3.2'); }

/** Producto regresivo x ∨ y (join) = J⁻¹(J(x) ∧ J(y)). La recta por dos puntos es vee(P, Q). */
export function vee(x, y) { return pendiente('§3.2, ec. 3.2'); }

// --------------------------------------------------------------------------------------------------
// 5. Elementos geométricos (ficha §3.2)

/** Plano a·x + b·y + c·z + d = 0. */
export function plano(a, b, c, d) { return pendiente('§3.2, ec. 3.1'); }

/** Punto euclídeo (x, y, z), normalizado (coeficiente de e123 igual a 1). */
export function punto(x, y, z) { return pendiente('§3.2'); }

/** Coordenadas [x, y, z] de un punto (dividiendo por su coeficiente de e123). */
export function puntoDe(P) { return pendiente('§3.2'); }

// --------------------------------------------------------------------------------------------------
// 6. Motores (ficha §4)

/** Sándwich M X M~: mueve X con el motor M. */
export function sandwich(M, X) { return pendiente('§4.1, ec. 4.1'); }

/** Trasladador que lleva el origen a (x, y, z). Ejercicio 0.4: decide el signo con el cálculo, no adivinando. */
export function trasladador(x, y, z) { return pendiente('§4.1, ej. 0.4'); }

/**
 * Rotor de giro `angulo` (radianes, mano derecha) alrededor de la recta con dirección `direccion`
 * que pasa por `por`. Construye la recta con vee de dos puntos, normalízala (L² = -1) y usa la ec. 4.2.
 */
export function rotor(direccion, angulo, por = [0, 0, 0]) { return pendiente('§4.2, ej. 0.2'); }

/** Exponencial de un bivector B = (θ + d I) L  →  (cos θ + L sen θ)(1 + d I L). Si θ = 0: 1 + B. */
export function exp(B) { return pendiente('§4.2, ec. 4.4 y 4.5'); }

/** Logaritmo de un motor: el bivector B con exp(B) = M (ejercicio 0.5). */
export function log(M) { return pendiente('§4.2, ej. 0.5'); }

/**
 * Teorema de Chasles: el tornillo de un motor.
 * @returns {{eje: Float64Array, angulo: number, avance: number}} recta normalizada, ángulo de giro y avance
 *   a lo largo del eje (M = exp(B), B = (θ + d I) L  →  ángulo 2θ, avance 2d).
 */
export function tornillo(M) { return pendiente('§4.2'); }

// --------------------------------------------------------------------------------------------------
// 7. Salida hacia el dibujo (ficha §5.2)

/**
 * Matriz 4×4 de three.js (16 números, por columnas) equivalente al motor M.
 * Columnas 1-3: imágenes por el sándwich de las direcciones e032, e013, e021; columna 4: imagen del origen.
 */
export function aMatriz(M) { return pendiente('§5.2'); }
