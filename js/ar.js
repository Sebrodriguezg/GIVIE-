// Modelos animados con <model-viewer>: vista 3D en la página y realidad aumentada en el celular.
import { rutaBase } from './piezas3d.js';

const MODEL_VIEWER = 'https://cdn.jsdelivr.net/npm/@google/model-viewer@3.5.0/dist/model-viewer.min.js';
const QR = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
const cargados = new Map();

export function cargarScript(src) {
  if (!cargados.has(src)) {
    cargados.set(src, new Promise((ok, falla) => {
      const s = Object.assign(document.createElement('script'), { src, onload: ok, onerror: falla });
      if (src === MODEL_VIEWER) s.type = 'module';
      document.head.append(s);
    }));
  }
  return cargados.get(src);
}

export async function prepararVisor() {
  await cargarScript(MODEL_VIEWER);
  await customElements.whenDefined('model-viewer');
}

/** Etiqueta <model-viewer> para el mecanismo m (ver datos.js). */
export function visorHtml(m, estilo = '') {
  const camara = m.camara ?? {};
  return `<model-viewer src="${rutaBase()}modelos/mecanismos/${m.id}.glb" alt="${m.nombre} armado con el kit ATA EPE"
    ar ar-modes="webxr scene-viewer quick-look" ar-scale="auto" camera-controls autoplay touch-action="pan-y"
    shadow-intensity="1" exposure="1.05" camera-orbit="${camara.orbita ?? '25deg 72deg auto'}"
    ${camara.objetivo ? `camera-target="${camara.objetivo}"` : ''} style="${estilo}"></model-viewer>`;
}

function enlaceMecanismo(id) {
  return location.href.split('#')[0] + '#m-' + id;
}

/** Abre la realidad aumentada si el aparato puede; si no, una ventana con el modelo y un QR. */
export async function verEnMesa(m, abrirVentana, visor = null) {
  await prepararVisor();
  if (visor?.canActivateAR) { visor.activateAR(); return; }
  const caja = document.createElement('div');
  caja.innerHTML = `
    <h3 class="titulo" style="font-size:2rem;margin-bottom:8px">${m.nombre} en tu mesa</h3>
    ${visorHtml(m, 'width:min(84vw,620px);height:min(58vh,460px);background:radial-gradient(#fffaf0,#efe6cf);border-radius:16px')}
    <div class="ar-ayuda"></div>`;
  const visorVentana = caja.querySelector('model-viewer');
  visorVentana.insertAdjacentHTML('beforeend',
    '<button slot="ar-button" class="boton boton-rojo" style="position:absolute;left:50%;bottom:14px;transform:translateX(-50%)">Ponerlo en mi mesa</button>');
  abrirVentana(caja);
  const ayuda = caja.querySelector('.ar-ayuda');
  const explicar = () => {
    if (visorVentana.canActivateAR) {
      ayuda.innerHTML = '<p>Apunta la cámara a una mesa o al piso y toca la pantalla para ubicarlo.</p>';
      return;
    }
    ayuda.innerHTML = '<p style="font-family:var(--mano);font-size:1.3rem;margin:12px 0 0">Ábrelo en tu celular para verlo sobre tu mesa:</p><div class="qr"></div>';
    cargarScript(QR).then(() => {
      const qr = window.qrcode(0, 'M');
      qr.addData(enlaceMecanismo(m.id));
      qr.make();
      ayuda.querySelector('.qr').innerHTML = qr.createSvgTag({ cellSize: 5, margin: 2, scalable: false });
    });
  };
  if (visorVentana.loaded) explicar(); else visorVentana.addEventListener('load', explicar, { once: true });
}
