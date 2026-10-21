# PLAN.md — Sistema Interno de Grooming + Seguimiento del Cliente

> **¿Estás en un chat nuevo?** Lee este archivo completo antes de tocar código.
> Complementa a `README.md` (cómo corre el proyecto actual) e `IDEAS.md` (ideas futuras).
> Al final de cada sesión de trabajo: marca los checkboxes cumplidos y agrega una
> línea en el **Registro de sesiones** al final. Eso permite continuar sin repetir nada.

---

## 1. Objetivo y contexto

Hoy la app (`index.html`, wizard de reservas) solo envía mensajes de WhatsApp:
**no existe base de datos** — las reservas viven únicamente como chats, y el código
`VA-XXXXX` es informativo (no se puede buscar). Si la PC donde corre Evolution API
se apaga, la reserva se pierde.

El jefe pidió un **sistema de control interno**. Este plan lo construye:

1. **Base de datos real** (Supabase) donde cada reserva queda guardada.
2. **Panel interno** (`/internal`, con login) para el personal: ver el día, gestionar
   estados, buscar por código, imprimir, cerrar días llenos.
3. **Página del cliente** (`/estado`): el cliente entra con su código y ve en tiempo
   real cómo va su mascota (baño, secado, listo…).
4. **WhatsApp automáticos**: a la veterinaria un mensaje corto con el código (antes
   recibía todo el detalle); al cliente avisos clave (movilidad en camino, mascota lista).
5. **Impresión silenciosa** de boletas con QZ Tray en las PCs de la veterinaria.

## 2. Decisiones acordadas (con el usuario)

| Decisión | Elección |
|---|---|
| ¿Mismo repo o proyecto aparte? | **Mismo repo**, segundo/third entry point de Vite (bundles separados, un deploy en Vercel) |
| Base de datos | **Supabase** (tier gratis) + Supabase Auth para el login del panel |
| Impresión | **QZ Tray** (impresión 100% silenciosa). Falta el modelo de la tiquetera |
| Página del cliente | **Solo el código** `VA-XXXXX` para entrar (sin segunda clave); muestra SOLO estados en vivo — **sin foto de referencia, sin mapa, sin dirección/teléfono/DNI** |
| WhatsApp al marcar "Listo" / salida de movilidad | **Sí**, se avisa al cliente por WhatsApp |
| Días llenos | El staff cierra el día (o la franja) desde el panel → en el calendario del wizard el día se ve **rojo "Ocupado"** y no se puede agendar |

### Descartado explícitamente (no volver a proponer sin preguntar)

- **Ficha por mascota** (histórico de visitas): ya usan **VetPraxis**.
- **Notas internas por cliente/mascota**: ya tienen historias clínicas.
- **Métricas/estadísticas y export CSV**: aplazado — el usuario no quiere que el jefe
  vea poco volumen al inicio. Revisar cuando haya adopción.
- **Foto/video del staff al cliente** (idea original del jefe): descartado — con el
  estado en tiempo real basta.
- **Foto de referencia y "cómo llegar" en la página del cliente**: el usuario decidió
  que el cliente no debe ver eso. La foto de referencia **sí se muestra en el panel
  interno** (el staff necesita saber qué corte quiere el cliente).

## 3. Arquitectura

```
index.html (wizard público, EXISTENTE)
  └─ ScheduleStep: días cerrados en rojo "Ocupado" (NUEVO)
        │ POST /api/booking
        ▼
api/booking.ts (Vercel Function, EXISTENTE → MODIFICAR)
  ├─ 1. INSERT en Supabase (service key) ← la reserva queda registrada SIEMPRE
  ├─ 2. WhatsApp CORTO a la veterinaria: código + fecha + sede (nuevo texto)
  └─ 3. Comprobante al cliente + link de seguimiento con su código

internal.html (panel del staff, NUEVO, con login Supabase Auth)
  ├─ Pantalla del día: reservas por sede/franja con estados clickeables
  ├─ Búsqueda por código o teléfono
  ├─ Cerrar/abrir días y franjas (por sede)
  └─ Imprimir con QZ Tray (botón + auto-impresión con toggle)

status.html (página del cliente, NUEVA, pública, solo código)
  └─ Timeline en vivo (polling ~30s): EN CAMINO → RECIBIDO → BAÑO → SECADO
     → CORTE → LISTO → EN CAMINO DE ENTREGA → ENTREGADO

Endpoints NUEVOS (Vercel Functions):
  ├─ GET  /api/status?code=VA-XXXXX   → solo campos seguros (público)
  ├─ GET  /api/availability?sede=...  → días/franjas cerradas (público)
  └─ PATCH /api/internal/status       → cambia estado + dispara WhatsApp (auth)
```

- Estados de reserva: `en_camino_recojo, recibido, en_bano, en_secado, en_corte,
  listo, en_camino_entrega, entregado, cancelado`.
