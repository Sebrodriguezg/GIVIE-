"""Genera los modelos 3D (GLB, escala real) de las piezas del kit ATA EPE.

Uso:  .venv/bin/python herramientas/generar_piezas.py
Salida: modelos/piezas/*.glb  +  modelos/piezas/catalogo.json  +  modelos/texturas/plastico.jpg

Cada pieza sale en dos capas: el cuerpo y el interior de los agujeros (más oscuro), con una
textura sutil de plástico impreso en 3D y bordes biselados para que los agujeros se lean bien.

Medidas en mm (ver recursos/piezas/medidas.md); se exportan en metros para que
la realidad aumentada muestre las piezas a su tamaño real. Eje Y hacia arriba.
"""
import json
import math
from functools import lru_cache
from pathlib import Path

import numpy as np
import trimesh
from manifold3d import Manifold, Mesh, set_circular_segments
from PIL import Image

set_circular_segments(48)

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / "modelos" / "piezas"

PASO = 10.0          # retícula del kit
AGUJERO = 4.6        # agujero pasante (tornillo de 4 mm gira libre)
CHAFLAN = 0.5        # bisel en la boca de los agujeros: atrapa la luz y los hace legibles
TEXTURA = RAIZ / "modelos" / "texturas" / "plastico.jpg"
TEXTURA_MM = 4.0     # una repetición de la textura cada 4 mm
COLORES = {
    "azul": (31, 79, 214),
    "gris": (167, 170, 174),
    "negro": (34, 34, 38),
    "amarillo": (246, 196, 18),
    "naranja": (247, 166, 28),
    "metal": (190, 194, 200),
    "rojo": (200, 32, 46),
    "celeste": (56, 168, 222),
    "blanco": (246, 244, 238),
    "piel": (238, 198, 150),
    "cafe": (125, 78, 42),
    "rosado": (242, 150, 190),
    "madera": (214, 170, 110),
    "azul-oscuro": (38, 58, 140),
    "naranja-pez": (250, 122, 30),
    "agua": (120, 190, 230),
}


def cilindro(r, h, eje="y"):
    """Cilindro centrado en el origen a lo largo del eje dado."""
    c = Manifold.cylinder(h, r, r, 0, True)          # a lo largo de Z
    if eje == "y":
        c = c.rotate([90, 0, 0])
    elif eje == "x":
        c = c.rotate([0, 90, 0])
    return c


def caja(x, y, z):
    return Manifold.cube([x, y, z], True)


def caja_redondeada(x, y, z, r=0.7):
    """Caja centrada con las aristas redondeadas (envolvente de 8 esferas)."""
    esquinas = Manifold()
    for sx in (-1, 1):
        for sy in (-1, 1):
            for sz in (-1, 1):
                esquinas += Manifold.sphere(r, 12).translate([sx * (x / 2 - r), sy * (y / 2 - r), sz * (z / 2 - r)])
    return esquinas.hull()


def taladro(r, largo, eje="y", chaflan=CHAFLAN):
    """Agujero pasante centrado para una pared de grosor `largo`, con bisel en ambas bocas."""
    c = Manifold.cylinder(largo + 2, r, r, 24, True)       # 24 lados bastan para un agujero de 4.6 mm
    boca = Manifold.cylinder(chaflan + 1, r, r + chaflan + 1, 24, False).translate([0, 0, largo / 2 - chaflan])
    c = c + boca + boca.mirror([0, 0, 1])
    if eje == "y":
        c = c.rotate([90, 0, 0])
    elif eje == "x":
        c = c.rotate([0, 90, 0])
    return c


def disco(r, alto, bisel=0.5, abajo=False):
    """Disco a lo largo de Y, de y=0 a y=alto, con el borde de arriba (y opcionalmente el de abajo) biselado."""
    d = Manifold.cylinder(alto - bisel * (1 + abajo), r, r, 0, False).translate([0, 0, bisel * abajo])
    d += Manifold.cylinder(bisel, r, r - bisel, 0, False).translate([0, 0, alto - bisel])
    if abajo:
        d += Manifold.cylinder(bisel, r - bisel, r, 0, False)
    return d.rotate([-90, 0, 0])


