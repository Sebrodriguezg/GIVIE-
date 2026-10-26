// Contenido tomado de la cartilla "Vivencia tecnológica: Sistemas mecánicos".
// paginas: números de página del PDF (img/cartilla/pag-XX.webp).
// modelo3d: 'interactivo' (js/<id>.js propio) o 'animado' (modelos/mecanismos/<id>.glb en <model-viewer>).

export const MECANISMOS = [
  {
    id: 'balanza', num: 1, nombre: 'Balanza de brazos iguales', apodo: 'Equilibrio',
    paginas: [12, 13], modelo3d: 'interactivo',
    pregunta: '¿Qué pasa si coloco los objetos a distancias diferentes sobre los brazos de la balanza?',
    sabias: 'Las primeras balanzas aparecieron hace más de 5.000 años en el Antiguo Egipto, donde eran usadas para medir la cantidad de granos, oro y piedras preciosas.',
  },
  {
    id: 'pantografo', num: 2, nombre: 'Pantógrafo', apodo: 'Copiar y ampliar',
    paginas: [14, 15], modelo3d: 'animado',
    camara: { orbita: '15deg 50deg 0.42m', objetivo: '0.11m 0.02m -0.04m' },
    pista: 'Mira el punzón y el lápiz mientras se mueven: ¿qué dibuja cada uno? ¿En qué se parecen los dos dibujos?',
    pregunta: '¿Cómo crees que funciona el mecanismo del pantógrafo en los trenes eléctricos?',
    sabias: 'El pantógrafo, creado en 1603 por Christoph Scheiner, permitió copiar y cambiar el tamaño de dibujos sin perder proporciones.',
  },
  {
    id: 'manivela', num: 3, nombre: 'Manivela', apodo: 'Mono acróbata',
    paginas: [16, 17], modelo3d: 'animado',
    pista: 'La manivela hace girar el eje… ¿y el mono? ¿Qué pasaría si giraras la manivela al revés?',
    camara: { orbita: '30deg 75deg 0.55m', objetivo: '0m 0.15m 0m' },
    pregunta: '¿Qué sucede cuando muevo la manivela? ¿Cómo funciona el sistema?',
    sabias: 'Hubo manivelas tan grandes en molinos medievales que se necesitaban dos personas para girarlas.',
  },
  {
    id: 'biela', num: 4, nombre: 'Biela-manivela', apodo: 'Pescador',
    paginas: [18, 19], modelo3d: 'animado',
    pista: 'La rueda da vueltas, pero el bote no. ¿Qué movimiento hace el bote? ¿Qué pieza los une?',
    pregunta: '¿Cómo pasa el movimiento de rotación a un movimiento rectilíneo y oscilatorio?',
    sabias: 'El mecanismo biela-manivela fue concebido por Leonardo da Vinci en 1490.',
  },
  {
    id: 'dos-ruedas', num: 5, nombre: 'Sistema de dos ruedas', apodo: 'Poleas',
    paginas: [22, 23], modelo3d: 'animado',
    pista: 'Cuenta: mientras la manivela da una vuelta, ¿cuántas vueltas da la rueda pequeña?',
    pregunta: 'Si le damos dos, tres o cuatro giros a la manivela… ¿cuántas vueltas da la rueda grande y cuántas la pequeña?',
    sabias: 'La rueda fue inventada durante el Neolítico, probablemente entre el 3500 y el 3000 a. C., en Mesopotamia.',
  },
  {
    id: 'cuenta-historias', num: 6, nombre: 'Cuenta historias', apodo: 'Kinesis',
    paginas: [24, 25], modelo3d: 'animado',
    pista: '¿El disco de arriba gira igual que la rueda? Fíjate en la pelota de las viñetas mientras gira.',
    pregunta: '¿Qué pasa si le quitas la llanta a tu cuenta historias? ¿Por qué el mecanismo de arriba gira también?',
    sabias: 'En el siglo XIX se inventaron aparatos como el zoótropo y el fenaquistiscopio, antecesores de las películas y salas de cine que conocemos hoy.',
  },
  {
    id: 'bailarinas', num: 7, nombre: 'Bailarinas', apodo: 'Sistema de muchas ruedas',
    paginas: [26, 27], modelo3d: 'animado',
    pista: 'Sigue el movimiento: manivela, rueda, disco… ¿Las bailarinas giran hacia el mismo lado que la rueda central?',
    pregunta: '¿Qué sucede cuando muevo la manivela? ¿Cómo funciona el sistema?',
    sabias: 'Se considera que la polea fue inventada por Arquímedes en el siglo III a. C., en Siracusa. Se dice que movió un barco cargado usando poleas y cuerdas.',
  },
];

export const PREGUNTAS = [
  { texto: '¿Qué es el equilibrio para ti?', mecanismo: 'balanza' },
  { texto: '¿Qué pasa si coloco los objetos a distancias diferentes sobre los brazos de una balanza?', mecanismo: 'balanza' },
  { texto: '¿Dónde colocarías dos objetos pesados y dos livianos para encontrar el equilibrio?', mecanismo: 'balanza' },
  { texto: '¿Cómo copia un pantógrafo un dibujo sin perder sus proporciones?', mecanismo: 'pantografo' },
  { texto: '¿Qué sucede cuando muevo la manivela?', mecanismo: 'manivela' },
  { texto: '¿Cómo se convierte un giro en un movimiento de ida y vuelta?', mecanismo: 'biela' },
  { texto: 'Si le damos un giro a la manivela… ¿qué sucede en el sistema?', mecanismo: 'dos-ruedas' },
  { texto: '¿Cuántas vueltas da la rueda grande y cuántas la pequeña?', mecanismo: 'dos-ruedas' },
  { texto: '¿Qué pasa si le quitas la llanta a tu cuenta historias?', mecanismo: 'cuenta-historias' },
  { texto: '¿Por qué el mecanismo de arriba gira también?', mecanismo: 'cuenta-historias' },
  { texto: '¿Cómo se transmite el movimiento de una rueda a muchas otras?', mecanismo: 'bailarinas' },
  { texto: '¿Cuál es el propósito de un diseño? ¿Cuál es su estructura?', mecanismo: null },
];
