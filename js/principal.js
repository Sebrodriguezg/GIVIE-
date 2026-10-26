import { MECANISMOS, PREGUNTAS } from './datos.js';
import { prepararVisor, verEnMesa, visorHtml } from './ar.js';

const $ = sel => document.querySelector(sel);
const EVENTO = new Date('2026-11-07T14:00:00-05:00');
const FIN_EVENTO = new Date('2026-11-07T17:00:00-05:00');

// ---------- barra: aparece al salir de la portada
const barra = $('#barra');
new IntersectionObserver(([e]) => barra.classList.toggle('visible', !e.isIntersecting), { threshold: 0.25 })
  .observe($('#inicio'));

// ---------- secciones que aparecen al llegar
const revelador = new IntersectionObserver(entradas => {
  for (const e of entradas) if (e.isIntersecting) { e.target.classList.add('visto'); revelador.unobserve(e.target); }
}, { threshold: 0.12 });
document.querySelectorAll('.revelar').forEach(el => revelador.observe(el));

// ---------- pregunta al azar (distinta de la de la visita anterior)
const preguntaTexto = $('#pregunta-texto');
let preguntaActual = -1;
function nuevaPregunta() {
  let anterior = preguntaActual;
  if (anterior < 0) { try { anterior = Number(localStorage.getItem('pregunta') ?? -1); } catch { /* sin almacenamiento */ } }
  let i;
  do { i = Math.floor(Math.random() * PREGUNTAS.length); } while (i === anterior && PREGUNTAS.length > 1);
  preguntaActual = i;
  try { localStorage.setItem('pregunta', i); } catch { /* sin almacenamiento */ }
  const p = PREGUNTAS[i];
  preguntaTexto.textContent = p.texto;
  preguntaTexto.classList.remove('cambio'); void preguntaTexto.offsetWidth; preguntaTexto.classList.add('cambio');
  let enlace = $('#pregunta-ir');
  if (!enlace) {
    enlace = document.createElement('a');
    enlace.id = 'pregunta-ir';
    enlace.className = 'pregunta-otra';
    enlace.style.marginLeft = '8px';
    enlace.style.textDecoration = 'none';
    $('#pregunta').append(enlace);
  }
  enlace.hidden = !p.mecanismo;
  if (p.mecanismo) { enlace.href = `#m-${p.mecanismo}`; enlace.textContent = 'Explorar →'; }
}
$('#pregunta-otra').addEventListener('click', nuevaPregunta);
nuevaPregunta();

// el fondo cuenta qué conjunto de piezas tocó hoy
document.addEventListener('fondo:conjunto', e => {
  const chip = document.createElement('p');
  chip.className = 'portada-kicker';
  chip.style.fontSize = '1rem';
  chip.style.opacity = '.8';
  chip.textContent = `Fondo de hoy: ${e.detail} · toca una pieza`;
  $('.desliza').before(chip);
});

// ---------- cuenta regresiva
function dosCifras(n) { return String(n).padStart(2, '0'); }
function contar() {
  const ahora = new Date();
  const ms = EVENTO - ahora;
  if (ms <= 0) {
    $('#cuenta').hidden = true;
    const msj = $('#cuenta-mensaje');
    msj.hidden = false;
    msj.textContent = ahora < FIN_EVENTO ? '¡Está pasando ahora mismo!' : '¡Gracias por acompañarnos en el lanzamiento!';
    return false;
  }
  const s = Math.floor(ms / 1000);
  $('#cuenta-dias').textContent = Math.floor(s / 86400);
  $('#cuenta-horas').textContent = dosCifras(Math.floor(s / 3600) % 24);
  $('#cuenta-min').textContent = dosCifras(Math.floor(s / 60) % 60);
  $('#cuenta-seg').textContent = dosCifras(s % 60);
  return true;
}
if (contar()) { const reloj = setInterval(() => { if (!contar()) clearInterval(reloj); }, 1000); }

// ---------- ventana emergente reutilizable
export function abrirVentana(contenido) {
  const fondo = document.createElement('div');
  fondo.className = 'ventana';
  fondo.innerHTML = '<div class="ventana-caja" role="dialog" aria-modal="true"><button class="ventana-cerrar" aria-label="Cerrar">×</button></div>';
  fondo.querySelector('.ventana-caja').append(contenido);
  const cerrar = () => { fondo.remove(); removeEventListener('keydown', tecla); };
  const tecla = e => { if (e.key === 'Escape') cerrar(); };
  fondo.addEventListener('click', e => { if (e.target === fondo || e.target.closest('.ventana-cerrar')) cerrar(); });
  addEventListener('keydown', tecla);
  document.body.append(fondo);
  return cerrar;
}

// ---------- vistazo a la cartilla
const pestanas = $('#mecanismos');
const panel = $('#mecanismo');
let desmontar = null;

