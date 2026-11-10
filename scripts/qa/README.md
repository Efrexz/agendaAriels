# Scripts de QA visual (Playwright) del panel y wizards

Escritura de capturas para aprobación visual (comité) SIN backend real:
todas las APIs se interceptan (Playwright `route`) y el login del panel se
resuelve con un token de Supabase sembrado en `localStorage` (stub).

## Cómo correrlos

1. `npm run dev` en una terminal (debe estar en el puerto 5173).
2. En otra terminal: `node scripts/qa/<script>.js`
3. Las capturas salen en `/tmp/opencode/` (crear la carpeta si no existe).

## Scripts

| Script | Qué captura |
|---|---|
| `qa-sin-orden.js` | Paso "sin orden médica" del wizard de citas (desktop + móvil) |
| `qa-agenda.js` | Paso agenda (mascota frenchie + panel; con y sin día elegido) |
| `qa-sin-dispo.js` | Estado "doctor sin horarios este día" |
| `qa-enviado-v2.js` | Éxito de citas (2 estados de WhatsApp) + especializada |
| `qa-confirmaciones.js` | Barrido completo: tarjetas ilustradas + éxitos (citas y grooming) |
| `qa-picker-horas.js` | Estados del picker de horas del modal de cita manual (loading/vacío/lleno) |
| `qa-interna.js` | Modales del panel interno (cita manual, lab, dirty-confirm, config) |

Notas:
- Los mocks viven dentro de cada script (edítalos ahí para probar otros estados).
- Las fechas de los mocks pueden quedar viejas: si un día no se puede clickear
  es porque quedó en el pasado — sube el día del filtro `hasText`.
