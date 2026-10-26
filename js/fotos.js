// Visor sencillo para las fotos de las páginas internas: los enlaces dentro de .fotos se abren en grande.
const enlaces = [...document.querySelectorAll('.fotos a, a.foto')];
let i = 0;
const fondo = document.createElement('div');
fondo.className = 'ventana visor';
fondo.hidden = true;
fondo.innerHTML = `
  <button class="visor-flecha visor-ant" aria-label="Anterior">‹</button>
  <figure class="ventana-caja"><button class="ventana-cerrar" aria-label="Cerrar">×</button>
    <img alt=""><figcaption></figcaption></figure>
  <button class="visor-flecha visor-sig" aria-label="Siguiente">›</button>`;
document.body.append(fondo);
const img = fondo.querySelector('img'), pie = fondo.querySelector('figcaption');

function mostrar(k) {
  i = (k + enlaces.length) % enlaces.length;
  const miniatura = enlaces[i].querySelector('img');
  img.src = enlaces[i].href;
  img.alt = pie.textContent = miniatura?.alt ?? '';
  fondo.hidden = false;
}

enlaces.forEach((a, k) => a.addEventListener('click', e => { e.preventDefault(); mostrar(k); }));
fondo.addEventListener('click', e => {
  if (e.target.closest('.visor-sig')) mostrar(i + 1);
  else if (e.target.closest('.visor-ant')) mostrar(i - 1);
  else if (e.target === fondo || e.target.closest('.ventana-cerrar')) fondo.hidden = true;
});
addEventListener('keydown', e => {
  if (fondo.hidden) return;
  if (e.key === 'Escape') fondo.hidden = true;
  if (e.key === 'ArrowRight') mostrar(i + 1);
  if (e.key === 'ArrowLeft') mostrar(i - 1);
});
