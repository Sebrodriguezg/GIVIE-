"""Lista las fotos y videos de la carpeta pública de Drive configurada en datos/config.json,
les pone autor y nombre del modelo desde la hoja de respuestas del formulario, y escribe
datos/galeria.json para la página de galería. Solo usa la biblioteca estándar.

Uso:  python3 herramientas/actualizar_galeria.py [--carpeta ENLACE] [--hoja ENLACE] [--salida RUTA]
- La carpeta manda: solo se muestra lo que está en ella (sacar un archivo de la carpeta lo quita de la web).
- De la hoja solo se leen el nombre del modelo, el autor y la fecha; nunca correos ni otros datos.
"""
import argparse
import csv
import html
import io
import json
import re
import sys
import urllib.request
from datetime import datetime
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ENTRADA = re.compile(
    r'<div class="flip-entry" id="entry-([\w-]+)".*?'
    r'drive-thirdparty\.googleusercontent\.com/\d+/type/([\w.+-]+/[\w.+-]+)".*?'
    r'<div class="flip-entry-title">(.*?)</div>', re.S)
ID_ARCHIVO = re.compile(r"(?:open\?id=|/file/d/|[?&]id=)([\w-]{20,})")

# palabras con que se reconocen las columnas del formulario (en minúsculas)
COLUMNAS = {
    "titulo": ("nombre de tu modelo", "nombre del modelo", "modelo", "diseño", "titulo", "título"),
    "autor": ("nombre completo", "apodo", "autor", "tu nombre", "nombre"),
    "fecha": ("marca temporal", "timestamp", "fecha"),
}


def leer(url):
    pedido = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(pedido, timeout=60) as r:
        return r.read().decode("utf-8", "ignore")


def id_carpeta(valor):
    m = re.search(r"folders/([\w-]+)", valor) or re.search(r"[?&]id=([\w-]+)", valor)
    return m.group(1) if m else valor.strip()


def url_csv(hoja):
    """Enlace de la hoja (normal o «publicada en la web») convertido a su exportación CSV."""
    if "output=csv" in hoja or "format=csv" in hoja:
        return hoja
    if "/spreadsheets/d/e/" in hoja:                     # publicada en la web
        return re.sub(r"/pub.*$", "", hoja) + "/pub?output=csv" + (
            "&gid=" + re.search(r"gid=(\d+)", hoja).group(1) if "gid=" in hoja else "")
    m = re.search(r"/spreadsheets/d/([\w-]+)", hoja)
    gid = re.search(r"gid=(\d+)", hoja)
    return f"https://docs.google.com/spreadsheets/d/{m.group(1)}/export?format=csv" + (f"&gid={gid.group(1)}" if gid else "")


def listar_carpeta(carpeta):
    pagina = leer(f"https://drive.google.com/embeddedfolderview?id={carpeta}")
    archivos = []
    for i, tipo, nombre in ENTRADA.findall(pagina):
        if tipo.startswith(("image/", "video/")):
            archivos.append({"id": i, "nombre": html.unescape(nombre),
                             "tipo": "video" if tipo.startswith("video/") else "imagen"})
    return archivos


def buscar_columna(encabezados, clave, usadas):
    for palabra in COLUMNAS[clave]:
        for k, e in enumerate(encabezados):
            if k not in usadas and palabra in e.strip().lower():
                return k
    return None


def leer_respuestas(hoja):
    """{id de archivo: {"titulo", "autor", "fecha"}} a partir de la hoja del formulario."""
    filas = list(csv.reader(io.StringIO(leer(url_csv(hoja)))))
    if not filas:
        return {}
    encabezados, filas = filas[0], filas[1:]
    enlaces = next((k for k in range(len(encabezados))
                    if any(ID_ARCHIVO.search(f[k]) for f in filas if k < len(f))), None)
    if enlaces is None:
        return {}
    usadas = {enlaces}
    col = {}
    for clave in ("fecha", "titulo", "autor"):         # el título antes que el autor: ambos dicen «nombre»
        col[clave] = buscar_columna(encabezados, clave, usadas)
        if col[clave] is not None:
            usadas.add(col[clave])
    datos = {}
    for f in filas:
        valor = lambda clave: f[col[clave]].strip() if col[clave] is not None and col[clave] < len(f) else ""
        for archivo in ID_ARCHIVO.findall(f[enlaces] if enlaces < len(f) else ""):
            datos[archivo] = {"titulo": valor("titulo"), "autor": valor("autor"), "fecha": valor("fecha")}
    return datos


def fecha_orden(texto):
    for formato in ("%d/%m/%Y %H:%M:%S", "%m/%d/%Y %H:%M:%S", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(texto, formato).isoformat()
        except ValueError:
            pass
    return ""


def main():
    args = argparse.ArgumentParser()
    args.add_argument("--salida", default=str(RAIZ / "datos" / "galeria.json"))
    args.add_argument("--carpeta", help="enlace o id de la carpeta (por defecto, el de datos/config.json)")
    args.add_argument("--hoja", help="enlace de la hoja de respuestas (por defecto, el de datos/config.json)")
    opciones = args.parse_args()
    salida = Path(opciones.salida)
    config = json.loads((RAIZ / "datos" / "config.json").read_text(encoding="utf-8"))["galeria"]
    carpeta = id_carpeta(opciones.carpeta or config.get("carpeta", ""))
    hoja = opciones.hoja or config.get("hoja", "")
    if not carpeta:
        print("No hay carpeta configurada en datos/config.json; nada que hacer.")
        return
    archivos = listar_carpeta(carpeta)
    respuestas = leer_respuestas(hoja) if hoja else {}
    for a in archivos:
        r = respuestas.get(a["id"], {})
        a["titulo"] = r.get("titulo", "")
        a["autor"] = r.get("autor", "")
        a["fecha"] = fecha_orden(r.get("fecha", ""))
    archivos.sort(key=lambda a: a["fecha"], reverse=True)   # lo más reciente primero
    nuevo = {"imagenes": archivos}
    if salida.exists() and json.loads(salida.read_text(encoding="utf-8")) == nuevo:
        print(f"Sin cambios ({len(archivos)} archivos).")
        return
    salida.parent.mkdir(parents=True, exist_ok=True)
    salida.write_text(json.dumps(nuevo, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    con_datos = sum(1 for a in archivos if a["titulo"] or a["autor"])
    print(f"{len(archivos)} archivos ({con_datos} con autor/nombre) escritos en {salida}")


if __name__ == "__main__":
    sys.exit(main())
