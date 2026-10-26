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
| `js/balanza.js` | Balanza interactiva + botón de realidad aumentada |
| `js/datos.js` | Textos de los mecanismos y banco de preguntas |
| `modelos/piezas/` | GLB de cada pieza del kit, a escala real |
| `modelos/mecanismos/` | Armado de cada mecanismo (`.json`) y su GLB animado para AR |
| `img/cartilla/` | Las 40 páginas de la cartilla |
| `herramientas/` | Scripts que generan los modelos 3D |

### Regenerar los modelos 3D

Las medidas están en `herramientas/generar_piezas.py` (y explicadas en `recursos/piezas/medidas.md`).

```bash
uv venv .venv && uv pip install --python .venv/bin/python trimesh manifold3d numpy pygltflib
.venv/bin/python herramientas/generar_piezas.py      # piezas
.venv/bin/python herramientas/generar_mecanismos.py  # mecanismos armados (AR)
```

Para agregar un mecanismo: crear `modelos/mecanismos/<id>.json` con sus piezas
(posición en mm, rotación en grados), correr `generar_mecanismos.py` y marcarlo con
`modelo3d: true` en `js/datos.js`.

### Publicar

La realidad aumentada exige HTTPS. GitHub Pages sirve: Settings → Pages → rama `main`, carpeta raíz.

## Derechos

- **Código** (HTML, CSS, JavaScript y scripts de `herramientas/`): licencia MIT, ver `LICENSE`.
- **La cartilla** *Vivencia tecnológica: Sistemas mecánicos* (ISBN 978-958-57808-6-6), sus páginas
  en `img/cartilla/`, ilustraciones, textos y el logo de ATA EPE: © 2026 Corporación Escuela
  Pedagógica Experimental. Todos los derechos reservados. No están cubiertos por la licencia MIT.