# ---------------------------------------------------------------- vigas
def viga(n):
    """Viga cuadrada 10x10 de n posiciones; agujeros alternados en Y y Z."""
    cuerpo = caja_redondeada(n * PASO, PASO, PASO)
    for i in range(n):
        x = (i - (n - 1) / 2) * PASO
        eje = "y" if i % 2 == 0 else "z"
        cuerpo -= taladro(AGUJERO / 2, PASO, eje).translate([x, 0, 0])
    return cuerpo


# ---------------------------------------------------------------- pletina
def pletina(n=7, ancho=10.5, espesor=2.0):
    """Pletina flexible con extremos redondeados (forma de estadio)."""
    largo = (n - 1) * PASO
    cuerpo = caja(largo, espesor, ancho)
    for s in (-1, 1):
        cuerpo += cilindro(ancho / 2, espesor).translate([s * largo / 2, 0, 0])
    for i in range(n):
        cuerpo -= taladro(AGUJERO / 2, espesor, chaflan=0.3).translate([(i - (n - 1) / 2) * PASO, 0, 0])
    return cuerpo


# ---------------------------------------------------------------- ruedas
def patron_agujeros(tam):
    """Centros (x, z) de los agujeros de cada tamaño de rueda (sin el central)."""
    pts = []
    if tam == "grande":
        for i in range(-3, 4):
            for j in range(-3, 4):
                if (i, j) != (0, 0) and i * i + j * j <= 13:
                    pts.append((i * PASO, j * PASO))
        pts += [(44, 0), (-44, 0), (0, 44), (0, -44)]
    else:
        # retícula de 10 mm girada 45°
        lim = 20 if tam == "mediana" else 10
        d = PASO / math.sqrt(2)
        for a in range(-3, 4):
            for b in range(-3, 4):
                x, z = (a - b) * d, (a + b) * d
                if 0 < math.hypot(x, z) <= lim + 0.1:
                    pts.append((x, z))
    return pts


RUEDAS = {  # diámetro, posición de los pines (x, z)
    "grande": (98.0, [(30, 30), (-30, -30)]),
    "mediana": (55.0, [(8.6, 21.3), (-8.6, -21.3)]),
    "pequena": (34.0, [(0, 12.5), (0, -12.5)]),
}


def rueda(tam):
    """Rueda: disco base 2 mm + escalón 3 mm (total 5 mm) con 2 pines de 2 mm."""
    D, pines = RUEDAS[tam]
    cuerpo = disco(D / 2, 2, 0.5, abajo=True)
    cuerpo += disco(D / 2 - 1.5, 3, 0.5).translate([0, 2, 0])
    for x, z in pines:
        cuerpo += disco(1.4, 2, 0.3).translate([x, 5, z])
    for x, z in patron_agujeros(tam) + [(0, 0)]:
        cuerpo -= taladro(AGUJERO / 2, 5).translate([x, 2.5, z])
    return cuerpo


def maza(tam):
    """Disco-maza: placa 2 mm + buje central de 8 mm; encaja en los pines de la rueda."""
    D, pines = RUEDAS[tam]
    cuerpo = disco(D / 2 - 1.5, 2, 0.5)
    cuerpo += disco(5.0, 8, 0.6).translate([0, 2, 0])
    cuerpo -= taladro(AGUJERO / 2, 10).translate([0, 5, 0])
    for x, z in patron_agujeros(tam):
        cuerpo -= taladro(AGUJERO / 2, 2, chaflan=0.3).translate([x, 1, z])
    for x, z in pines:
        cuerpo -= taladro(1.6, 2, chaflan=0.3).translate([-x, 1, z])  # espejo: la maza va volteada
    return cuerpo


# ---------------------------------------------------------------- tornillería
PASO_ROSCA = 0.9     # mm (M4 real: 0.7; un poco más abierto para que se vea en pantalla)