- Cada cambio de estado se registra con hora y usuario (`status_updates`) → ese log
  es el historial del día ("llegó 9:20, baño 9:35…").
- Zona horaria del sistema: `America/Lima` (usar `src/utils/limaTime.ts`).
- El formato del código se mantiene: `VA-XXXXX`, regex `/^VA-[A-Z0-9]{5}$/`.

## 4. Fases y checklist

### Fase 0 — Setup Supabase
- [x] Usuario creó proyecto Supabase `CitasAriels` (org CitasVeterinaria, región Americas, RLS automático activado)
- [x] Token de acceso en `.env.local` como `SUPABASE_ACCESS_TOKEN` (expira en 90 días)
- [x] Instalar Supabase CLI (v2.121.0 vía npm global)
- [x] Vincular el proyecto CLI (`supabase link`, ref: `hflqbiqcpkpdczcvakyy`) y guardar claves en `.env.local`
- [ ] Agregar `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY` a Vercel (en Fase 5, con el deploy)

### Fase 1 — BD + reservas guardadas + mensajes nuevos
- [x] Migraciones SQL: `bookings`, `status_updates`, `day_closures` + RLS (deny por defecto; acceso solo desde funciones serverless con service_role) aplicadas a la nube
- [x] `api/booking.ts`: inserta en BD **antes** de enviar WhatsApp (si falla la BD → flujo por WhatsApp igual; si falla WhatsApp → la reserva queda en BD con `whatsapp_delivered=false`)
- [x] Dedupe robusto: UNIQUE de `booking_code` en BD + idempotencia del insert (quedó también el dedupe en memoria de 60s como capa rápida)
- [x] `api/db.ts`: repositorio server-side (insert, findByCode, isClosed, recordStatus, timelines, cierres)
- [x] Endpoint `/api/status` (público por código; SOLO campos seguros: sin dirección/teléfonos/DNI/foto)
- [x] Endpoint `/api/availability` (público: días/franjas cerradas por sede)
- [x] `/api/internal/*` con JWT del staff: `day.ts`, `search.ts`, `status.ts` (cambia estado + WhatsApp al cliente en `en_camino_recojo`/`listo`/`en_camino_entrega`), `closures.ts` (GET/POST/DELETE)
- [x] Flag `VET_MESSAGE_MODE` (full=actual, short=nuevo) y `TRACKING_ENABLED` para el link de seguimiento — se activan en el deploy (Fase 5)
- [x] Prueba de integración real (scripts/integration.ts `npx tsx --env-file=.env.local scripts/integration.ts`): login staff, 401 sin token, insert/buscar/cambiar estado, cierre/reapertura de día, limpieza — 11/11 OK

### Fase 2 — Panel interno
- [x] `internal.html` como segundo entry point de Vite (bundle separado) + ruta `/internal` (vercel.json)
- [x] Login Supabase Auth (cuentas por persona del staff) — `src/internal/LoginScreen.tsx`
- [x] Pantalla del día por sede/franja con estados clickeables + auto-refresco 30s (`Panel.tsx`)
- [x] Búsqueda por código, teléfono o nombre (`api/internal/search.ts`)
- [x] Cerrar/abrir días y franjas por sede (`ClosuresPanel.tsx` + `api/internal/closures.ts`)
- [x] Guardar quién marcó cada estado (createdBy = correo del staff)
- [x] Boleta imprimible 80mm por reserva (window.print; QZ Tray silencioso en Fase 4)
- [ ] Crear las cuentas reales del staff (pendiente correos del usuario)

### Fase 3 — Página del cliente + calendario
- [x] `status.html` (entry point propio) en `/estado` (vercel.json): input de código → estado actual + proceso paso a paso + timeline con horas; auto-refresco 30s; branding veterinaria
- [x] `src/statuses.ts`: catálogo compartido de estados (panel, cliente y API)
- [x] `ScheduleStep.tsx`: días cerrados en ROJO tachados "Ocupado" por sede; franjas cerradas bloqueadas con etiqueta "Ocupado"; si la fecha elegida se cierra, se deselecciona sola
- [x] Tests unitarios de `closureFor` + e2e Playwright (10/10) con el fetch de disponibilidad

### Fase 4 — Impresión (QZ Tray)
- [x] Modelo de tiquetera confirmado: **Epson TM-T20II** (térmica 80mm, ESC/POS, 48 columnas)
- [x] Librería oficial QZ Tray Connector v2.3.0 incluida en `public/qz-tray.js`
- [x] `src/internal/qz.ts`: builder de boleta ESC/POS (encabezado sede, código destacado, fecha/recojo, cliente, mascotas con indicaciones y extras, corte parcial GS V 66 0, ASCII puro)
- [x] Botón "Imprimir boleta" → QZ Tray si está corriendo; si no, fallback al diálogo del navegador (boleta 80mm via CSS)
- [x] Auto-impresión: con el panel abierto, cada reserva nueva pendiente se imprime sola (interruptor "Auto" en el panel; nunca al abrir para no lanzar históricas)
- [ ] Instalar/pruebas físicas con la impresora real (requiere PCs del mostrador)

