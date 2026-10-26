"""Arma los mecanismos (modelos/mecanismos/*.json) y exporta un GLB animado para AR.

Uso:  .venv/bin/python herramientas/generar_mecanismos.py
Requiere haber corrido antes generar_piezas.py (usa sus mismas funciones).
"""
import json
import math
import struct
import sys
from pathlib import Path

import numpy as np
import pygltflib
import trimesh
from trimesh.transformations import euler_matrix, translation_matrix

sys.path.insert(0, str(Path(__file__).resolve().parent))
from generar_piezas import PIEZAS, a_trimesh  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent
CARPETA = RAIZ / "modelos" / "mecanismos"
MM = 0.001

DURACION = 6.0      # s, un ciclo de la animación
AMPLITUD = 14.0     # grados del primer vaivén


def matriz(pos, rot):
    m = euler_matrix(*np.radians(rot or [0, 0, 0]), "rxyz")
    m[:3, 3] = np.asarray(pos) * MM
    return m


def angulo(t):
    """Vaivén amortiguado: la balanza oscila y se queda en equilibrio."""
    return AMPLITUD * math.exp(-t / 1.4) * math.cos(2 * math.pi * t / 1.7)


def cuaternion_z(grados):
    a = math.radians(grados) / 2
    return [0.0, 0.0, math.sin(a), math.cos(a)]


def armar(definicion):
    mallas = {pid: a_trimesh(hacer(), color) for pid, _, _, hacer, color in PIEZAS}
    escena = trimesh.Scene()
    grupos = definicion.get("grupos", {})
    for nombre, g in grupos.items():
        escena.graph.update(frame_from=escena.graph.base_frame, frame_to=nombre,
                            matrix=translation_matrix(np.asarray(g["pivote"]) * MM))
    for i, p in enumerate(definicion["piezas"]):
        m = matriz(p["pos"], p.get("rot"))
        padre = p.get("grupo")
        if padre:
            m[:3, 3] -= np.asarray(grupos[padre]["pivote"]) * MM
        escena.add_geometry(mallas[p["id"]], node_name=f"{p['id']}_{i}",
                            geom_name=p["id"], parent_node_name=padre,
                            transform=m)
    pesas = definicion.get("pesas")
    colgantes = []
    if pesas:
        piv = np.asarray(grupos["brazo"]["pivote"])
        for pid, x in pesas["inicial"].items():
            local = np.array([x, pesas["altura"], pesas["z"]]) - piv
            nodo = f"{pid}_colgante"
            escena.add_geometry(mallas[pid], node_name=nodo, geom_name=pid,
                                parent_node_name="brazo",
                                transform=translation_matrix(local * MM))
            colgantes.append(nodo)
    return escena, colgantes


def agregar_animacion(ruta, giratorio, colgantes):
    """Rota el brazo en Z y contrarrota las pesas para que cuelguen verticales."""
    g = pygltflib.GLTF2().load(str(ruta))
    indice = {n.name: i for i, n in enumerate(g.nodes)}
    tiempos = np.linspace(0, DURACION, 121, dtype=np.float32)
    rot = np.array([cuaternion_z(angulo(t)) for t in tiempos], dtype=np.float32)
    contra = rot * np.array([-1, -1, -1, 1], dtype=np.float32)

    blob = bytearray(g.binary_blob())
    def vista(datos, tipo, n, minimo=None, maximo=None):
        while len(blob) % 4:
            blob.append(0)
        g.bufferViews.append(pygltflib.BufferView(buffer=0, byteOffset=len(blob), byteLength=len(datos)))
        blob.extend(datos)
        g.accessors.append(pygltflib.Accessor(bufferView=len(g.bufferViews) - 1, componentType=pygltflib.FLOAT,
                                              count=n, type=tipo, min=minimo, max=maximo))
        return len(g.accessors) - 1

    t_acc = vista(tiempos.tobytes(), pygltflib.SCALAR, len(tiempos), [0.0], [float(DURACION)])
    r_acc = vista(rot.tobytes(), pygltflib.VEC4, len(rot))
    c_acc = vista(contra.tobytes(), pygltflib.VEC4, len(contra))
    anim = pygltflib.Animation(name="vaiven", samplers=[
        pygltflib.AnimationSampler(input=t_acc, output=r_acc, interpolation="LINEAR"),
        pygltflib.AnimationSampler(input=t_acc, output=c_acc, interpolation="LINEAR")],
        channels=[pygltflib.AnimationChannel(sampler=0, target=pygltflib.AnimationChannelTarget(
            node=indice[giratorio], path="rotation"))])
    for nodo in colgantes:
        anim.channels.append(pygltflib.AnimationChannel(sampler=1, target=pygltflib.AnimationChannelTarget(
            node=indice[nodo], path="rotation")))
    g.animations.append(anim)
    g.buffers[0].byteLength = len(blob)
    g.set_binary_blob(bytes(blob))
    g.save(str(ruta))


def main():
    for archivo in sorted(CARPETA.glob("*.json")):
        definicion = json.loads(archivo.read_text())
        escena, colgantes = armar(definicion)
        ruta = CARPETA / f"{definicion['id']}.glb"
        escena.export(ruta)
        if "brazo" in definicion.get("grupos", {}):
            agregar_animacion(ruta, "brazo", colgantes)
        ext = (escena.bounds[1] - escena.bounds[0]) * 1000
        print(f"{definicion['id']}: {len(definicion['piezas'])} piezas, "
              f"{ext[0]:.0f} x {ext[1]:.0f} x {ext[2]:.0f} mm, {ruta.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
