"""Lista las imágenes de la carpeta pública de Drive configurada en datos/config.json
y escribe datos/galeria.json para la página de galería. Solo usa la biblioteca estándar.

Uso:  python3 herramientas/actualizar_galeria.py [--carpeta ENLACE] [--salida RUTA]
La carpeta tiene que estar compartida como "Cualquier persona con el enlace puede ver".
"""
import argparse
import html
import json
import re
import sys
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ENTRADA = re.compile(
    r'<div class="flip-entry" id="entry-([\w-]+)".*?'
    r'drive-thirdparty\.googleusercontent\.com/\d+/type/([\w.+-]+/[\w.+-]+)".*?'
    r'<div class="flip-entry-title">(.*?)</div>', re.S)


def id_carpeta(valor):
    m = re.search(r"folders/([\w-]+)", valor) or re.search(r"[?&]id=([\w-]+)", valor)
    return m.group(1) if m else valor.strip()


def listar(carpeta):
    url = f"https://drive.google.com/embeddedfolderview?id={carpeta}"
    pedido = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(pedido, timeout=60) as r:
        pagina = r.read().decode("utf-8", "ignore")
    return [{"id": i, "nombre": html.unescape(nombre)}
            for i, tipo, nombre in ENTRADA.findall(pagina) if tipo.startswith("image/")]


def main():
    args = argparse.ArgumentParser()
    args.add_argument("--salida", default=str(RAIZ / "datos" / "galeria.json"))
    args.add_argument("--carpeta", help="enlace o id de la carpeta (por defecto, el de datos/config.json)")
    opciones = args.parse_args()
    salida = Path(opciones.salida)
    config = json.loads((RAIZ / "datos" / "config.json").read_text(encoding="utf-8"))
    carpeta = id_carpeta(opciones.carpeta or config["galeria"].get("carpeta", ""))
    if not carpeta:
        print("No hay carpeta configurada en datos/config.json; nada que hacer.")
        return
    imagenes = listar(carpeta)
    nuevo = {"imagenes": imagenes}
    if salida.exists() and json.loads(salida.read_text(encoding="utf-8")) == nuevo:
        print(f"Sin cambios ({len(imagenes)} imágenes).")
        return
    salida.parent.mkdir(parents=True, exist_ok=True)
    salida.write_text(json.dumps(nuevo, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(imagenes)} imágenes escritas en {salida}")


if __name__ == "__main__":
    sys.exit(main())