### Fase 5 — Cierre
- [x] Tests: unit (vitest) + e2e (Playwright) actualizados
- [x] `npm run lint` y `npm run build` sin errores (+ script nuevo `npm run typecheck` que revisa también `api/`)
- [x] Deploy a Vercel + variables nuevas — **EN PRODUCCIÓN**: https://agenda-ariels-nu.vercel.app
      (wizard `/`, panel `/internal`, seguimiento `/estado`; verificado en vivo 2026-10-20:
      /api/status y /api/availability respondiendo datos reales)
- [x] Variables en Vercel: SUPABASE_* (prod+preview+dev), TRACKING_ENABLED=true (prod+dev),
      EVOLUTION_* demo + VET_MESSAGE_MODE=short (SOLO Development), WHATSAPP/EVOLUTION reales intactos en Production
- [ ] **PENDIENTE post-demo** (cuando el staff ya conozca el panel): registrar `VET_MESSAGE_MODE=short` en Production + Preview + redeploy → activa el WhatsApp corto a la veterinaria
- [ ] Instalación QZ Tray en la PC del trabajo + prueba física TM-T20II
- [ ] Cambiar contraseña de vet_ariel@hotmail.com (quedó por chat)
- [ ] Guía de uso para el staff (cómo entrar, estados, imprimir, cerrar día)

## 5. Pendientes del usuario

1. ~~Modelo de la tiquetera~~ → **Epson TM-T20II** (resuelto). Falta la prueba física con la impresora real.
2. ~~Texto exacto del WhatsApp corto~~ → aprobado (ver plantilla en §6 plantillas). Pendiente solo definir la URL final con el deploy.
3. ~~Cuentas del staff~~ → creada **vet_ariel@hotmail.com** (id 72c89c06...). IMPORTANTE: la contraseña quedó compartida por chat — cambiarla después en Supabase → Authentication → Users. Agregar más cuentas cuando toque.

## 6. Notas técnicas clave (para no redescubrir)

- **Stack actual**: React 19 + TS strict + Vite 8 + Tailwind 4 + Zod + date-fns.
  Deploy en Vercel. WhatsApp vía **Evolution API** self-hosted (ver README).
- **Claves**: `service_role` SOLO en funciones serverless (`api/*.ts`, nunca `VITE_`).
  El navegador del panel usa `anon` key para LOGIN solamente; TODO acceso a datos va
  por `/api/internal/*` con el JWT del staff (los handlers lo verifican con auth admin
  y usan service_role del lado servidor). RLS sin políticas = deny all → ninguna tabla
  es legible desde el navegador aunque la anon key sea pública.
- **Auto-refresco**: panel y página del cliente usan polling (30s) en vez de Realtime
  (más simple, sin depender de RLS para sockets). Revisit si se quiere instantáneo.
- **Entry points multi-página**: configurar `build.rollupOptions.input` en
  `vite.config.ts` con `index.html`, `internal.html`, `status.html`.
- La foto de referencia ya sube a Cloudinary y viaja como URL en el payload → se
  guarda la URL en `bookings` (costo cero), se muestra solo en el panel.
- La cobertura de recojo (radio 2 km, haversine) y la ventana de 14 días se validan
  server-side en `api/booking.ts` — NO tocar esa lógica al modificar.
- `BACKUP_WEBHOOK_URL` (n8n) sigue funcionando como respaldo; no quitarlo.
- Supabase local (Docker) NO está disponible en esta máquina (WSL sin integración
  Docker). Se desarrolla y prueba contra el proyecto en la nube (tier gratis).
- Docker existe en el equipo (Docker Desktop); activar integración WSL si se quiere
  stack local (Supabase / Evolution demo).

### Plantillas WhatsApp aprobadas (Fase 5 las activa con VET_MESSAGE_MODE=short y TRACKING_ENABLED=true)

A la veterinaria (corto):
```
🔔 NUEVA RESERVA
🔖 Código: VA-XXXXX
🏥 {branch_label}
🗓 {date_label}
⏰ {time_range_label}
🐾 N mascota(s): Rocky, Luna
━━━━━━━━━━━━━━━━━━
📋 Ver detalles completos en el panel interno:
[link]
```

Al cliente (comprobante completo, ya existía + link nuevo):
```
🐾 ¡Reserva registrada, {nombre}!
🗓 {date_label} · ⏰ {time_range_label}
🏥 {branch_label}
🐾 Mascota – servicio...
📍 Domicilio: ...
🔖 Código de reserva: VA-XXXXX
🔎 Sigue a tu mascota en tiempo real con tu código:
[origin]/estado
☎ Consultas: {branch_phone}
```