for (const m of MECANISMOS) {
  const b = document.createElement('button');
  b.type = 'button';
  b.role = 'tab';
  b.dataset.id = m.id;
  b.innerHTML = `<span class="num">${m.num}</span> ${m.nombre}`;
  b.addEventListener('click', () => mostrar(m.id));
  pestanas.append(b);
}

function paginasHtml(m) {
  return `<div class="paginas">${m.paginas.map(n =>
    `<img src="img/cartilla/pag-${String(n).padStart(2, '0')}.webp" alt="${m.nombre}, página ${n} de la cartilla" loading="lazy" width="1600" height="900">`).join('')}</div>`;
}

async function mostrar(id, desplazar = false) {
  const m = MECANISMOS.find(x => x.id === id) ?? MECANISMOS[0];
  pestanas.querySelectorAll('button').forEach(b => b.setAttribute('aria-selected', b.dataset.id === m.id));
  desmontar?.(); desmontar = null;
  panel.innerHTML = `
    <div class="mecanismo-cabeza"><h3>${m.nombre}${m.modelo3d ? '' : '<span class="pronto">pronto en 3D</span>'}</h3><p>${m.apodo}</p></div>
    <p class="mecanismo-pregunta">${m.pregunta}</p>
    ${m.modelo3d === 'animado' ? `
    <div class="lab">
      <div class="lab-escena">${visorHtml(m, 'width:100%;height:100%;position:absolute;inset:0')}</div>
      <div class="lab-panel">
        <h4>Míralo moverse</h4>
        <p>${m.pista}</p>
        <p>Gira el modelo arrastrando el dedo o el mouse. Las marcas rojas ayudan a contar las vueltas.</p>
        <div class="lab-botones">
          <button type="button" class="boton boton-rojo" id="lab-ar">Ver en mi mesa (AR)</button>
          <button type="button" class="boton boton-claro" id="lab-pausa">Pausar</button>
          <button type="button" class="boton boton-claro" id="lab-lento">Más lento</button>
        </div>
      </div>
    </div>` : ''}
    ${m.modelo3d === 'interactivo' ? `
    <div class="lab">
      <div class="lab-escena" id="lab-escena"><div class="lab-cargando">Armando la balanza…</div></div>
      <div class="lab-panel">
        <h4>¡Encuentra el equilibrio!</h4>
        <p>Arrastra el objeto <b style="color:var(--rojo)">pesado</b> y el <b style="color:#2a8fc4">liviano</b> por el brazo de la balanza. ¿Dónde los colocarías para que quede derecha?</p>
        <p>Gira la balanza arrastrando el fondo.</p>
        <p class="lab-cuentas" id="lab-cuentas" hidden></p>
        <div class="lab-botones">
          <button type="button" class="boton boton-rojo" id="lab-ar">Ver en mi mesa (AR)</button>
          <button type="button" class="boton boton-claro" id="lab-reiniciar">Otra vez</button>
          <button type="button" class="boton boton-claro" id="lab-ver-cuentas">Ver las cuentas</button>
        </div>
      </div>
    </div>` : ''}
    ${paginasHtml(m)}
    <p class="sabias"><b>Sabías que…</b> ${m.sabias}</p>`;
  panel.querySelectorAll('.paginas img').forEach(img => img.addEventListener('click', () => {
    const grande = document.createElement('img');
    grande.src = img.src; grande.alt = img.alt;
    abrirVentana(grande);
  }));
  if (desplazar) $('#vistazo').scrollIntoView({ behavior: 'smooth' });
  if (m.modelo3d === 'interactivo') {
    const { montar } = await import(`./${m.id}.js`);
    desmontar = await montar($('#lab-escena'), { abrirVentana });
  } else if (m.modelo3d === 'animado') {
    const visor = panel.querySelector('model-viewer');
    $('#lab-ar').addEventListener('click', () => verEnMesa(m, abrirVentana, visor));
    $('#lab-pausa').addEventListener('click', e => {
      if (visor.paused) { visor.play(); e.target.textContent = 'Pausar'; } else { visor.pause(); e.target.textContent = 'Seguir'; }
    });
    $('#lab-lento').addEventListener('click', e => {
      const lento = visor.timeScale === 1;
      visor.timeScale = lento ? 0.35 : 1;
      e.target.textContent = lento ? 'Velocidad normal' : 'Más lento';
    });
    prepararVisor();
  }
}

function desdeHash() {
  const id = location.hash.startsWith('#m-') ? location.hash.slice(3) : null;
  if (id) { mostrar(id, true); return true; }
  return false;
}
addEventListener('hashchange', desdeHash);
if (!desdeHash()) {
  // la balanza se arma solo cuando el vistazo se acerca a la pantalla
  new IntersectionObserver(([e], obs) => {
    if (e.isIntersecting) { obs.disconnect(); if (!panel.innerHTML.trim()) mostrar('balanza'); }
  }, { rootMargin: '400px' }).observe($('#vistazo'));
}