def rosca(largo, r_ext=1.95, r_int=1.5, por_vuelta=16):
    """Vástago roscado a lo largo de Y, de y=0 a y=largo.
    Una sola superficie helicoidal: raíces R_i y crestas C_i (media vuelta de paso más arriba); cada flanco
    une una vuelta con la siguiente. Los extremos se cierran con un abanico al eje y se recortan después."""
    N = por_vuelta
    n = int((largo + 3 * PASO_ROSCA) / PASO_ROSCA * N) + 1
    vert = []
    for i in range(n):
        a = 2 * math.pi * i / N
        z = PASO_ROSCA * (i / N - 1.5)
        c, s = math.cos(a), math.sin(a)
        vert += [(r_int * c, r_int * s, z), (r_ext * c, r_ext * s, z + PASO_ROSCA / 2)]
    R, C = (lambda i: 2 * i), (lambda i: 2 * i + 1)
    caras = []
    for i in range(n - 1):
        caras += [(R(i), R(i + 1), C(i + 1)), (R(i), C(i + 1), C(i))]                  # flanco de abajo
        if i + N + 1 < n:
            caras += [(C(i), C(i + 1), R(i + 1 + N)), (C(i), R(i + 1 + N), R(i + N))]   # flanco de arriba
    abajo, arriba = len(vert), len(vert) + 1
    vert += [(0, 0, vert[R(0)][2] + PASO_ROSCA / 2), (0, 0, vert[C(n - 1)][2] - PASO_ROSCA / 2)]
    borde_abajo = [R(i) for i in range(N + 1)] + [C(0)]
    borde_arriba = [C(i) for i in range(n - 1 - N, n)] + [R(n - 1)]
    caras += [(abajo, b, a) for a, b in zip(borde_abajo, borde_abajo[1:] + borde_abajo[:1])]
    caras += [(arriba, a, b) for a, b in zip(borde_arriba, borde_arriba[1:] + borde_arriba[:1])]
    malla = trimesh.Trimesh(vert, caras, process=False)
    trimesh.repair.fix_winding(malla)
    if malla.volume < 0:
        malla.invert()
    helice = Manifold(Mesh(vert_properties=np.asarray(malla.vertices, np.float32),
                           tri_verts=np.asarray(malla.faces, np.uint32)))
    recorte = Manifold.cylinder(0.6, r_int - 0.1, r_ext + 0.05, 0, False)        # punta achaflanada
    recorte += Manifold.cylinder(largo - 0.6, r_ext + 0.05, r_ext + 0.05, 0, False).translate([0, 0, 0.6])
    return (helice ^ recorte).rotate([-90, 0, 0])


def tornillo(largo):
    """Tornillo de cabeza redonda con ranura en cruz (estrella / Phillips) y rosca."""
    cabeza = disco(3.6, 2.6, 0.9).translate([0, largo, 0])
    cruz = caja(4.4, 2.2, 1.15) + caja(1.15, 2.2, 4.4)                    # ranuras de la estrella
    cruz += Manifold.cylinder(1.6, 0.2, 1.4, 0, False).rotate([-90, 0, 0]).translate([0, -1.6, 0])  # centro cónico
    cruz = cruz.translate([0, largo + 2.6, 0])
    return (cabeza - cruz) + rosca(largo + 0.3)


DELGADEZ_TUERCA = 0.7   # las tuercas del kit son un 30 % más bajas que el primer modelo


def rosca_interna(alto):
    """Hueco roscado a lo largo de Y, centrado: una varilla roscada (un poco holgada) que se resta.
    Sobresale por ambos lados para que la punta achaflanada quede por fuera."""
    largo = alto + 2
    return rosca(largo, r_ext=2.05, r_int=1.6).translate([0, -largo / 2, 0])


def tuerca():
    alto = 3.2 * DELGADEZ_TUERCA
    hexagono = Manifold.cylinder(alto, 4.0, 4.0, 6, True).rotate([90, 0, 0])
    return hexagono - rosca_interna(alto)


def tuerca_mariposa():
    cuerpo = Manifold.cylinder(5.0, 3.6, 2.8, 0, True).rotate([-90, 0, 0])
    for s in (-1, 1):
        oreja = caja(6, 7, 1.6).translate([s * 6, 1.5, 0])
        oreja += cilindro(3.0, 1.6, "z").translate([s * 8.5, 3.5, 0])
        cuerpo += oreja
    cuerpo = cuerpo.scale([1, DELGADEZ_TUERCA, 1])
    alto = cuerpo.bounding_box()[4] - cuerpo.bounding_box()[1]
    return cuerpo - rosca_interna(alto + 4).translate([0, (cuerpo.bounding_box()[4] + cuerpo.bounding_box()[1]) / 2, 0])


