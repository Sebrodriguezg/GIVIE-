"""Arma los mecanismos y exporta un GLB animado de cada uno para ver en 3D y en AR.

Uso:  .venv/bin/python herramientas/generar_mecanismos.py [id ...]
- La balanza se arma desde modelos/mecanismos/balanza.json (lo usa también la web interactiva).
- Los demás vienen de herramientas/mecanismos.py, con su movimiento calculado.
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
import pygltflib
import trimesh
from trimesh.transformations import euler_matrix, quaternion_from_matrix, translation_matrix

sys.path.insert(0, str(Path(__file__).resolve().parent))
from generar_piezas import PIEZAS, a_trimesh  # noqa: E402
import mecanismos  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent
CARPETA = RAIZ / "modelos" / "mecanismos"
MM = 0.001
CUADROS_POR_SEGUNDO = 30

_mallas = {}


def malla(pid):
    if not _mallas:
        _mallas.update({p: a_trimesh(hacer(), color) for p, _, _, hacer, color in PIEZAS})
    return _mallas[pid]


def a_metros(m):
    m = np.array(m, dtype=float)
    m[:3, 3] *= MM
    return m


# ---------------------------------------------------------------- glTF: animación
class Animador:
    """Agrega muestras de rotación/traslación por nodo a un GLB ya exportado."""

    def __init__(self, ruta):
        self.ruta = ruta
        self.g = pygltflib.GLTF2().load(str(ruta))
        self.blob = bytearray(self.g.binary_blob())
        self.indice = {n.name: i for i, n in enumerate(self.g.nodes)}
        self.anim = pygltflib.Animation(name="movimiento", samplers=[], channels=[])

    def _accesor(self, datos, tipo, minimo=None, maximo=None):
        while len(self.blob) % 4:
            self.blob.append(0)
        datos = np.ascontiguousarray(datos, dtype=np.float32)
        self.g.bufferViews.append(pygltflib.BufferView(buffer=0, byteOffset=len(self.blob), byteLength=datos.nbytes))
        self.blob.extend(datos.tobytes())
        self.g.accessors.append(pygltflib.Accessor(bufferView=len(self.g.bufferViews) - 1, componentType=pygltflib.FLOAT,
                                                   count=len(datos), type=tipo, min=minimo, max=maximo))
        return len(self.g.accessors) - 1

    def tiempos(self, t):
        self.t_acc = self._accesor(t, pygltflib.SCALAR, [float(t[0])], [float(t[-1])])

    def canal(self, nodo, ruta, valores):
        tipo = pygltflib.VEC4 if ruta == "rotation" else pygltflib.VEC3
        self.anim.samplers.append(pygltflib.AnimationSampler(input=self.t_acc, output=self._accesor(valores, tipo),
                                                             interpolation="LINEAR"))
        self.anim.channels.append(pygltflib.AnimationChannel(
            sampler=len(self.anim.samplers) - 1,
            target=pygltflib.AnimationChannelTarget(node=self.indice[nodo], path=ruta)))

    def guardar(self):
        self.g.animations.append(self.anim)
        self.g.buffers[0].byteLength = len(self.blob)
        self.g.set_binary_blob(bytes(self.blob))
        self.g.save(str(self.ruta))


def cuaterniones(matrices):
    """xyzw continuos (sin saltos de signo) para interpolar sin dar la vuelta larga."""
    salida, previo = [], None
    for m in matrices:
        w, x, y, z = quaternion_from_matrix(m)
        q = np.array([x, y, z, w])
        if previo is not None and np.dot(q, previo) < 0:
            q = -q
        salida.append(q)
        previo = q
    return np.array(salida)


# ---------------------------------------------------------------- mecanismos con movimiento
def exportar(mec):
    escena = trimesh.Scene()
    inicio = mec["movimiento"](0.0)
    for nombre, partes in mec["cuerpos"].items():
        escena.graph.update(frame_from=escena.graph.base_frame, frame_to=nombre,
                            matrix=a_metros(inicio.get(nombre, np.eye(4))))
        for i, (pieza, local) in enumerate(partes):
            if isinstance(pieza, str):
                geom, nombre_geom = malla(pieza), pieza
            else:
                nombre_geom = f"{mec['id']}-{pieza.nombre}"
                geom = _mallas.setdefault(nombre_geom, a_trimesh(pieza.malla, pieza.color))
            escena.add_geometry(geom, node_name=f"{nombre}-{i}", geom_name=nombre_geom,
                                parent_node_name=nombre, transform=a_metros(local))
    ruta = CARPETA / f"{mec['id']}.glb"
    escena.export(ruta)

    n = int(mec["duracion"] * CUADROS_POR_SEGUNDO)
    t = np.linspace(0, mec["duracion"], n + 1)
    poses = [mec["movimiento"](ti) for ti in t]
    anim = Animador(ruta)
    anim.tiempos(t)
    for nombre in inicio:
        mats = [a_metros(p[nombre]) for p in poses]
        anim.canal(nombre, "translation", np.array([m[:3, 3] for m in mats]))
        anim.canal(nombre, "rotation", cuaterniones(mats))
    anim.guardar()
    return escena, ruta


# ---------------------------------------------------------------- balanza (JSON)
def armar_balanza(definicion):
    escena = trimesh.Scene()
    grupos = definicion.get("grupos", {})
    for nombre, g in grupos.items():
        escena.graph.update(frame_from=escena.graph.base_frame, frame_to=nombre,
                            matrix=translation_matrix(np.asarray(g["pivote"]) * MM))
    for i, p in enumerate(definicion["piezas"]):
        m = euler_matrix(*np.radians(p.get("rot") or [0, 0, 0]), "rxyz")
        m[:3, 3] = np.asarray(p["pos"]) * MM
        padre = p.get("grupo")
        if padre:
            m[:3, 3] -= np.asarray(grupos[padre]["pivote"]) * MM
        escena.add_geometry(malla(p["id"]), node_name=f"{p['id']}_{i}", geom_name=p["id"],
                            parent_node_name=padre, transform=m)
    pesas = definicion["pesas"]
    piv = np.asarray(grupos["brazo"]["pivote"])
    colgantes = []
    for pid, x in pesas["inicial"].items():
        local = np.array([x, pesas["altura"], pesas["z"]]) - piv
        escena.add_geometry(malla(pid), node_name=f"{pid}_colgante", geom_name=pid,
                            parent_node_name="brazo", transform=translation_matrix(local * MM))
        colgantes.append(f"{pid}_colgante")
    return escena, colgantes


def exportar_balanza():
    definicion = json.loads((CARPETA / "balanza.json").read_text())
    escena, colgantes = armar_balanza(definicion)
    ruta = CARPETA / "balanza.glb"
    escena.export(ruta)
    # vaivén amortiguado: la balanza oscila y se queda en equilibrio
    duracion = 6.0
    t = np.linspace(0, duracion, 121)
    ang = np.radians(14.0) * np.exp(-t / 1.4) * np.cos(2 * math.pi * t / 1.7)
    rot = np.stack([np.zeros_like(ang), np.zeros_like(ang), np.sin(ang / 2), np.cos(ang / 2)], axis=1)
    anim = Animador(ruta)
    anim.tiempos(t)
    anim.canal("brazo", "rotation", rot)
    for nodo in colgantes:
        anim.canal(nodo, "rotation", rot * np.array([-1, -1, -1, 1]))
    anim.guardar()
    return escena, ruta


def main():
    pedidos = set(sys.argv[1:])
    trabajos = [("balanza", exportar_balanza)] + [(f().get("id"), (lambda f=f: exportar(f()))) for f in mecanismos.TODOS]
    for mid, hacer in trabajos:
        if pedidos and mid not in pedidos:
            continue
        escena, ruta = hacer()
        ext = (escena.bounds[1] - escena.bounds[0]) * 1000
        print(f"{mid:18s} {ext[0]:4.0f} x {ext[1]:4.0f} x {ext[2]:4.0f} mm  {ruta.stat().st_size // 1024:5d} KB")


if __name__ == "__main__":
    main()