Además: Aviso por WhatsApp en los cambios de estado `en_camino_recojo`, `listo`
y `en_camino_entrega` (api/internal/status.ts). El código de reserva también
queda como link directo en la pantalla de confirmación del wizard.

## 7. MÓDULO MÉDICO — plan acordado (POR CONSTRUIR, en próxima sesión)

> Botón "Agenda una cita médica" de la landing (proyecto Aparte: landing informativa)
> enlazará a `/cita-medica` de ESTA app. Mismo repo, mismo Supabase, mismo panel.

### Decisiones firmes (con el usuario, 2026-10-20)

- **El MISMO panel interno** gana pestañas: "Grooming" (hoy), "Consultas", "Horarios" y "Config". No se crea otra página de gestión.
- Las 3 sedes con personal médico e invariantes horarios propios.
- Doctores/especialidades: **datos FICTICIOS** al inicio (producto de prueba); usuario entrega los reales después.
- El counter actualiza el horario médico cada domingo desde el panel. Editor **visual semanal**: 7 días × franjas, pintar/limpiar con clicks + botón "copiar semana anterior". Sin campos de texto.
- Cita general: 60 min al inicio; duración y citas por doctor/hora **editables desde el panel** (no constantes del código).
- **Precios ejemplo** (ficticios, editables en panel): cardiología 350, odontología 250, nutrición 140, traumatología 180, neurología 150. Algunas especialidades solo atienden San Miguel (la web lo informa). El precio se muestra al elegir la especialidad, no antes.
- Orden médica para rayos/eco: pregunta "¿Tienes orden sellada?" — SÍ → agendar con aviso de presentar orden. NO → misma pantalla ofrece: botón "Agendar consulta general ahora" + botón WhatsApp con la sede. (puede usarse de cualquier clínica; debe estar sellada por un doctor)
- Consulta especializada con **pago anticipado**: ver flujo de estados abajo. General/rayos/eco: sin pago aún (el usuario confirmará con producción más adelante).
- Tolerancia de llegada: 10 min avisada al reservar; counter marca "no llegó" y atender al siguiente en espera. Walk-ins/prioridad: se definirá con el jefe.
- Historias clínicas siguen en **VetPraxis**; este sistema solo gestiona citas/horarios/historial de citas.
- NO habrá página de seguimiento del cliente para consultas (el paciente está presente) — solo código de reserva.
- Counter hoy usa un papelito para recordar citas: este módulo lo reemplaza con recordatorio automático WhatsApp al cliente el día anterior + badge en el panel para counter.

### Flujo de estados de citas (1 clic por paso, guarda quién+cuándo)

```
General/Rayo/Eco:   confirmada → en consultorio → atendida | no_llegó | cancelada
Especializada:      solicitud → pagado (counter valida comprobante enviado al
                    WhatsApp de la sede) → asignada (doctor+fecha/hora por counter)
                    → confirmada → en consultorio → atendida
```

### WhatsApp automáticos del módulo médico
- Solicitud especializada → aviso corto a Counter (igual patrón del grooming).
- Al cliente al solicitar especializada: mensaje con métodos de pago (imágenes ya existentes, vía link + cuentas) + instrucción de enviar comprobante al WhatsApp de la sede.
- Confirmación al cliente cuando counter asigna/Asigna cita.
- Recordatorio automático día antes (cron de Vercel, gratis).

### Piezas técnicas
- BD nueva (mismo Supabase): `doctors`, `doctor_schedules` (+ ausencias por doctor, reutilizando patrón day_closures), `specialties` (costo+sedes), `medical_appointments` (+ notas de pago), `app_config` (duración cita, etc.).
- Wizard `/cita-medica` (entry point nuevo, mismo estilo del wizard grooming).
- Panel: pestañas por área + "＋ Cita manual" + vistas Hoy (default) / Mañana (franja "N citas" fija) / Esta semana / Buscar.
- Códigos de reserva de citas médicas: prefijo **CM-XXXXX** (grooming sigue VA-).
- Belgas por sede: cada usuario con su sede; el panel filtra automático.  (~1h extra, agregar cuando se definan los usuarios reales)

### Fuera de alcance del módulo médico v1
Recibos/facturas, historias clínicas, medicación, múltiples duraciones por servicio, pagos online, salas/consultorios físicos.

### Datos ficticios de ejemplo (REEMPLAZAR cuando el usuario pase los reales)
Doctores (3 por sede), especialidades con precios arriba. Todo editable desde el panel sin tocar código.

## 8. Registro de sesiones

> Formato: `- YYYY-MM-DD — qué se hizo` (agregar al final, nunca borrar).

