// Contenido tomado de la cartilla "Vivencia tecnológica: Sistemas mecánicos".
// paginas: números de página del PDF (img/cartilla/pag-XX.webp).
// modelo3d: 'interactivo' (js/<id>.js propio) o 'animado' (modelos/mecanismos/<id>.glb en <model-viewer>).
// En la página solo van dos de los siete prototipos; la segunda página de cada uno se muestra sombreada.

export const MECANISMOS = [
  {
    id: 'balanza', num: 1, nombre: 'Balanza de brazos iguales', apodo: 'Equilibrio',
    paginas: [12, 13], modelo3d: 'interactivo',
    pregunta: '¿Qué pasa si coloco los objetos a distancias diferentes sobre los brazos de la balanza?',
    sabias: 'Las primeras balanzas aparecieron hace más de 5.000 años en el Antiguo Egipto, donde eran usadas para medir la cantidad de granos, oro y piedras preciosas.',
  },
  {
    id: 'pantografo', num: 2, nombre: 'Pantógrafo', apodo: 'Copiar y ampliar',
    paginas: [14, 15], modelo3d: 'interactivo',
    camara: { orbita: '15deg 50deg 0.42m', objetivo: '0.11m 0.02m -0.04m' },
    pregunta: '¿Cómo crees que funciona el mecanismo del pantógrafo en los trenes eléctricos?',
    sabias: 'El pantógrafo, creado en 1603 por Christoph Scheiner, permitió copiar y cambiar el tamaño de dibujos sin perder proporciones.',
  },
];

export const PREGUNTAS = [
  { texto: '¿Qué es el equilibrio para ti?', mecanismo: 'balanza' },
  { texto: '¿Qué pasa si coloco los objetos a distancias diferentes sobre los brazos de una balanza?', mecanismo: 'balanza' },
  { texto: '¿Dónde colocarías dos objetos pesados y dos livianos para encontrar el equilibrio?', mecanismo: 'balanza' },
  { texto: '¿Cómo copia un pantógrafo un dibujo sin perder sus proporciones?', mecanismo: 'pantografo' },
  { texto: 'Si dibujas una casa pequeña, ¿de qué tamaño la dibuja el lápiz del pantógrafo?', mecanismo: 'pantografo' },
  { texto: '¿Cuál es el propósito de un diseño? ¿Cuál es su estructura?', mecanismo: null },
];