# ---------------------------------------------------------------- pesas (balanza)
def varilla(largo):
    """Eje / varilla roscada de 4 mm, centrada, a lo largo de Y."""
    return cilindro(1.95, largo)


def pesa(lado, cuerda=28.0):
    """Objeto colgante: el origen es el punto de donde cuelga (arriba)."""
    gancho = cilindro(2.6, 1.4, "z") - cilindro(1.6, 3, "z")
    hilo = cilindro(0.5, cuerda).translate([0, -cuerda / 2 - 2, 0])
    cuerpo = caja(lado, lado, lado).translate([0, -cuerda - 2 - lado / 2, 0])
    return gancho + hilo + cuerpo


# ---------------------------------------------------------------- exportación
def lineal(c):
    """glTF guarda el color en espacio lineal; los de COLORES están en sRGB."""
    s = c / 255
    s = s / 12.92 if s <= 0.04045 else ((s + 0.055) / 1.055) ** 2.4
    return round(s * 255)


@lru_cache(maxsize=1)
def textura_plastico():
    """Mapa de normales repetible: líneas de capa de impresión 3D + grano fino de plástico."""
    n = 128
    rng = np.random.default_rng(7)
    ruido = np.real(np.fft.ifft2(np.fft.fft2(rng.normal(size=(n, n))) *
                                 np.exp(-(np.add.outer(np.fft.fftfreq(n) ** 2, np.fft.fftfreq(n) ** 2)) / 0.004)))
    ruido /= np.abs(ruido).max()
    filas = np.arange(n)[:, None]
    altura = 0.55 * np.sin(2 * np.pi * filas * 16 / n) + 0.45 * ruido      # 16 capas en 4 mm
    dy, dx = np.gradient(altura)
    fuerza = 2.2
    normal = np.dstack([-dx * fuerza, -dy * fuerza, np.ones_like(altura)])
    normal /= np.linalg.norm(normal, axis=2, keepdims=True)
    imagen = Image.fromarray(((normal * 0.5 + 0.5) * 255).astype(np.uint8))
    TEXTURA.parent.mkdir(parents=True, exist_ok=True)
    imagen.save(TEXTURA, quality=88)
    return Image.open(TEXTURA)


def uv_triplanar(vertices_mm, normales):
    """Coordenadas de textura proyectando cada vértice sobre el plano de su cara dominante."""
    eje = np.abs(normales).argmax(axis=1)
    uv = np.empty((len(vertices_mm), 2))
    for k, (a, b) in enumerate(((2, 1), (0, 2), (0, 1))):   # normal en X: (z, y); en Y: (x, z); en Z: (x, y)
        sel = eje == k
        uv[sel] = vertices_mm[sel][:, [a, b]]
    return uv / TEXTURA_MM


def caras_interiores(malla_mm):
    """Caras dentro de agujeros (o ranuras): mirando por su normal, chocan con la misma pieza muy cerca."""
    normales = malla_mm.face_normals
    origenes = malla_mm.triangles_center + normales * 0.01
    puntos, rayo, _ = malla_mm.ray.intersects_location(origenes, normales, multiple_hits=False)
    interior = np.zeros(len(malla_mm.faces), dtype=bool)
    if not len(rayo):
        return interior
    distancia = np.linalg.norm(puntos - origenes[rayo], axis=1)
    # por debajo de 1 mm son los flancos de una rosca, no un agujero
    interior[rayo[(distancia > 1.0) & (distancia < AGUJERO + 0.6)]] = True
    return interior


def material(color, oscuro=False):
    rgb = np.asarray(COLORES[color], dtype=float) * (0.36 if oscuro else 1.0)
    metal = color == "metal"
    return trimesh.visual.material.PBRMaterial(
        baseColorFactor=[*(lineal(v) for v in rgb), 255],
        metallicFactor=0.9 if metal else 0.0,
        roughnessFactor=0.35 if metal else (0.8 if oscuro else 0.5),
        normalTexture=None if metal else textura_plastico(),
    )


