"""Mecanismos de la cartilla armados con piezas del kit, con su movimiento.

Cada mecanismo es un dict con:
  id, nombre, duracion (s, un ciclo que se repite sin saltos),
  cuerpos: {nombre: [(pieza, matriz_local), ...]}   pieza = id del kit o Forma(...)
  movimiento(t) -> {nombre: matriz_mundo}           (los cuerpos ausentes quedan fijos)
Unidades en mm, eje Y hacia arriba, +Z hacia el frente.
"""
import math
from dataclasses import dataclass

import numpy as np
from manifold3d import CrossSection, JoinType, Manifold
from trimesh.transformations import euler_matrix, rotation_matrix

from generar_piezas import PASO, caja

TAU = 2 * math.pi
X, Y, Z = (1, 0, 0), (0, 1, 0), (0, 0, 1)


@dataclass(frozen=True)
class Forma:
    """Geometría propia del mecanismo (figuras, correas, llantas...)."""
    nombre: str
    malla: Manifold
    color: str


# ---------------------------------------------------------------- matrices
def M(pos=(0, 0, 0), rot=(0, 0, 0)):
    m = euler_matrix(*np.radians(rot), "rxyz")
    m[:3, 3] = pos
    return m


def giro(eje, angulo, centro=(0, 0, 0)):
    return rotation_matrix(angulo, eje, centro)


def mover(pos):
    return M(pos)


# ---------------------------------------------------------------- formas
def esfera(r, centro=(0, 0, 0), escala=(1, 1, 1)):
    return Manifold.sphere(r, 32).scale(list(escala)).translate(list(centro))


def capsula(a, b, r):
    return (esfera(r, a) + esfera(r, b)).hull()


def llanta(radio, grueso, ancho):
    """Anillo de caucho a lo largo de Z, centrado."""
    return Manifold.cylinder(ancho, radio + grueso, radio + grueso, 96, True) - \
        Manifold.cylinder(ancho + 1, radio, radio, 96, True)


def correa(c1, r1, c2, r2, ancho=3.0, grueso=1.3):
    """Correa cerrada entre dos poleas en el plano XY (centros c1, c2), a lo largo de Z."""
    def par(e):
        return (Manifold.cylinder(ancho + e, r1 + grueso * (e == 0), r1 + grueso * (e == 0), 96, True).translate([*c1, 0]) +
                Manifold.cylinder(ancho + e, r2 + grueso * (e == 0), r2 + grueso * (e == 0), 96, True).translate([*c2, 0])).hull()
    exterior = par(0)
    interior = (Manifold.cylinder(ancho + 2, r1, r1, 96, True).translate([*c1, 0]) +
                Manifold.cylinder(ancho + 2, r2, r2, 96, True).translate([*c2, 0])).hull()
    return exterior - interior


def trazo(puntos, ancho=1.2, alto=0.4):
    """Línea dibujada sobre el papel (plano XZ) que pasa por los puntos (x, z)."""
    disco = Manifold.cylinder(alto, ancho / 2, ancho / 2, 12, True).rotate([90, 0, 0])
    total = Manifold()
    for (x1, z1), (x2, z2) in zip(puntos, puntos[1:]):
        total += (disco.translate([x1, 0, z1]) + disco.translate([x2, 0, z2])).hull()
    return total


def corazon(n=90, escala=1.0, centro=(0, 0)):
    pts = []
    for k in range(n + 1):
        t = TAU * k / n
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((centro[0] + escala * x / 16, centro[1] - escala * y / 16))
    return pts


# ---------------------------------------------------------------- figuras
def mono():
    """Mono colgado de las manos; las manos quedan en y=0."""
    cafe = (esfera(9, (0, -21, 0)) + esfera(9.5, (0, -38, 0), (1, 1.25, 0.8)) +
            capsula((-7, -30, 0), (-9, 0, 0), 2.6) + capsula((7, -30, 0), (9, 0, 0), 2.6) +
            capsula((-5, -48, 0), (-8, -62, 2), 2.8) + capsula((5, -48, 0), (8, -62, 2), 2.8) +
            capsula((0, -46, -6), (0, -40, -16), 1.6))
    piel = (esfera(5.8, (0, -23, 6.5), (1.2, 0.9, 0.8)) + esfera(3.6, (-9.5, -18, 0)) +
            esfera(3.6, (9.5, -18, 0)) + esfera(6, (0, -38, 4.5), (1, 1.2, 0.6)))
    ojos = esfera(1.4, (-3.2, -17.5, 7.6)) + esfera(1.4, (3.2, -17.5, 7.6))
    return [Forma("mono-pelo", cafe, "cafe"), Forma("mono-cara", piel, "piel"), Forma("mono-ojos", ojos, "negro")]


