"""Genera los modelos 3D (GLB, escala real) de las piezas del kit ATA EPE.

Uso:  .venv/bin/python herramientas/generar_piezas.py
Salida: modelos/piezas/*.glb  +  modelos/piezas/catalogo.json

Medidas en mm (ver recursos/piezas/medidas.md); se exportan en metros para que
la realidad aumentada muestre las piezas a su tamaño real. Eje Y hacia arriba.
"""
import json
import math
from pathlib import Path

import numpy as np
import trimesh
from manifold3d import Manifold, set_circular_segments

set_circular_segments(48)

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / "modelos" / "piezas"

PASO = 10.0          # retícula del kit
AGUJERO = 4.6        # agujero pasante (tornillo de 4 mm gira libre)
COLORES = {
    "azul": (31, 79, 214),
    "gris": (167, 170, 174),
    "negro": (34, 34, 38),
    "amarillo": (246, 196, 18),
    "naranja": (247, 166, 28),
    "metal": (190, 194, 200),
    "rojo": (200, 32, 46),
    "celeste": (56, 168, 222),
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


# ---------------------------------------------------------------- vigas
def viga(n):
    """Viga cuadrada 10x10 de n posiciones; agujeros alternados en Y y Z."""
    cuerpo = caja(n * PASO, PASO, PASO)
    for i in range(n):
        x = (i - (n - 1) / 2) * PASO
        eje = "y" if i % 2 == 0 else "z"
        cuerpo -= cilindro(AGUJERO / 2, PASO + 2, eje).translate([x, 0, 0])
    return cuerpo


# ---------------------------------------------------------------- pletina
def pletina(n=7, ancho=10.5, espesor=2.0):
    """Pletina flexible con extremos redondeados (forma de estadio)."""
    largo = (n - 1) * PASO
    cuerpo = caja(largo, espesor, ancho)
    for s in (-1, 1):
        cuerpo += cilindro(ancho / 2, espesor).translate([s * largo / 2, 0, 0])
    for i in range(n):
        cuerpo -= cilindro(AGUJERO / 2, espesor + 2).translate([(i - (n - 1) / 2) * PASO, 0, 0])
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
    cuerpo = cilindro(D / 2, 2).translate([0, 1, 0])
    cuerpo += cilindro(D / 2 - 1.5, 3).translate([0, 3.5, 0])
    for x, z in pines:
        cuerpo += cilindro(1.4, 2).translate([x, 6, z])
    for x, z in patron_agujeros(tam) + [(0, 0)]:
        cuerpo -= cilindro(AGUJERO / 2, 14).translate([x, 2.5, z])
    return cuerpo


def maza(tam):
    """Disco-maza: placa 2 mm + buje central de 8 mm; encaja en los pines de la rueda."""
    D, pines = RUEDAS[tam]
    cuerpo = cilindro(D / 2 - 1.5, 2).translate([0, 1, 0])
    cuerpo += cilindro(5.0, 8).translate([0, 6, 0])
    cuerpo -= cilindro(AGUJERO / 2, 24).translate([0, 5, 0])
    for x, z in patron_agujeros(tam):
        cuerpo -= cilindro(AGUJERO / 2, 6).translate([x, 1, z])
    for x, z in pines:
        cuerpo -= cilindro(1.6, 6).translate([-x, 1, z])  # espejo: la maza va volteada
    return cuerpo


# ---------------------------------------------------------------- tornillería
def tornillo(largo):
    cabeza = cilindro(3.6, 2.6).translate([0, largo + 1.3, 0])
    ranura = caja(7.5, 1.2, 0.9).translate([0, largo + 2.3, 0])
    vastago = cilindro(1.95, largo).translate([0, largo / 2, 0])
    return (cabeza - ranura) + vastago


def tuerca():
    hexagono = Manifold.cylinder(3.2, 4.0, 4.0, 6, True).rotate([90, 0, 0])
    return hexagono - cilindro(1.95, 5)


def tuerca_mariposa():
    cuerpo = Manifold.cylinder(5.0, 3.6, 2.8, 0, True).rotate([-90, 0, 0])
    for s in (-1, 1):
        oreja = caja(6, 7, 1.6).translate([s * 6, 1.5, 0])
        oreja += cilindro(3.0, 1.6, "z").translate([s * 8.5, 3.5, 0])
        cuerpo += oreja
    return cuerpo - cilindro(1.95, 8)


# ---------------------------------------------------------------- pesas (balanza)
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


def a_trimesh(m, color):
    malla = m.to_mesh()
    v = np.asarray(malla.vert_properties)[:, :3] / 1000.0   # mm -> m
    t = trimesh.Trimesh(v, np.asarray(malla.tri_verts), process=True)
    t.visual = trimesh.visual.TextureVisuals(
        material=trimesh.visual.material.PBRMaterial(
            baseColorFactor=[*(lineal(c) for c in COLORES[color]), 255],
            metallicFactor=0.9 if color == "metal" else 0.0,
            roughnessFactor=0.35 if color == "metal" else 0.55,
        )
    )
    return t


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
    ("pesa-liviana", "Objeto liviano", "accesorios", lambda: pesa(13), "celeste"),
    ("pesa-pesada", "Objeto pesado", "accesorios", lambda: pesa(16), "rojo"),
]


def main():
    SALIDA.mkdir(parents=True, exist_ok=True)
    catalogo = []
    for pid, nombre, cat, hacer, color in PIEZAS:
        m = hacer()
        t = a_trimesh(m, color)
        t.export(SALIDA / f"{pid}.glb")
        ext = (t.bounds[1] - t.bounds[0]) * 1000
        catalogo.append({"id": pid, "nombre": nombre, "categoria": cat, "color": color,
                         "archivo": f"modelos/piezas/{pid}.glb",
                         "medidas_mm": [round(float(e), 1) for e in ext]})
        print(f"{pid:18s} {ext[0]:6.1f} x {ext[1]:5.1f} x {ext[2]:6.1f} mm  {len(t.faces):6d} tri  ok={t.is_watertight}")
    (SALIDA / "catalogo.json").write_text(json.dumps(catalogo, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
