# Continuidad veterinaria Ariel — sesión 05/11/2026 (fase V1 del wizard médico)

Estado actual del repo: **todo committeado y desplegado a producción vía push a main** (Vercel auto-deploy).
Producción: https://agenda-ariels-nu.vercel.app · migraciones 01–06 aplicadas en Supabase.

## Cierre 05/11 (tarde) — M1 + WhatsApp de producción funcionando de VERDAD
- **M1 honestidad WhatsApp: completo y probado en producción real**. El dueño creó una cita y llegó el mensaje desde su línea; commits: `d488beb` (backend flags + marcas + endpoint resend-notice + wizard honesto + panel ⚠/reenviar), `1e665d2` (fix candado go() que atascaba wizard con navegación rápida — esa era la flake E2E), `938f034` (badge actualiza al instante en búsqueda).
- **Fase W temporal**: esta PC ES el servidor WhatsApp de producción vía ngrok (dominio reservado `shorter-disjoin-habitant.ngrok-free.dev`) — rutina automática al encender el PC + manual `npm run evo:prod-up|down`. **TODOS los detalles y diagnóstico en `AGENTS.md` (sección "WhatsApp de producción TEMPORAL")**. Key API local rotada (`.env` EVUL_API_KEY). `VET_MESSAGE_MODE=short` ya en Production. Cuando paguen: VPS mismo compose + cambiar solo API_URL/INSTANCE en Vercel.
- Pruebas hechas con datos reales: wizard producción entrega ✓ · QA reenvío (CM-WL5FX) entrega ✓ badge se apaga ✓ · demo instancia conectada al teléfono del dueño ✓.

## Siguiente fase PENDIENTE: G1 — estado por mascota (MAQUETA PRIMERO, comité)

## Qué hacer en un NUEVO CHAT

1. Leer `AGENTS.md` + `HANDOFF-AUDITORIA.md` + este archivo (los dos primeros son la base; este da el punto exacto).
2. Verificar `git status --short` limpio y `git log --oneline -3` con estos commits visibles.

## Últimas 3 fases completas (contexto)

- **M2B (desplegado):** solicitudes de PRÓXIMA semana sin hora en citas médicas.
  Front: banda "Semana por confirmar" dentro del panel de horas (estilo V1), CTA gradiente,
  helper `requestedNextWeek()` al final de `src/medical/App.tsx`; slots se limpian al cambiar
  de día (bug stale corregido). Backend: ventana semanal (`weekWindow` en `api/medical/slots.ts`),
  branch de solicitud en `_create.ts` (`buildNextWeekRequestMessage`, flag `requested`),
  `_assign.ts` confirma → `confirmada` + WhatsApp al cliente, `db.assignAppt` pasa `p_from`
  (estado observado) a la RPC `api_medical_assign` (migración 06 con `p suppliers_from` default 'pagado').
  Panel: "📥 Citas por confirmar fecha y hora" — solicitudes generales con botón
  "🗓 Confirmar horario (avisamos al cliente)" y doctor del cliente preseleccionado.
- **V1 (desplegado):** la banda nueva vive en el panel derecho donde irían las horas,
  estilo del sistema (card blanca ring `#DCEBFF`, chip calendario `bg-[#FFEFD9]`, CTA gradiente).
  Se eliminó el cajón ámbar bajo el calendario.
- **"Volver al inicio de citas"** reinicia el wizard médico (ya no manda a grooming).

## M1 — Honestidad de WhatsApp en citas — ✅ CÓDIGO (05/11/2026) · prueba real pendiente

Qué cambiaron (todo sin migraciones nuevas: las marcas viven en `medical_status_updates`):
- `api/medical/_create.ts`: el resultado de `sendViaEvolution` ya no se descarta → la
  respuesta incluye `whatsappDelivered` (true/false; null solo en dedupe de reenvíos). Si
  Evolution está configurada y falla, registra `wa_fallado` en el historial (best-effort).
- `_status.ts` y `_assign.ts` (confirmaciones del counter): mismas marcas `wa_entregado/
  wa_fallado` server-side (solo con Evolution configurada; el dry-run no marca).