def pescador():
    """Pescador sentado; la base del cuerpo en y=0, mira hacia +X."""
    ropa = capsula((0, 4, 0), (2, 22, 0), 6) + capsula((2, 18, -5), (16, 24, -3), 2) + capsula((2, 18, 5), (16, 24, 3), 2)
    pantalon = capsula((0, 2, -3.5), (14, 2, -3.5), 3.2) + capsula((0, 2, 3.5), (14, 2, 3.5), 3.2)
    piel = esfera(6, (3, 33, 0)) + esfera(2.2, (17, 24, 0))
    sombrero = (Manifold.cylinder(1.2, 11, 11, 48, True).rotate([90, 0, 0]).translate([3, 37.5, 0]) +
                Manifold.cylinder(5, 5.5, 4.5, 48, True).rotate([-90, 0, 0]).translate([3, 40.5, 0]))
    return [Forma("pescador-ropa", ropa, "azul-oscuro"), Forma("pescador-pantalon", pantalon, "cafe"),
            Forma("pescador-piel", piel, "piel"), Forma("pescador-sombrero", sombrero, "amarillo")]


def bailarina():
    """Bailarina sobre un pie; la base en y=0."""
    blanco = (Manifold.cylinder(2, 6, 6, 48, True).rotate([90, 0, 0]).translate([0, 1, 0]) +
              capsula((0, 2, 0), (0, 14, 0), 1.3) + capsula((0, 14, 0), (4, 10, 2), 1.2) +
              capsula((-1, 30, 0), (-5, 40, 0), 1) + capsula((1, 30, 0), (5, 40, 0), 1))
    rosado = (Manifold.cylinder(4, 2, 9, 48, True).rotate([90, 0, 0]).translate([0, 17, 0]) +
              esfera(3.4, (0, 24, 0), (1, 1.6, 0.9)))
    piel = esfera(3.4, (0, 32.5, 0)) + esfera(2.2, (0, 35.5, -1.5))
    return [Forma("bailarina-blanco", blanco, "blanco"), Forma("bailarina-rosado", rosado, "rosado"),
            Forma("bailarina-piel", piel, "piel")]


def lapiz(largo=58):
    """Lápiz vertical con la punta en y=0."""
    madera = Manifold.cylinder(7, 0.8, 3.3, 6, False).rotate([-90, 0, 0])
    cuerpo = Manifold.cylinder(largo - 7, 3.5, 3.5, 6, False).rotate([-90, 0, 0]).translate([0, 7, 0])
    grafito = Manifold.cylinder(2, 0.1, 0.85, 12, False).rotate([-90, 0, 0])
    return [Forma("lapiz-cuerpo", cuerpo, "amarillo"), Forma("lapiz-madera", madera - grafito, "madera"),
            Forma("lapiz-grafito", grafito, "negro")]


def marca(r=2.5, vertical=True):
    """Pastilla roja para seguir (y contar) las vueltas de una rueda. vertical: rueda con eje Z."""
    m = Manifold.cylinder(1.2, r, r, 32, True)
    return Forma(f"marca-{r}-{'v' if vertical else 'h'}", m if vertical else m.rotate([90, 0, 0]), "rojo")


def figuras(lista, matriz):
    return [(f, matriz) for f in lista]


# ---------------------------------------------------------------- ayudas de armado
def rueda_en_z(tam, z, con_maza=True):
    """Rueda (y su disco-maza) con eje a lo largo de Z; la cara de la rueda empieza en z."""
    partes = [(f"rueda-{tam}", M((0, 0, z), (90, 0, 0)))]
    if con_maza:
        partes.append((f"maza-{tam}", M((0, 0, z + 5), (90, 0, 0))))
    return partes


