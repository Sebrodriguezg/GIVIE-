"""Arma los mecanismos y exporta cada uno animado en GLB (web, Android) y USDZ (iPhone).

Uso:  .venv/bin/python herramientas/generar_mecanismos.py [id ...]
- La balanza se arma desde modelos/mecanismos/balanza.json (lo usa también la web interactiva).
- Los demás vienen de herramientas/mecanismos.py, con su movimiento calculado.
El USDZ hace falta porque el que model-viewer genera solo para Quick Look no lleva animación.
"""
import json
import math
import sys
import tempfile
from pathlib import Path

import numpy as np
import pygltflib
import trimesh
from pxr import Gf, Sdf, Usd, UsdGeom, UsdShade, UsdUtils, Vt
from trimesh.transformations import quaternion_from_matrix

sys.path.insert(0, str(Path(__file__).resolve().parent))
from generar_piezas import PIEZAS, TEXTURA, a_trimesh  # noqa: E402
import mecanismos  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent
CARPETA = RAIZ / "modelos" / "mecanismos"
MM = 0.001
CUADROS_POR_SEGUNDO = 30

_mallas = {}
_constructores = {p: (hacer, color) for p, _, _, hacer, color in PIEZAS}


def capas(mec, pieza):
    """Capas (mallas en metros) de una parte: pieza del kit por id o Forma propia; se calculan una vez."""
    if isinstance(pieza, str):
        clave = pieza
        if clave not in _mallas:
            hacer, color = _constructores[pieza]
            _mallas[clave] = a_trimesh(hacer(), color)
    else:
        clave = f"{mec['id']}-{pieza.nombre}"
        if clave not in _mallas:
            _mallas[clave] = a_trimesh(pieza.malla, pieza.color, agujeros=False)
    return clave, _mallas[clave]


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
            clave, lista = capas(mec, pieza)
            for k, capa in enumerate(lista):
                escena.add_geometry(capa, node_name=f"{nombre}-{i}-{k}", geom_name=f"{clave}#{k}",
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
    exportar_usdz(mec, t, poses)
    return escena, ruta


# ---------------------------------------------------------------- USDZ para Quick Look (iPhone)
def _material(stage, pbr, cache):
    color = tuple(np.asarray(pbr.baseColorFactor[:3], dtype=float) / 255)
    metal, rugosidad = float(pbr.metallicFactor or 0), float(pbr.roughnessFactor or 0.5)
    con_textura = pbr.normalTexture is not None
    clave = (color, metal, rugosidad, con_textura)
    if clave not in cache:
        ruta = f"/raiz/materiales/m{len(cache)}"
        mat = UsdShade.Material.Define(stage, ruta)
        sombreador = UsdShade.Shader.Define(stage, ruta + "/superficie")
        sombreador.CreateIdAttr("UsdPreviewSurface")
        sombreador.CreateInput("diffuseColor", Sdf.ValueTypeNames.Color3f).Set(Gf.Vec3f(*color))
        sombreador.CreateInput("metallic", Sdf.ValueTypeNames.Float).Set(metal)
        sombreador.CreateInput("roughness", Sdf.ValueTypeNames.Float).Set(rugosidad)
        if con_textura:
            # textura de plástico impreso: mapa de normales repetido sobre las coordenadas «st»
            lector = UsdShade.Shader.Define(stage, ruta + "/st")
            lector.CreateIdAttr("UsdPrimvarReader_float2")
            lector.CreateInput("varname", Sdf.ValueTypeNames.String).Set("st")
            imagen = UsdShade.Shader.Define(stage, ruta + "/normales")
            imagen.CreateIdAttr("UsdUVTexture")
            imagen.CreateInput("file", Sdf.ValueTypeNames.Asset).Set(TEXTURA.name)
            imagen.CreateInput("st", Sdf.ValueTypeNames.Float2).ConnectToSource(lector.ConnectableAPI(), "result")
            imagen.CreateInput("wrapS", Sdf.ValueTypeNames.Token).Set("repeat")
            imagen.CreateInput("wrapT", Sdf.ValueTypeNames.Token).Set("repeat")
            imagen.CreateInput("sourceColorSpace", Sdf.ValueTypeNames.Token).Set("raw")
            imagen.CreateInput("scale", Sdf.ValueTypeNames.Float4).Set(Gf.Vec4f(2, 2, 2, 1))
            imagen.CreateInput("bias", Sdf.ValueTypeNames.Float4).Set(Gf.Vec4f(-1, -1, -1, 0))
            imagen.CreateOutput("rgb", Sdf.ValueTypeNames.Float3)
            sombreador.CreateInput("normal", Sdf.ValueTypeNames.Normal3f).ConnectToSource(imagen.ConnectableAPI(), "rgb")
        mat.CreateSurfaceOutput().ConnectToSource(sombreador.ConnectableAPI(), "surface")
        cache[clave] = mat
    return cache[clave]


def _matriz_usd(m):
    return Gf.Matrix4d(np.asarray(m, dtype=float).T.tolist())   # USD usa vectores fila


def exportar_usdz(mec, tiempos, poses):
    ruta = CARPETA / f"{mec['id']}.usdz"
    with tempfile.TemporaryDirectory() as tmp:
        usdc = str(Path(tmp) / f"{mec['id']}.usdc")
        (Path(tmp) / TEXTURA.name).write_bytes(TEXTURA.read_bytes())
        stage = Usd.Stage.CreateNew(usdc)
        UsdGeom.SetStageUpAxis(stage, UsdGeom.Tokens.y)
        UsdGeom.SetStageMetersPerUnit(stage, 1.0)
        stage.SetTimeCodesPerSecond(CUADROS_POR_SEGUNDO)
        stage.SetFramesPerSecond(CUADROS_POR_SEGUNDO)
        stage.SetStartTimeCode(0)
        stage.SetEndTimeCode(len(tiempos) - 1)
        raiz = UsdGeom.Xform.Define(stage, "/raiz")
        stage.SetDefaultPrim(raiz.GetPrim())
        materiales = {}
        for c, (nombre, partes) in enumerate(mec["cuerpos"].items()):
            cuerpo = UsdGeom.Xform.Define(stage, f"/raiz/c{c}")
            op = cuerpo.AddTransformOp()
            if nombre in poses[0]:
                for k, pose in enumerate(poses):
                    op.Set(_matriz_usd(a_metros(pose[nombre])), k)
            else:
                op.Set(_matriz_usd(np.eye(4)))
            for i, (pieza, local) in enumerate(partes):
                for k, capa in enumerate(capas(mec, pieza)[1]):
                    malla_usd = UsdGeom.Mesh.Define(stage, f"/raiz/c{c}/p{i}_{k}")
                    malla_usd.AddTransformOp().Set(_matriz_usd(a_metros(local)))
                    malla_usd.CreatePointsAttr(Vt.Vec3fArray.FromNumpy(np.asarray(capa.vertices, dtype=np.float32)))
                    malla_usd.CreateFaceVertexCountsAttr(Vt.IntArray([3] * len(capa.faces)))
                    malla_usd.CreateFaceVertexIndicesAttr(Vt.IntArray(np.asarray(capa.faces).ravel().tolist()))
                    malla_usd.CreateNormalsAttr(Vt.Vec3fArray.FromNumpy(np.asarray(capa.vertex_normals, dtype=np.float32)))
                    malla_usd.SetNormalsInterpolation(UsdGeom.Tokens.vertex)
                    malla_usd.CreateSubdivisionSchemeAttr(UsdGeom.Tokens.none)
                    UsdGeom.PrimvarsAPI(malla_usd).CreatePrimvar(
                        "st", Sdf.ValueTypeNames.TexCoord2fArray, UsdGeom.Tokens.vertex).Set(
                        Vt.Vec2fArray.FromNumpy(np.asarray(capa.visual.uv, dtype=np.float32)))
                    UsdShade.MaterialBindingAPI.Apply(malla_usd.GetPrim()).Bind(
                        _material(stage, capa.visual.material, materiales))
        stage.GetRootLayer().Save()
        UsdUtils.CreateNewUsdzPackage(Sdf.AssetPath(usdc), str(ruta))
    return ruta


# ---------------------------------------------------------------- balanza (JSON)
def balanza():
    """La balanza del JSON como cuerpos: estructura fija, brazo y dos pesas que cuelgan verticales."""
    definicion = json.loads((CARPETA / "balanza.json").read_text())
    piv = np.asarray(definicion["grupos"]["brazo"]["pivote"], dtype=float)
    cuerpos = {"fijo": [], "brazo": []}
    for p in definicion["piezas"]:
        if p.get("grupo") == "brazo":
            cuerpos["brazo"].append((p["id"], mecanismos.M(np.asarray(p["pos"]) - piv, p.get("rot") or (0, 0, 0))))
        else:
            cuerpos["fijo"].append((p["id"], mecanismos.M(p["pos"], p.get("rot") or (0, 0, 0))))
    pesas = definicion["pesas"]
    colgantes = {pid: np.array([x, pesas["altura"], pesas["z"]]) - piv for pid, x in pesas["inicial"].items()}
    for pid in colgantes:
        cuerpos[pid] = [(pid, np.eye(4))]

    def movimiento(t):
        # vaivén amortiguado: la balanza oscila y se queda en equilibrio
        a = math.radians(14.0) * math.exp(-t / 1.4) * math.cos(2 * math.pi * t / 1.7)
        brazo = mecanismos.mover(piv) @ mecanismos.giro(mecanismos.Z, a)
        poses = {"brazo": brazo}
        for pid, local in colgantes.items():
            poses[pid] = brazo @ mecanismos.mover(local) @ mecanismos.giro(mecanismos.Z, -a)
        return poses
    return dict(id="balanza", nombre=definicion["nombre"], duracion=6.0, cuerpos=cuerpos, movimiento=movimiento)


def main():
    pedidos = set(sys.argv[1:])
    for fabricar in [balanza, *mecanismos.TODOS]:
        mec = fabricar()
        if pedidos and mec["id"] not in pedidos:
            continue
        escena, ruta = exportar(mec)
        ext = (escena.bounds[1] - escena.bounds[0]) * 1000
        usdz = ruta.with_suffix(".usdz")
        print(f"{mec['id']:18s} {ext[0]:4.0f} x {ext[1]:4.0f} x {ext[2]:4.0f} mm  "
              f"glb {ruta.stat().st_size // 1024:5d} KB  usdz {usdz.stat().st_size // 1024:5d} KB")


if __name__ == "__main__":
    main()
