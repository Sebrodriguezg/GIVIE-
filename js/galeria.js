// Galería de diseños desde una carpeta pública de Google Drive.
// datos/galeria.json lo genera herramientas/actualizar_galeria.py (lo corre una GitHub Action
// cada pocas horas). Si todavía no existe, se muestra la carpeta de Drive incrustada.

const $ = sel => document.querySelector(sel);
const imagen = (id, ancho) => `https://lh3.googleusercontent.com/d/${id}=w${ancho}`;

function sinExtension(nombre) {
  return nombre.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
}

function visor(imagenes, inicio) {
  let i = inicio;
  const fondo = document.createElement('div');
  fondo.className = 'ventana visor';
  fondo.innerHTML = `
    <button class="visor-flecha visor-ant" aria-label="Anterior">‹</button>
    <figure class="ventana-caja"><button class="ventana-cerrar" aria-label="Cerrar">×</button>
      <img alt=""><figcaption></figcaption></figure>
    <button class="visor-flecha visor-sig" aria-label="Siguiente">›</button>`;
  const img = fondo.querySelector('img'), pie = fondo.querySelector('figcaption');
  const mostrar = () => {
    const actual = imagenes[i];
    img.src = imagen(actual.id, 2000);
    img.alt = pie.textContent = sinExtension(actual.nombre);
  };
  const paso = d => { i = (i + d + imagenes.length) % imagenes.length; mostrar(); };
  const cerrar = () => { fondo.remove(); removeEventListener('keydown', tecla); };
  const tecla = e => {
    if (e.key === 'Escape') cerrar();
    if (e.key === 'ArrowRight') paso(1);
    if (e.key === 'ArrowLeft') paso(-1);
  };
  fondo.addEventListener('click', e => {
    if (e.target.closest('.visor-sig')) paso(1);
    else if (e.target.closest('.visor-ant')) paso(-1);
    else if (e.target === fondo || e.target.closest('.ventana-cerrar')) cerrar();
  });
  addEventListener('keydown', tecla);
  document.body.append(fondo);
  mostrar();
}

async function iniciar() {
  const { galeria } = await (await fetch('../datos/config.json')).json();
  if (galeria.formulario) {
    const subir = $('#subir');
    subir.href = galeria.formulario;
    subir.hidden = false;
  }
  const contenedor = $('#galeria');
  let datos = null;
  try {
    const r = await fetch('../datos/galeria.json', { cache: 'no-cache' });
    if (r.ok) datos = await r.json();
  } catch { /* aún no hay listado */ }

  const imagenes = datos?.imagenes ?? [];
  if (imagenes.length) {
    contenedor.innerHTML = `<div class="galeria">${imagenes.map((im, k) => `
      <button type="button" class="galeria-item" data-k="${k}">
        <img src="${imagen(im.id, 600)}" alt="${sinExtension(im.nombre)}" loading="lazy">
      </button>`).join('')}</div>`;
    contenedor.addEventListener('click', e => {
      const b = e.target.closest('.galeria-item');
      if (b) visor(imagenes, Number(b.dataset.k));
    });
  } else if (galeria.carpeta) {
    contenedor.innerHTML = `<iframe class="galeria-drive" title="Galería en Google Drive"
      src="https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(galeria.carpeta)}#grid"></iframe>`;
  } else {
    contenedor.innerHTML = '<div class="espacio-pronto">Pronto: aquí se verán los diseños y prototipos que la gente comparta.</div>';
  }
}

iniciar();