def a_trimesh(m, color, agujeros=True):
    """Capas de la pieza en metros: [cuerpo] o [cuerpo, interior de los agujeros].
    agujeros=False para figuras: sus partes cercanas (brazos, piernas) no son agujeros."""
    malla = m.to_mesh()
    mm = trimesh.Trimesh(np.asarray(malla.vert_properties)[:, :3], np.asarray(malla.tri_verts), process=True)
    interior = caras_interiores(mm) if agujeros else np.zeros(len(mm.faces), dtype=bool)
    capas = []
    for caras, oscuro in ((~interior, False), (interior, True)):
        if not caras.any():
            continue
        capa = mm.submesh([np.nonzero(caras)[0]], append=True)
        # el metal (roscas) se suaviza con un ángulo mayor: menos vértices partidos y un archivo mucho más liviano
        capa = trimesh.graph.smooth_shade(capa, angle=np.radians(75)) if color == "metal" else capa.smooth_shaded
        uv = uv_triplanar(capa.vertices, capa.vertex_normals)
        capa = trimesh.Trimesh(capa.vertices / 1000.0, capa.faces, vertex_normals=capa.vertex_normals, process=False)
        capa.visual = trimesh.visual.TextureVisuals(uv=uv, material=material(color, oscuro))
        capas.append(capa)
    return capas


PIEZAS = [
    # id, nombre, categoría, constructor, color
    ("viga-5", "Viga de 5", "vigas", lambda: viga(5), "azul"),
    ("viga-9", "Viga de 9", "vigas", lambda: viga(9), "gris"),
    ("viga-11", "Viga de 11", "vigas", lambda: viga(11), "azul"),
    ("viga-15", "Viga de 15", "vigas", lambda: viga(15), "gris"),
    ("pletina-7", "Pletina flexible", "pletinas", pletina, "negro"),
    *[(f"rueda-{t}", f"Rueda {t.replace('pequena', 'pequeña')}", "ruedas", (lambda t=t: rueda(t)), "amarillo") for t in RUEDAS],
    *[(f"maza-{t}", f"Disco-maza {t.replace('pequena', 'pequeña')}", "ruedas", (lambda t=t: maza(t)), "naranja") for t in RUEDAS],
    ("tornillo-10", "Tornillo 10 mm", "tornilleria", lambda: tornillo(10), "metal"),
    ("tornillo-20", "Tornillo 20 mm", "tornilleria", lambda: tornillo(20), "metal"),
    ("tornillo-30", "Tornillo 30 mm", "tornilleria", lambda: tornillo(30), "metal"),
    ("tuerca", "Tuerca", "tornilleria", tuerca, "metal"),
    ("tuerca-mariposa", "Tuerca de mariposa", "tornilleria", tuerca_mariposa, "metal"),
    ("varilla-60", "Varilla de 60 mm", "tornilleria", lambda: varilla(60), "metal"),
    ("varilla-100", "Varilla de 100 mm", "tornilleria", lambda: varilla(100), "metal"),
    ("pesa-liviana", "Objeto liviano", "accesorios", lambda: pesa(13), "celeste"),
    ("pesa-pesada", "Objeto pesado", "accesorios", lambda: pesa(16), "rojo"),
]


def main():
    SALIDA.mkdir(parents=True, exist_ok=True)
    catalogo = []
    for pid, nombre, cat, hacer, color in PIEZAS:
        capas = a_trimesh(hacer(), color)
        escena = trimesh.Scene(capas)
        escena.export(SALIDA / f"{pid}.glb")
        ext = (escena.bounds[1] - escena.bounds[0]) * 1000
        catalogo.append({"id": pid, "nombre": nombre, "categoria": cat, "color": color,
                         "archivo": f"modelos/piezas/{pid}.glb",
                         "medidas_mm": [round(float(e), 1) for e in ext]})
        tri = sum(len(k.faces) for k in capas)
        oscuras = len(capas[1].faces) if len(capas) > 1 else 0
        print(f"{pid:18s} {ext[0]:6.1f} x {ext[1]:5.1f} x {ext[2]:6.1f} mm  {tri:6d} tri  ({oscuras} en agujeros)  "
              f"{(SALIDA / f'{pid}.glb').stat().st_size // 1024} KB")
    (SALIDA / "catalogo.json").write_text(json.dumps(catalogo, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