def manivela(z, largo=30, sentido=1):
    """Brazo de manivela (viga 5) radial con su mango, en el plano z."""
    return [("viga-5", M((largo / 2 - 5, 0, z))),
            ("tornillo-20", M((largo - 5, 0, z + sentido * 5), (90 * sentido, 0, 0)))]


# ================================================================= 1. dos ruedas
def dos_ruedas():
    G, P = (-35, 85), (45, 85)          # ejes de la rueda grande y la pequeña (x, y)
    RG, RP = 47.5, 47.5 / 3            # radios efectivos de la correa: relación 3 a 1
    fijo = []
    for z in (-20, 20):
        fijo.append(("viga-15", M((5, 5, z))))
        fijo += [("viga-11", M((x, 65, z), (0, 0, 90))) for x in (G[0], P[0])]
        fijo.append(("viga-9", M((5, 125, z))))
    fijo += [("viga-5", M((x, 15, 0), (0, 90, 0))) for x in (-65, 75)]
    fijo += [("tornillo-20", M((x, 0, z))) for x in (-65, 75) for z in (-20, 20)]
    fijo.append((Forma("correa-dos-ruedas", correa(G, RG, P, RP, 3, 1.3), "negro"), M((0, 0, 33.5))))
    grande = [("varilla-100", M((0, 0, 0), (90, 0, 0)))] + rueda_en_z("grande", 30) + \
        [(p, mover((0, 0, -45)) @ m) for p, m in manivela(0, 35, -1)] + [(marca(2.8), mover((0, 37, 37.6)))]
    pequena = [("varilla-60", M((0, 0, 15), (90, 0, 0))), ("rueda-pequena", M((0, 0, 30), (90, 0, 0))),
               ("maza-pequena", M((0, 0, 35), (90, 0, 0))), (marca(2.2), mover((12, 0, 37.6)))]

    def movimiento(t):
        a = TAU * t / 8
        return {"grande": giro(Z, a, (*G, 0)) @ mover((*G, 0)),
                "pequena": giro(Z, 3 * a, (*P, 0)) @ mover((*P, 0))}
    return dict(id="dos-ruedas", nombre="Sistema de dos ruedas", duracion=8.0,
                cuerpos={"fijo": fijo, "grande": grande, "pequena": pequena}, movimiento=movimiento)


# ================================================================= 2 y 3. rueda vertical que mueve un disco horizontal
def _rueda_vertical():
    """Rueda vertical con llanta (radio efectivo 30) y manivela, en su propio eje Z."""
    return ([("varilla-60", M((0, 0, 10), (90, 0, 0)))] + rueda_en_z("mediana", 12, con_maza=False) +
            [(Forma("llanta-30", llanta(27.5, 2.5, 3), "negro"), M((0, 0, 14.5))),
             ("maza-mediana", M((0, 0, 17), (90, 0, 0))), (marca(), mover((0, 22, 19.6)))] +
            [(p, mover((0, 0, 40)) @ m) for p, m in manivela(0, 30, 1)])