- 2026-10-19 — Plan completo acordado con el usuario (repositorio, Supabase, QZ Tray,
  página de estados para el cliente, descartes). Creado PLAN.md. Usuario creó proyecto
  Supabase `CitasAriels` y guardó el token en `.env.local`. Siguiente paso: instalar
  CLI y vincular proyecto.
- 2026-10-19 — **Mismo día, segunda sesión**: Fases 0–3 completadas en código.
  Instalado Supabase CLI y vinculado proyecto (ref hflqbiqcpkpdczcvakyy, claves en
  .env.local). Migración inicial aplicada vía Management API (sin DB password:
  `POST /v1/projects/{ref}/database/query` con el access token — NO queda registrada
  en supabase_migrations, aplicar cambios futuros igual). api/db.ts + handleBooking
  guarda en BD antes de WhatsApp. Endpoints /api/status, /api/availability y
  /api/internal/{day,search,status,closures} con JWT de staff. Panel completo
  (internal.html + src/internal/) y página del cliente (status.html + src/status/)
  con rootas /internal y /estado en vercel.json. Días cerrados rojos en ScheduleStep
  (src/services/availability.ts con cache 60s). Boleta 80mm imprimible por
  window.print (QZ Tray pendiente Fase 4). Gates: 172 tests unit, lint, tsc, build y
  10 e2e Playwright — todo verde. Integración real 11/11 (scripts/integration.ts,
  usuarios de prueba eliminados). PENDIENTE FASE 5: VET_MESSAGE_MODE=short +
  TRACKING_ENABLED=true solo tras deploy del panel; variables en Vercel; cuentas
  staff reales; texto corto aprobado por usuario.
- 2026-10-19 — **Tercera parte**: impresión QZ Tray completa para Epson TM-T20II
  (public/qz-tray.js vendored, src/internal/qz.ts con ESC/POS de 48 columnas + corte
  parcial, fallback navegador, interruptor Auto en el panel). Link de seguimiento
  agregado a la pantalla de confirmación del wizard. Creada cuenta staff
  vet_ariel@hotmail.com (cambiar contraseña, quedó por chat). Gates: 175 tests, lint,
  tsc, build y 10 e2e — todo verde. SOLO QUEDA FASE 5 (deploy, variables, cuentas
  extra, guía de uso).
- 2026-10-20 — **Pruebas del usuario en local: TODO OK** (reserva real VA-NYKU0 de
  Manolo/Los Olivos quedó en BD no obstante un 500 inicial por Evolution no configurada
  en el entorno Development de Vercel — resuelto: vercel dev carga env del proyecto
  REMOTO no .env.local; se registraron SUPABASE_* en prod+preview+dev y EVOLUTION_*_
  demo + VET_MESSAGE_MODE=short + TRACKING_ENABLED=true SOLO en Development). Still
  pendiente solo Fase 5 de grooming (deploy prod). Usuario confirmó Epson TM-T20II y
  probó todo el checklist local.
- 2026-10-20 — **Plan MÓDULO MÉDICO acordado** (sección 7 de este archivo): mismo
  panel con pestañas, horarios editable por counter (domingos), especializada con
  pago anticipado, recordatorios día antes, datos ficticios. Ejecución grooming:
  commit + deploy prod + verificación — en curso en esta misma sesión.
- 2026-10-20 — **DEPLOY A PRODUCCIÓN COMPLETADO.** Aprendizajes técnicos que un
  chat nuevo DEBE saber: ① Vercel (nodejs24) NO bundlea api/: transpila archivo por
  archivo → imports relativos internos de api/ EXIGEN extensión ".js"
  (hay vite-plugin `js-to-ts-resolver` para que Vitest los resuelva a .ts — no
  quitarlo); ② Vercel compila api/ con SU tsconfig: se creó api/tsconfig.json
  (moduleResolution bundler, types node, excluye *.test.ts) y script npm "typecheck";
  ③ `vercel dev` (CLI 64) carga NUESTRO .env.local ni para funciones: usa el entorno
  Development del proyecto; ④ los exit codes tras pipes (`| head`) ocultan fallos —
  verificar con redirection a archivo. Producción: agenda-ariels-nu.vercel.app
  (web+panel+estado OK, APIs vivas). Plan médico listo para construir (sección 7).
- 2026-10-20 — **M1 BD MÉDICA aplicada y verificada** (3 migraciones + seed
  ficticio corregido idempotente por doctor): medical_specialties (5 con precios:
  cardiología 350 SM, odontología 250, nutrición 140, traumatología 180,
  neurología 150 SM), medical_doctors (3 generales + 5 especialistas ficticios),
  medical_schedules (generales Lun-Sáb 9-13 y 15-19; especialistas Lun-Vie 9-13),
  medical_time_off, medical_appointments (código CM-XXXXX + constraint de fechas
  corregido: statuses solicitud/pagado pueden NO tener fecha),
  medical_status_updates, app_config (appt_duration_minutes=60 + payment_info
  de ejemplo). RLS deny-all. Seed POR DOCTOR (lección: guards "not exists por
  tabla" en seeds multi-row solo insertaron la primera fila → arreglado en
  migración 3).
