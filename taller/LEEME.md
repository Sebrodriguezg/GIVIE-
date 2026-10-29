# Taller virtual ATA EPE

Un simulador físico del kit ATA EPE construido desde cero (álgebra geométrica proyectiva, mecánica analítica,
programación) y, a la vez, un curso para aprenderlo.

## Por dónde empezar

1. `estudio/guia_del_taller.pdf`: cómo se trabaja (leer → hacer → responder → discretizar → implementar → subir).
2. `plan/plan_taller.pdf`: el modelo físico completo, los módulos y la bibliografía.
3. `estudio/ficha00_pga.pdf`: el primer módulo. Después, las fichas 01 a 08 en orden.

## Pruebas

Desde esta carpeta:

    node --test "pruebas/*.test.js"

## Estado

| Módulo | Ficha | Estado |
|---|---|---|
| 0. Álgebra (PGA) | ficha00_pga | contrato listo: implementar `nucleo/pga.js` |
| 1. Cinemática | ficha01_cinematica | ficha lista |
| 2. Dinámica | ficha02_dinamica | ficha lista |
| 3. Mecánica analítica I | ficha03_analitica_i | ficha lista |
| 4. Ligaduras | ficha04_ligaduras | ficha lista |
| 5. Contacto | ficha05_contacto | ficha lista |
| 6. Transmisiones | ficha06_transmisiones | ficha lista |
| 7. Mecánica analítica II | ficha07_analitica_ii | ficha lista |
| 8. Compartir | ficha08_compartir | ficha lista |
