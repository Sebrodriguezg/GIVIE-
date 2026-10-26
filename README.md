# GIVIE-

Repositorio donde va a estar la página y la información necesaria.

## Vivencia tecnológica: Sistemas mecánicos — web del lanzamiento

Página del lanzamiento de la cartilla de la Corporación Escuela Pedagógica Experimental
y ATA EPE Robótica Escolar (GIVIE). Sitio estático: HTML, CSS y JavaScript con three.js
desde CDN. No hay que compilar nada; para anexarlo a otro sitio basta con copiar la carpeta.

### Verla en el computador

```bash
python3 -m http.server 8765
# abrir http://127.0.0.1:8765
```

(Abrir `index.html` con doble clic no sirve: los módulos y modelos 3D necesitan un servidor.)

### Estructura

| Ruta | Qué es |
|---|---|
| `index.html` | Portada, la cartilla, el evento, vistazo a la cartilla, menú final |
| `secciones/` | Páginas internas: GIVIE, historia, experiencias, kits |
| `js/fondo.js` | Piezas 3D del fondo (un conjunto distinto en cada visita) |
| `js/balanza.js` | Balanza interactiva |
| `js/ar.js` | Modelos animados con model-viewer y realidad aumentada |
| `js/datos.js` | Textos de los mecanismos y banco de preguntas |
| `modelos/piezas/` | GLB de cada pieza del kit, a escala real |
| `modelos/mecanismos/` | GLB animado de cada mecanismo (3D y AR); `balanza.json` arma la balanza interactiva |
| `piezas.html`, `mecanismos.html` | Catálogos para revisar los modelos |
| `img/cartilla/` | Las 40 páginas de la cartilla |
| `herramientas/` | Scripts que generan los modelos 3D |

### Regenerar los modelos 3D

Las medidas están en `herramientas/generar_piezas.py` (y explicadas en `recursos/piezas/medidas.md`).
Cada pieza sale en dos capas (cuerpo e interior de los agujeros, más oscuro), con biseles en los
bordes y una textura sutil de plástico impreso (`modelos/texturas/plastico.jpg`, mapa de normales).

```bash
uv venv .venv && uv pip install --python .venv/bin/python trimesh manifold3d numpy scipy pillow rtree pygltflib usd-core
.venv/bin/python herramientas/generar_piezas.py      # piezas
.venv/bin/python herramientas/generar_mecanismos.py  # mecanismos armados (AR)
```

Los mecanismos están en `herramientas/mecanismos.py`: cada uno lista sus cuerpos rígidos
(piezas del kit en mm y grados, más figuras propias) y una función `movimiento(t)` con la
cinemática. `generar_mecanismos.py` muestrea ese movimiento y lo guarda como animación en el GLB.
En `js/datos.js`, `modelo3d: 'animado'` lo muestra en la página.

### Videos y galería

Todo se configura en `datos/config.json`, sin tocar código:

```json
{
  "videos": {
    "lista_reproduccion": "https://www.youtube.com/playlist?list=...",
    "videos": [{ "url": "https://youtu.be/...", "titulo": "Balanza", "descripcion": "..." }]
  },
  "galeria": {
    "carpeta": "https://drive.google.com/drive/folders/...",
    "hoja": "https://docs.google.com/spreadsheets/d/...",
    "formulario": "https://forms.gle/..."
  }
}
```

- **Videos:** una lista de reproducción de YouTube se actualiza sola al agregarle videos en YouTube;
  la lista `videos` sirve para escoger videos sueltos con su título.
- **Galería:** la carpeta de Drive debe estar compartida como «cualquier persona con el enlace puede ver».
  La Action `.github/workflows/galeria.yml` revisa la carpeta cada 30 minutos, escribe `datos/galeria.json`
  y vuelve a publicar la página. Para actualizar ya: pestaña **Actions → Actualizar galería → Run workflow**.
  Mientras no exista `galeria.json`, la página muestra la carpeta de Drive incrustada.
- `hoja` (opcional): la hoja de respuestas del formulario. De ella solo se toman el nombre del
  modelo, el autor y la fecha, para el pie de cada foto; nunca correos ni otros datos.
  Solo se muestra lo que está en la carpeta: sacar un archivo de la carpeta lo quita de la web.
- `formulario` (opcional) muestra el botón «Sube tu diseño».

### Publicar

La realidad aumentada exige HTTPS. GitHub Pages sirve: Settings → Pages → rama `main`, carpeta raíz.

## Derechos

- **Código** (HTML, CSS, JavaScript y scripts de `herramientas/`): licencia MIT, ver `LICENSE`.
- **La cartilla** *Vivencia tecnológica: Sistemas mecánicos* (ISBN 978-958-57808-6-6), sus páginas
  en `img/cartilla/`, ilustraciones, textos y el logo de ATA EPE: © 2026 Corporación Escuela
  Pedagógica Experimental. Todos los derechos reservados. No están cubiertos por la licencia MIT.