- 2026-10-20 — **M2 APIs MÉDICAS completadas** (20+195 tests, lint, tsc doble,
  build — todo verde; integración real 14/14 en scripts/integration-medical.ts):
  públicas: /api/medical/{doctors, specialties, availability, create} (create:
  valida-slot server-side con computeFreeSlots, rechazos 409 solapamiento
  verificado, 400 rayos sin orden, JSON schema zod, código server-side,
  dedupe 60s, rate limit 4/min, alerta counter + msg cliente via Evolution);
  staff: /api/medical/{day (día + "por asignar"), search, status (PATCH:
  'confirmada' notifica al cliente con buildConfirmationMessage), assign
  (exige pagado, valida solapamiento), schedules (GET/POST/DELETE),
  config (GET/PUT whitelist), catalog (GET/POST/PATCH doctores+especialidades)}.
  Lógica pura de slots en api/medical/slots.ts con 13 tests.
  **SIGUIENTE (chat nuevo o este): M3 wizard /cita-medica (medical.html) →
  M4 panel pestañas (Consultas/Horarios/Config) → M5 cron recordatorios.**
- 2026-10-20 — **M3 WIZARD MÉDICO EN PRODUCCIÓN** (agenda-ariels-nu.vercel.app/cita-medica):
  entry point medical.html + src/medical/ (App.tsx full-wizard: sede → servicio →
  orden médica (rayos/eco; sin orden → 2 puertas: agendar general / WhatsApp sede) →
  especialidad con costo → doctor (kind general) → fecha+slots de /api/medical/availability
  → datos → código CM-XXXXX; especializada muestra nota de pago anticipado). Sin
  page del cliente para consultas (se descartó; acordado).
- 2026-10-20 — **ROUTING ÚNICO DE API (aprendizaje clave para chat nuevo)**: el plan
  Hobby de Vercel limita a 12 serverless functions — teníamos 18. Consolidado en UNA
  función `api/index.ts` (router despachando por `${method} ${path}`) +
  vercel.json `{"source":"/api/(.*)","destination":"/api/index?apiPath=$1"}`.
 .Crítico: el catch-all estándar api/[...path].ts SÓLO matchea 1 segmento (bug del
  runtime) — rutas profundas (medical/create) daban 404 de Vercel; con el rewrite +
  query apiPath funciona TODO (verificado local + prod). Handler files: renombrados
  a `_*` (no exponen rutas): api/_booking, _status, _availability + api/internal/_*
  + api/medical/_*. Los renames exigieron arreglar imports (.js) en tests/scripts.
- 2026-10-20 — **M4 PANEL PESTAÑAS COMPLETADO Y DEPLOYADO** (Producción):
  /internal ahora tiene 4 pestañas — 🐕 Grooming (el existente), 🩺 Consultas
  (vistas Hoy/Mañana/Esta semana/Buscar + sección "Pendientes de asignar" para
  especializadas: Verifiqué el pago → Asignar doctor/fecha/hora → Confirmar al
  cliente; cards por doctor con estados: Entró/No llegó/Atendida/Cancelar +
  historial; ＋ Cita manual para telefónicos: crea vía /api/medical/create público),
  🗓 Horarios (editor visual semanal: 7 días × media hora de 8:00 a 21:30; clic
  marca/desmarca bloques por doctor; ⧉ Duplicar horario desde otro doctor),
  ⚙ Config (duración de cita 15-120 min editable + payment_info editable +
  doctores: añadir/desactivar toggle + especialidades: costo inline y
  sedes toggle + añadir). APIs: /api/medical/{day, catalog, schedules, config,
  status, assign} con JWT del staff.
  Lección de lint: en src/internal (mismo archivo), NO llamar desde effects a
  funciones locales que hagan setState síncrono: el plugin rastrea dentro del
  mismo archivo. Usar patrón IIFE dentro del effect (setState tras await).