def cuenta_historias():
    V = (0, 80)                       # eje de la rueda vertical (x, y), plano de contacto z=14.5
    HZ = 14.5 - 15                    # eje del disco: el contacto queda a 15 mm -> gira el doble
    fijo = [("viga-11", M((0, 5, z))) for z in (-20, 20)]
    fijo += [("viga-5", M((x, 15, 0), (0, 90, 0))) for x in (-40, 40)]
    fijo += [("viga-15", M((-40, 95, 0), (0, 0, 90))), ("viga-9", M((0, 175, HZ))),
             ("viga-9", M((-10, 80, -10))), ("tornillo-20", M((-40, 80, -15), (90, 0, 0)))]
    # viñetas del zoótropo: una pelota que rebota
    vinetas = []
    carta = caja(12, 18, 1)
    for k in range(8):
        th = TAU * k / 8
        alto = 4 + 9 * abs(math.sin(math.pi * k / 8))
        m = giro(Y, -th) @ mover((0, 0, 22))
        vinetas.append((Forma("vineta", carta, "blanco"), m @ mover((0, 9, 0))))
        vinetas.append((Forma(f"pelota-{k}", esfera(2.2, (0, 3 + alto, 0.9)), "rojo"), m))
    disco = [("rueda-mediana", M((0, 0, 0))), ("varilla-100", M((0, 50, 0))),
             (marca(2, vertical=False), giro(Y, -math.pi / 8) @ mover((0, 5.6, 25)))] + \
        [(f, mover((0, 7, 0)) @ m) for f, m in vinetas]

    def movimiento(t):
        a = TAU * t / 8
        return {"rueda": giro(Z, a, (*V, 0)) @ mover((*V, 0)),
                "disco": giro(Y, -2 * a, (0, 0, HZ)) @ mover((0, 110, HZ))}
    return dict(id="cuenta-historias", nombre="Cuenta historias", duracion=8.0,
                cuerpos={"fijo": fijo, "rueda": _rueda_vertical(), "disco": disco}, movimiento=movimiento)


def bailarinas():
    V, HZ = (0, 80), 14.5 - 15
    YT = 185                           # altura de las ruedas de arriba
    fijo = [("viga-15", M((0, 5, z))) for z in (-25, 25)]
    fijo += [("viga-5", M((x, 15, 0), (0, 90, 0))) for x in (-70, 70)]
    fijo += [("viga-15", M((x, 95, 0), (0, 0, 90))) for x in (-70, 70)]
    fijo += [("viga-15", M((0, 175, HZ))), ("viga-15", M((0, 80, -10)))]
    fijo += [("tornillo-20", M((x, y, -15), (90, 0, 0))) for x in (-70, 70) for y in (80,)]
    central = [("rueda-mediana", M((0, 0, 0))), ("varilla-100", M((0, 45, 0))),
               ("rueda-mediana", M((0, YT - 110, 0))),
               (Forma("llanta-top-30", llanta(27.5, 2.5, 3), "negro"), M((0, YT - 110 + 3.5, 0), (90, 0, 0))),
               (marca(vertical=False), mover((0, 5.6, 22))), (marca(vertical=False), mover((0, YT - 110 + 5.6, 22)))]
    lado = ([("rueda-pequena", M((0, 0, 0))), ("varilla-60", M((0, -5, 0))),
             (Forma("llanta-top-20", llanta(17, 3, 3), "negro"), M((0, 3.5, 0), (90, 0, 0))),
             (marca(2, vertical=False), mover((12, 5.6, 0)))] +
            figuras(bailarina(), mover((0, 25, 0))))

    def movimiento(t):
        a = TAU * t / 8
        c = -2 * a                      # el disco central gira el doble que la rueda vertical
        s = -1.5 * c                    # cada rueda lateral gira 1.5 veces el disco central
        return {"rueda": giro(Z, a, (*V, 0)) @ mover((*V, 0)),
                "central": giro(Y, c, (0, 0, HZ)) @ mover((0, 110, HZ)),
                "izq": giro(Y, s, (-50, 0, HZ)) @ mover((-50, YT, HZ)),
                "der": giro(Y, s, (50, 0, HZ)) @ mover((50, YT, HZ))}
    return dict(id="bailarinas", nombre="Bailarinas", duracion=8.0,
                cuerpos={"fijo": fijo, "rueda": _rueda_vertical(), "central": central, "izq": lado, "der": lado},
                movimiento=movimiento)


