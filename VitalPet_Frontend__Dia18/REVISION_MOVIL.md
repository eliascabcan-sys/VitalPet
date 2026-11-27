# Revisión móvil: textos que no se leen

Medido con Chromium emulado a 375 y 360 px (flujo del dueño, modo mock).

| Problema | Antes | Después |
|---|---|---|
| Textos < 14 px | 328 | 0 |
| Contraste < 4.5:1 | 394 | 14 (falsos positivos: degradado y foto) |
| Objetivos táctiles < 44 px | 259 | 0 |
| Campos < 16 px (zoom iOS) | 48 | 0 |

## Cambios
- `tokens.css`: variantes accesibles nuevas (`--color-texto-suave`, `--color-primario-fuerte`,
  `--color-acento-fuerte`, `--color-acento-claro`, `--texto-sobre-nav`, `--texto-destacado-sobre-nav`).
  Los colores del contrato no se modificaron. `--nivel-naranja-texto` pasó a `#a44a26`.
- `legibilidad-movil.css` (nuevo, solo <= 640 px): piso 14 px, campos 16 px, objetivos 44 px.
- Colores corregidos en origen: NavBar, botones, chips, triaje, home, FiltroDias.
- 25 `fontSize` inline < 14 px subidos a 14 px en componentes TSX.

## Cómo repetir la medición
1. `npm install && npm run dev:mock -- --port 5199`
2. `pip install playwright && playwright install chromium`
3. `python3 scripts/auditoria-movil.py despues` (crea `./auditoria-salida/`)
   Crea esa carpeta antes de correrlo: `mkdir auditoria-salida`.

## Pendiente de verificar en celular real
Barra inferior sin cortar etiquetas con la fuente Quicksand, ausencia de zoom al tocar campos,
legibilidad a pleno sol.