- 2026-10-20 — **PENDIENTE: M5 recordatorios** → cron diario /api/medical/
  reminders en vercel.json (1 cron gratis en Hobby): consulta citas de mañana
  confirmada → WhatsApp por Evolution al cliente + aviso corto al counter.
  Plantilla de envío copiable de api/medical/_create.ts. Tras M5: guía de
  pruebas del wizard médico en la PC del trabajo + actualizar el botón de la
  landing ("Agenda tu cita médica" → http://agenda-ariels-nu.vercel.app/cita-medica).
- 2026-10-20 — **M5 COMPLETADO Y DEPLOYADO — TODAS LAS FASES M1-M5 LISTAS**:
  api/medical/_reminders.ts (GET /api/medical/reminders vía router; CRON_SECRET
  opcional por header; mañana Lima = dayKey +1 UTC-safe; mensaje al cliente
  hora12 am/pm + tolerancia + orden si rayos/eco; RESUMEN al counter listado
  ordenado por hora) + vercel.json crons: 0 23 * * * (23:00 UTC = 18:00 Lima,
  1 cron de los 2 gratis de Hobby; el 2º queda para grooming si se activa).
  Verificado en integración real con dry-run: sent=1, resumen counter impreso.
  200 tests. Cron usa el router (rewrite apiPath) ✓.
  **PRÓXIMOS PASOS FINALES (pendientes del usuario/pruebas FÍSICAS):**
  1. CRON_SECRET: generar valor y registrar en Vercel (Production) para blindar el cron — PENDIENTE usuario o siguiente sesión (sin él el cron corre abierto; baja riesgo porque solo envía recordatorios, pero meterlo).
  2. Pruebas físicas en la PC del trabajo (wizard médico + pestañas + QZ/TM-T20II).
  3. Botón de la landing "Agenda tu cita médica" → https://agenda-ariels-nu.vercel.app/cita-medica
  4. Cambiar clave vet_ariel@hotmail.com en Supabase → Authentication.
  5. VET_MESSAGE_MODE=short en Production (WhatsApp corto a la veterinaria) cuando staff conozca el panel.
  Usuarios de prueba: staff médico creado/eliminado por scripts.
- 2026-10-20 — **FASE A (fixes producción) COMPLETADO**: registrado VITE_SUPABASE_URL
  + VITE_SUPABASE_ANON_KEY (el CLI nuevo exige --type config/secret explícito para
  nombres VITE_ con valor tipo JWT: "public_prefix_requires_type") + CRON_SECRET
  generado (openssl rand hex 24; en 3 entornos de Vercel + copia en .env.local)
  → REDEPLOY → VERIFICADO: el bundle del panel tiene la URL de Supabase horneada
  (curl al asset). El panel en blanco que el usuario vio en la PC del trabajo era
  ESTO (build sin las VITE_). Ya arreglado; el usuario lo confirma al probar.
- 2026-10-20 — **DECISIÓN SERVIDOR DEMO: LAPTOP del usuario** (ni la PC del
  difusor ni otra PC sin nada instalado): en Vercel/Supabase vive TODO
  (web 24/7 gratis, la PC NO necesita estar prendida); SOLO el envío de WhatsApp
  depende de la máquina corriendo Evolution (laptop para la demo, difusor
  intocado en su PC vieja). QR con NÚMERO PERSONAL solo para demo; cuando den
  el OK, VPS reemplaza la laptop con los MISMOS archivos. Creada
  deploy/evolution-server/: docker-compose.yml (evolution+pg+redis, restart
  unless-stopped, vol persistente de instancias, AUTHENTICATION_API_KEY=
  agenda-demo-key, puerto 8080, nombres agenda_server_* — NO choca con la demo
  del repo raíz) + README-DOCKER.md (guía checklist + troubleshooting).
  **PENDIENTE USUARIO (FASE B, conmigo en vivo):** ① Docker Desktop → Settings
  → Resources → WSL Integration → activar la distro → Apply & Restart;
  ② docker compose up -d en deploy/evolution-server/; ③ manager
  http://localhost:8080/manager (key agenda-demo-key) → crear instancia
  `ariels-agenda` → QR con SU número; ④ instalar Tailscale (Linux distro:
  curl install.sh | sh; sudo tailscale up) + `tailscale funnel 8080` y VERIFICAR
  con curl; ⑤ pasarme la URL https://<laptop>.ts.net → YO registro en Vercel
  (EVOLUTION_API_URL, KEY=agenda-demo-key, INSTANCE=ariels-agenda) + redeploy
  → reserva de prueba real → 2 WhatsApps reales. DEMO día D: laptop con Docker
  abierto + PC del trabajo con navegador; QZ Tray en la PC de la impresora.
- 2026-10-21 — **HITO: SERVIDOR DEMO OPERATIVO + QZ TRAY VERIFICADO FÍSICO.**
  Circuito real completo probado: web producción (Vercel) → túnel Tailscale →
  Evolution en laptop (Docker) → WhatsApp REAL entregado (VA-DEMO1 a 917104426,
  whatsapp_delivered=true en BD). QZ Tray instalado en la PC del trabajo y la
  boleta se imprimió FÍSICAMENTE en la TM-T20II ✓ (el usuario lo confirmó).
  ANTES de esto se arregló: (a) stack down/up en laptop por connection-reset
  tras el reinicio de WSL; (b) funnel --bg (el funnel normal NO persiste:
  "No serve config" al cerrarlo — con --bg queda en la config del servicio);
  (c) los 4 EVOLUTION/*/WHATSAPP_DESTINO de producción RE-REGISTRADOS (el CLI
  exige rm --yes antes de add si la variable ya existe: error
  "already exists... on branch undefined"; usar --type secret). Valores
  producción actuales: EVOLUTION_API_URL=https://laptop-e41ahls0.taila22326.ts.net,
  EVOLUTION_API_KEY=agenda-demo-key, EVOLUTION_INSTANCE=ariels-agenda-2,
  WHATSAPP_DESTINO=51917104426 (número PERSONAL del usuario para demo; cuando
  funcione todo → cambiar al número real de la veterinaria). Development sigue
  en DRY_RUN (demo local con valores dummy). Receipt al cliente se OMITIÓ en
  la prueba porque teléfono cliente = WHATSAPP_DESTINO: el sistema evita doble
  envío al mismo número (diseño correcto; en demo con clientes reales poner
  número real distinto).

  ### ⚡ RUTINA AL ENCEDER LA LAPTOP (solo Docker Desktop; ~2 min)
  1. Abrir Docker Desktop (Windows). Esperar "running".
  2. Los contenedores se levantan SOLOS (unless-stopped) — verificar:
     cd ~/veterinaria/agendaAriels/deploy/evolution-server && docker compose ps
     (3 contenedores "Up" — si no: docker compose up -d)
  3. Verificar WhatsApp desde fuera:
     curl -s -H "apikey: agenda-demo-key" https://laptop-e41ahls0.taila22326.ts.net/instance/connectionState/ariels-agenda-2
     → "state":"open" = LISTO. (si dice disconnected: re-escanear QR en manager)
  4. (Tailscale+funnel: --bg persiste con systemd — si el curl falla:
     sudo tailscale funnel --bg 8081)
  ⚠️ La demo requiere laptop ENCENDIDA y Docker abierto (Solo WhatsApp);
  web/panel/BD/recordatorios corren 24/7 en la nube aunque la laptop esté apagada.

  ### 🖥️ PRUEBAS EN LA PC DEL TRABAJO (checklist sugerido, ~20 min)
  URLs (todas en https://agenda-ariels-nu.vercel.app):
  a) / → reserva grooming completa como cliente (teléfono=SU número;
     luego otra con número de un familiar como "cliente" para ver ambos
     mensajes) → WhatsApp real a la "clínica" + comprobante al cliente con
     link de seguimiento + código VA-XXXXX.
  b) /estado?code=<código> → seguimiento visible.
  c) /internal (login vet_ariel@hotmail.com; CAMBIAR clave pendiente) →
     pestaña 🐕 Grooming: reserva visible → estados clickeables (🛁→💨→✅)
     → "Imprimir boleta" → sale en la TM-T20II (QZ función.Verificado ✓) →
     página del cliente refleja el estado en ~30s.
  d) Búsqueda por teléfono/código en el panel; cerrar un día → calendario rojo.
  e) /cita-medica → wizard médico: sede → servicio (rayos/eco pregunta de
     orden; especializada con costo) → doctor ficticio → fecha/hora →
     código CM-XXXXX + WhatsApps de cita.
  f) Panel pestaña 🩺 Consultas: cita listada; ＋ Cita manual; flujo
     especializada: 💰 Verifiqué el pago → 🩺 Asignar → 📨 Confirmar.
  g) Pestaña 🗓 Horarios: editor semanal (clic marca/desmarca; ⧉ duplicar).
  h) Pestaña ⚙ Config: duración + payment_info + doctores/especialidades.
  i) Cron: 6pm Lima manda recordatorios de citas de MAÑANA (verificar que
     llegó el resumen a 917104426 si hay citas confirmadas de mañana).

  ### 🧹 PENDIENDENTES POST-DEMO (siguiente sesión)
  1. Limpieza de reservas de prueba (VA-DEMO1, CM-* de prueba) — SQL/API.
  2. Cambiar CLAVE de vet_ariel@hotmail.com (queda por chat) + borrar
     todos los datos ficticios → pasar DOCTORES/horarios/precios reales
     desde el panel ⚙ (o script).
  3. WHATSAPP_DESTINO → número REAL de la veterinaria (ahora: personal demo).
  4. VET_MESSAGE_MODE=short en producción cuando el staff conozca el panel.
  5. Botón de la landing "Agenda tu cita médica" → /cita-medica (+ dominio
     propio si quieren: Vercel→Settings→Domains, gratis).
  6. Fase 2 del módulo médico (si jefe pide más): cupos por franja
     automáticos, reportes básicos (post-adoptación), recordatorios de
     grooming (2º cron libre).
  7. A LARGO PLAZO: VPS (~$5/mes) reemplaza la laptop — misma carpeta
     deploy/evolution-server + dominio real + firewall. IDEAS #2.