# ================================================================= 4. manivela: mono acróbata
def mono_acrobata():
    EJE = (155, 0)                     # (y, z) del eje, a lo largo de X
    fijo = [("viga-11", M((x, 5, 0), (0, 90, 0))) for x in (-45, 45)]
    fijo += [("viga-15", M((x, 85, 0), (0, 0, 90))) for x in (-45, 45)]
    fijo += [("viga-11", M((0, 15, -10))), ("tornillo-20", M((-45, 15, -15), (90, 0, 0))),
             ("tornillo-20", M((45, 15, -15), (90, 0, 0)))]
    giratorio = [("varilla-100", M((-5, 0, 0), (0, 0, 90)))]
    giratorio += [("pletina-7", M((x, -30, 0), (0, 0, 90))) for x in (-12, 12)]
    giratorio += [("viga-5", M((0, -62, 0)))]
    giratorio += figuras(mono(), mover((0, -66, 0)))
    giratorio += [("viga-5", M((-58, -20, 0), (0, 0, 90))), ("tornillo-20", M((-63, -40, 0), (0, 0, 90)))]

    def movimiento(t):
        a = TAU * t / 6
        return {"mono": giro(X, -a, (0, *EJE)) @ mover((0, *EJE))}
    return dict(id="manivela", nombre="Manivela · Mono acróbata", duracion=6.0,
                cuerpos={"fijo": fijo, "mono": giratorio}, movimiento=movimiento)


# ================================================================= 5. biela-manivela: pescador
def pescador_biela():
    PIV = np.array([0.0, 115.0])       # eje del bote (x, y), a lo largo de Z
    B_LOCAL = np.array([45.0, -8.0])   # punto del bote donde se engancha la biela
    O2, R, L = np.array([45.0, 37.0]), 14.0, 70.0
    ZB = 40                            # plano de la biela (delante del buje de la rueda)

    perfil = CrossSection([[(-62, 20), (-50, 2), (40, 0), (58, 8), (72, 30), (40, 26), (-62, 24)]])
    planta = CrossSection([[(72 * math.cos(u), 19 * math.sin(u) * (1 - 0.35 * math.cos(u)))
                            for u in np.linspace(0, TAU, 60, endpoint=False)]])
    def casco(e):
        lado = perfil.offset(-e, JoinType.Round).extrude(60).translate([0, 0, -30])
        arriba = planta.offset(-e, JoinType.Round).extrude(80).rotate([90, 0, 0]).translate([0, 50, 0])
        return lado ^ arriba
    bote_malla = casco(0) - casco(2.5).translate([0, 3, 0])
    pez = esfera(6, (0, 0, 0), (1.6, 0.8, 0.5)) + Manifold.cylinder(1, 0.2, 5, 3, True).rotate([0, 90, 0]).scale([1, 1.2, 1]).translate([-12, 0, 0])
    bote = [(Forma("bote", bote_malla, "rojo"), mover((0, 3, 0))),
            ("viga-5", M((45, -5, 20), (0, 90, 0))),
            ("tornillo-10", M((45, -8, ZB - 5), (90, 0, 0)))]
    bote += figuras(pescador(), mover((-22, 5, 0)))
    caña = capsula((-5, 30, 0), (70, 62, 0), 0.9) + Manifold.cylinder(28, 0.3, 0.3, 8, False).rotate([90, 0, 0]).translate([70, 62, 0])
    bote += [(Forma("caña", caña, "madera"), M((0, 0, 0))), (Forma("pez", pez, "naranja-pez"), mover((70, 28, 0)))]

    fijo = [("viga-11", M((0, 5, z))) for z in (-20, 20)]
    fijo += [("viga-5", M((x, 15, 0), (0, 90, 0))) for x in (-45, 45)]
    fijo += [("viga-11", M((0, 65, z), (0, 0, 90))) for z in (-25, 25)]
    fijo += [("viga-5", M((45, 40, -10), (0, 0, 90))), ("varilla-100", M((0, PIV[1], 0), (90, 0, 0)))]
    fijo += [(Forma("agua", Manifold.cube([180, 2, 70], True), "agua"), mover((0, 1, 0)))]
    rueda = [("varilla-60", M((0, 0, 5), (90, 0, 0))), ("rueda-pequena", M((0, 0, 20), (90, 0, 0))),
             ("maza-pequena", M((0, 0, 25), (90, 0, 0))), ("tornillo-10", M((R, 0, ZB - 5), (90, 0, 0)))]

    def bote_angulo(c):
        def error(f):
            b = PIV + np.array([[math.cos(f), -math.sin(f)], [math.sin(f), math.cos(f)]]) @ B_LOCAL
            return np.linalg.norm(b - c) - L
        lo, hi = -0.8, 0.8
        for _ in range(60):
            mid = (lo + hi) / 2
            if (error(lo) < 0) == (error(mid) < 0):
                lo = mid
            else:
                hi = mid
        return (lo + hi) / 2

    def movimiento(t):
        th = TAU * t / 5
        c = O2 + R * np.array([math.cos(th), math.sin(th)])
        f = bote_angulo(c)
        b = PIV + np.array([[math.cos(f), -math.sin(f)], [math.sin(f), math.cos(f)]]) @ B_LOCAL
        al = math.atan2(*(b - c)[::-1])
        return {"rueda": giro(Z, th, (*O2, 0)) @ mover((*O2, 0)),
                "bote": giro(Z, f, (*PIV, 0)) @ mover((*PIV, 0)),
                "biela": giro(Z, al, (*c, 0)) @ mover((*c, ZB))}
    return dict(id="biela", nombre="Biela-manivela · Pescador", duracion=5.0,
                cuerpos={"fijo": fijo, "rueda": rueda, "bote": bote, "biela": [("viga-9", M((4 * PASO, 0, 0)))]},
                movimiento=movimiento)