- NUEVO `POST /internal/medical/resend-notice` (`api/medical/_resend_notice.ts`, prefijo _
  → cero funciones serverless extra; ruta en `api/index.ts`): reenvía el aviso con el
  MENSAJE DEL ESTADO ACTUAL (recibo para pendiente / solicitud, confirmación para
  asignada/confirmada, pagos para especializada inicial) y marca en el historial.
- Wizard (`src/medical/App.tsx`): verde solo si `whatsappDelivered === true`; si no, ámbar
  "El aviso por WhatsApp no se pudo enviar — guarda tu código" (especializada: aviso extra
  sobre métodos de pago). Sin reintentar → cero duplicados.
- Panel (`ConsultasTab`): badge rojo **⚠ WhatsApp** en la card (fallado sin entrega
  posterior según timeline) + botón **🔁 Reenviar aviso** (usa el endpoint nuevo; muestra
  resultado); historial con etiquetas humanas (`WA_EVENT_META`: "⚠ Aviso por WhatsApp no
  entregado" / "✓ Aviso por WhatsApp entregado").
- Tests: `api/medical/_create.delivery.test.ts` (5) + `_resend_notice.test.ts` (4) +
  E2E `e2e/medical-wa-pendiente.spec.ts` (wizard ámbar, sin verde). **351 unitarias**,
  **21/21 E2E**, lint, typecheck×2, build. QA visual del panel con badge+reenvío OK.
- PENDIENTE (requiere Docker/Evolution real): prueba de reenvío con teléfono de prueba
  (mismo patrón LAB-T87WZ). El 502 de Evolution PRODUCCIÓN es fase W del usuario (M1 no
  lo revive: solo deja de mentir y da la vía de reenvío).

## Fases PENDIENTES (en orden)

### G1 — Estado por mascota (multi-mascota) — MAQUETA primero
- BD propuesta: `bookings.pet_status jsonb` (clave = índice del array `pets`).
- Panel: chips por mascota en pasos baño/secado/corte/listo; /estado: tarjetitas por mascota
  bajo la cascada general. Maqueta visual aprueba antes de construir (patrón comité).
- NOTA M1: las notas de transición (grooming) registran quién/cuándo; el estado por mascota
  NO debe perder el historial global (`status_updates` sigue como está; pet_status es complemento).
- Contexto: el wizard grooming admite varias mascotas por reserva (demo "3 mascotas"); hoy
  el estatus avanza UNO para todas.

### M2 — (cola previa de fases resueltas 05/11: ver cierre arriba)

### M1 — Honestidad de WhatsApp en citas (CÓDIGO HECHO 05/11; falta prueba real con Docker/Evolution)
- `api/medical/_create.ts`: devolver `notified`/`whatsappDelivered` del `sendViaEvolution`
  (hoy se descarta). Wizard: verde solo si entregó; si no, ámbar "se registró tu cita,
  el aviso por WhatsApp no se pudo enviar — guarda tu código".
- Panel: ⚠ + botón "Reenviar aviso" + endpoint espejo de `api/internal/_resend.ts`.
- MOTIVACIÓN: el usuario lo confirmó en pruebas: Evolution de producción está caída (502) y
  la pantalla verde de "recibo" miente. **Fase W (activar/decidir hosting de la línea de
  WhatsApp de producción) es del USUARIO; se espera suQR/connectionState open.**

### G1 — Estado por mascota (multi-mascota) — MAQUETA primero
- BD propuesta: `bookings.pet_status jsonb` (clave = índice del array `pets`).
- Panel: chips por mascota en pasos baño/secado/corte/listo; /estado: tarjetitas por mascota
  bajo la cascada general. Maqueta visual aprueba antes de construir (patrón comité).

## HOTFIX V1.1 — ✅ APLICADO (04/11/2026, esta sesión)

- `src/medical/App.tsx`: `slotsSeqRef` (patrón `searchSeqRef` del panel) en `loadSlots` y el
  effect de re-consulta; `cancelSlotLoad()` al elegir día de próxima semana. Respuestas en
  vuelo se descartan si cambió la secuencia o la fecha es próxima-semana. `slotsLoading`
  lo limpia solo el fetch más reciente (sin zombie-spinner).
- Spec E2E `e2e/medical-slots-race.spec.ts`: respuesta LENTA 2s + clic rápido → banda sola,
  0 slots pintados. **Control negativo verificado**: con el fix revertido, el spec FALLA.
- Specs médicos reparados (todavía usaban `toSunday+11` = día post-ventana, rotos desde el
  commit del calendario limitado): `proximaSemanaMedica()` en `e2e/fixtures.ts` (jueves de la
  semana próxima, válido cualquier día de hoy, con nav de mes condicional);
  `medical-conflict` ahora hace clic en HOY (siempre habilitado).
- UX dueño en `CalendarCard.tsx`: leyenda dinámica "Agenda abierta hasta el {fecha bonita}" y
  `title` en días >ventana con el motivo (se publica cada lunes). QA visual con capturas OK.
- De paso: lint quedó arreglado (2 errores pre-existentes del commit anterior: constante
  obsoleta `MAX_ADVANCE_DAYS` en `api/medical/_create.ts`, y setState síncrono en effect,
  movido tras frontera async). Gates: lint · typecheck · 342 unitarias · build · 20/20 E2E.

## V2 — ✅ Panel de confirmación (04/11/2026, esta sesión)

En `src/internal/ConsultasTab.tsx` (QA visual con login Supabase stub + APIs interceptadas en
`/tmp/opencode/qa-v2.mjs`; capturas OK):
1. Box renombrado "📥 Citas por confirmar fecha y hora (N)" (ya no "— especializadas") +
   `PendingChip` por fila: `🎓 Especializada · pago pendiente` (ámbar) / `🎓 Especializada ·
   por asignar` (sky) / `🗓 Semana próxima · sin hora` (azul).
2. CTA del modal: "✅ Confirmar horario y avisar al cliente" (el backend ya confirma con WhatsApp).
3. Grid V2 en `PendingRow`: chips cada 15 min DENTRO del horario real del doctor
   (`GET /api/medical/schedules` + weekday de la fecha, duración inferida del paso de slots,
   default 60). Estados: naranja = hora libre sugerida por availability; tachada/lock = otra
   cita ese día (vía `fetchMedDay`); azul = libre en horario. Desplegable "⏱ Otra hora
   (excepcional)" para fuera-de-horario (con aviso ⚠️ al usarlo). Sin horario registrado →
   solo excepcional. El backend sigue validando solapamientos (409 amigable) por si acaso.
- Deuda detectada al aplicar: 2 errores de lint pre-existentes arreglados en el hotfix V1.1.
- PULIDO 05/11 (probado por el dueño): modal inicial ya no muestra el input de hora suelto
  sin fecha (guía "Elige una fecha para ver las horas del doctor" con icono); doctor sin
  horario en esa fecha → nota ámbar que menciona ⚙ Config + "Hora (excepcional)" directo;
  y si la API de horarios falla pero hay slots, siguen las chips simples de slots (antes no
  había vía para elegir horas sugeridas sin bloques). Se decidió MANTENER el date-picker
  nativo (panel sobrio; el CalendarCard de marca es para el wizard del cliente).

## Infra / gotchas aprendidos (NO perder)

- **Vercel Hobby: máximo 12 Serverless Functions** → cualquier archivo nuevo en
  `api/*.ts` SIN prefijo `_` se cuenta como función. Tests nuevos van con prefijo
  `_nombre.test.ts` (ya ocurrió una vez; renombrados).
- `tsc -b` local usa caché incremental: los "gates" pueden pasar con builds viejos;
  en CI siempre es fresco.
- Migraciones aplicadas vía Management API en transacción (no hay `schema_migrations`
  remoto sincronizado); verificar SIEMPRE con query previa + consulta post.
- E2E: puerto 5173 libre antes de correr (matar `vite --port 5173`); correr lint y e2e
  en SECUENCIA; variables `VITE_*` vacías al correr e2e/build.
- QA remotos en Supabase pendientes de limpieza (con OK del dueño): VA-C42S8, CM-TVPKV,
  CM-WL5FX, LAB-T87WZ y la orden CM-WEEK1/CM-QAW1 la dejó el dueño en pruebas.
