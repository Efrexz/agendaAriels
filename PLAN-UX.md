# PLAN-UX.md — Plan de estilos/UX (PRÓXIMA SESIÓN, chat nuevo)

> **¿Estás en un chat nuevo para trabajar estilos?** Lee este archivo COMPLETO y
> el §9 de PLAN.md (pendientes de datos) antes de tocar código.
> Este plan NO toca flujos ni APIs que ya funcionan — es 100% presentación.

---

## 1. Objetivo

Aplicar el sistema visual "Ariel" (el del wizard de grooming, aprobado por el
jefe tras muchas pruebas) a TODAS las superficies, para que:

- El **cliente** sienta que está en la misma veterinaria en todos los flujos
  (grooming → citas médicas → seguimiento) y perciba "página premium".
- El **recepcionista/counter** tenga un panel claro y sin fricción, con el
  branding de la marca pero sin sacrificar densidad de trabajo.

## 2. Design system existente (REUSAR — verificado en código)

| Elemento | Valor / fuente | Dónde está |
|---|---|---|
| Fuente display | **Fredoka** (títulos, redondeada/amigable) | `index.html:7`, `src/index.css` |
| Fuente cuerpo | **Inter** | idem |
| Fuente detalle | **Caveat** (manuscrita, acentos) | idem |
| Brand blue | `#1d4ed8` (token `brand-blue`) | `src/index.css:4-11` (`@theme`) |
| Brand orange | `#f97316` (token `brand-orange`, selección) | idem |
| Superficies | cards blancas `surface-elev`, fondo `#FBF8F4` y página `#F3F6FB` | idem |
| Fondo biombo | `public/background.webp` cover (fixed en ≥lg) | `src/index.css:15-32` |
| Animación | **framer-motion 12**: transiciones de paso `duration:0.4, ease:"easeOut"`, AnimatePresence, respeta `prefers-reduced-motion` (`useReducedMotion`) | `BookingWizard.tsx:2` y steps |
| Forma | cards `rounded-2xl` + `ring-1` + shadow suave; chips/píldoras `rounded-full`; stepper en píldoras con numeración | `src/components/steps/*` |
| El factor "premium" | **mascota virtual** (webp) que celebra cada hito + imagen ilustrativa por decisión (sede, servicio, especie…) | `public/images/vetMascot/`, `servicios/`, `pickUpTime/`, `sedes/`, `petType/`, `petBreed/` |

**Componentes wizard grooming ya probados que sirven de patrón:** Stepper
(`BookingWizard.tsx`), `StepTitle`/`BackButton`/*/callbacks de pasos, cards de
selección con hover lift, pantalla de éxito con mascota (`ConfirmationStep`).

## 3. Estado actual por superficie (auditoría hecha, ~25% del plan)

| Superficie | Qué tiene hoy | GAP de estilos |
|---|---|---|
| `/` grooming | ✅ completo (referencia) | — |
| `/cita-medica` | tokens/fuentes correctos, estructura de pasos propia (`src/medical/App.tsx`: Sede/Servicio/Orden/Especialidad/Doctor/Agenda/Datos/Enviado) | **sin** mascota ni imágenes ilustrativas por paso; pantalla de éxito "plana" |
| `/estado` (cliente) | timeline funcional, branding básico (`src/status/App.tsx`) | **sin** mascota reaccionando por estado (listo→feliz, en camino→paseo…); timeline estático |
| `/internal` panel | Inter solo, sobrio corporativo (`panel.css`) | Pulido suave: header con paw+Fredoka, tabs con iconos ya existen, botones consistentes — NO sobrecargar (es herramienta) |
| Landing (proyecto aparte) | — | solo el botoncito → /cita-medica (pendiente §9 #6) |

## 4. Alcance propuesto por fase (para el chat nuevo)

### Fase UX-A — wizard médico `/cita-medica` (la más visible)
- Portar Stepper/StepTitle/BackButton al estilo grooming (ya comparte tokens).
- Imágenes ilustrativas por paso **usando el pipeline actual** (`public/images/`):
  - `medical/sede/*.webp`, `medical/servicio/{general,rayos,eco,especializada}.webp`
  - mascota en pasos clave: `vetMascot/` reutilizable (agendado/copian/error) + nuevas: `vetMascot/doctor.webp`, `vetMascot/orden.webp`, `vetMascot/pago.webp`, `vetMascot/esperando.webp`
- Pantalla de éxito con mascota "agendado" + código CM grande + link.
- Transición framer-motion idéntica (0.4s easeOut) entre pasos.

### Fase UX-B — `/estado` (segundo momento del cliente)
- Mascota por estado (mapa `status → imagen webp`): aceptación → 'aprobado',
  en_camino → auto/mapa, baño → burbujas, listo → 'aprobado', entregado → 'familia'.
- Timeline visual con iconos + hora (ya hay datos en el JSON público; solo pintar).
- Animación sutil de pulso en el estado ACTUAL (respeta reduced-motion).

### Fase UX-C — panel interno (suave)
- Header con paw + Fredoka como el wizard; colores de estado ya existen.
- (Opcional) ilustración de login con la mascota.

### Fase UX-D — rejillas finales
- Responsive/reduced-motion QA en los 3 flujos + impresión (QZ no se toca).

## 5. Assets que el USUARIO va a conseguir (como en grooming)

Lista de archivos exactos para que encajen sin refactor (webp, fondo
transparente, estilo consistente con `vetMascot/`):

- `public/images/medical/servicio/{general,rayos,eco,especializada}.webp`
- `public/images/medical/sede/{sanMartin,olivos,sanMiguel}Cola.webp` (opcional)
- `public/images/vetMascot/{doctor,orden,pago,esperando,burbujas,camino}.webp`
- El resto se reutiliza del grooming (aprobado/agendado/error/familia…).
- Mientras falten assets: placeholder con el patrón `LazyImage` ya existente
  (`src/components/LazyImage.tsx`) y referencia de 24 usos en el wizard
  grooming: `grep -c webp src/components`.

## 6. Reglas del juego (no negociables)

1. NO cambiar lógica/estado/API — solo presentación (los estados del wizard
   médico y los endpoints ya pasaron 224 tests + pruebas del usuario).
2. REUSAR `src/index.css @theme` y `panel.css` — no duplicar tokens.
3. Animaciones SIEMPRE con `prefers-reduced-motion` respetado (patrón actual).
4. Teléfonos/códigos/datos sensibles: la página /estado sigue SOLO estado (§2 PLAN.md los descartes no cambian).
5. Cada fase termina con: lint + typecheck + build + e2e gestionado (10 + nuevos)
   y screenshot manual del usuario antes de deploy.

## 7. Definición de "listo" (checklist del jefe)

- Un cliente del grooming no nota "otra página" entre wizard grooming vs
  mecánico ni en /estado: misma tipografía, misma mascota, mismas transiciones.
- El recepcionista encuentra cualquier cita en <3 clics.
- 100% de pantallas con mascota en los hitos y transiciones del wizard/estado.