# ================================================================= 6. pantógrafo
def pantografo():
    L = 70.0                           # medio largo de las barras largas (agujeros 0 y 14 de la viga 15)
    Y1, Y2 = 17, 27                    # alturas de las dos capas de barras
    CENTRO_P, ESCALA = (92, -4), 16    # corazón que recorre el punzón P (el lápiz lo dibuja al doble)

    def puntos(t):
        u = TAU * t / 8
        x = 16 * math.sin(u) ** 3
        y = 13 * math.cos(u) - 5 * math.cos(2 * u) - 2 * math.cos(3 * u) - math.cos(4 * u)
        p = np.array([CENTRO_P[0] + ESCALA * x / 16, CENTRO_P[1] - ESCALA * y / 16])
        q = 2 * p
        mitad, d = q / 2, np.linalg.norm(q) / 2
        h = math.sqrt((2 * L) ** 2 - d ** 2)
        n = np.array([q[1], -q[0]]) / np.linalg.norm(q)    # lado hacia -Z (atrás)
        a = mitad + h * n
        return a, a / 2, (a + q) / 2, p, q

    papel = Manifold.cube([300, 2, 150], True)
    dibujos = (trazo(corazon(120, ESCALA, CENTRO_P)) + trazo(corazon(160, 2 * ESCALA, (2 * CENTRO_P[0], 2 * CENTRO_P[1]))))
    fijo = [(Forma("papel", papel, "blanco"), mover((110, 1, -20))),
            (Forma("dibujos", dibujos, "rojo"), mover((0, 2.2, 0))),
            ("viga-5", M((0, 7, 0), (0, 90, 0))), ("tornillo-30", M((0, 2, 0)))]
    cuerpos = {
        "fijo": fijo,
        "oa": [("viga-15", M((7 * PASO, 0, 0)))],
        "aq": [("viga-15", M((7 * PASO, 0, 0))), ("tornillo-20", M((0, -15, 0)))] +
              figuras(lapiz(), mover((14 * PASO, -Y2 + 2, 0))),
        "cp": [("viga-9", M((4 * PASO, 0, 0))), ("tornillo-20", M((0, -15, 0))),
               ("tornillo-30", M((7 * PASO, -Y2 + 2, 0)))],
        "dp": [("viga-9", M((4 * PASO, 0, 0)))],
    }

    def barra(a, b, y):
        th = math.atan2(-(b[1] - a[1]), b[0] - a[0])
        return giro(Y, th, (a[0], y, a[1])) @ mover((a[0], y, a[1]))

    def movimiento(t):
        a, c, d, p, q = puntos(t)
        o = np.zeros(2)
        return {"oa": barra(o, a, Y1), "aq": barra(a, q, Y2), "cp": barra(c, p, Y2), "dp": barra(d, p, Y1)}
    return dict(id="pantografo", nombre="Pantógrafo", duracion=8.0, cuerpos=cuerpos, movimiento=movimiento)


TODOS = [pantografo, mono_acrobata, pescador_biela, dos_ruedas, cuenta_historias, bailarinas]
