# Continuidad veterinaria Ariel — sesión 05/11/2026 (fase V1 del wizard médico)

Estado actual del repo: **todo committeado y desplegado a producción vía push a main** (Vercel auto-deploy).
Producción: https://agenda-ariels-nu.vercel.app · migraciones 01–06 aplicadas en Supabase.

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

## Fases PENDIENTES (en orden)

### V2 — Panel de confirmación (siguiente sesión)
1. Título del box de pendientes: hoy dice "— especializadas" y mezcla flujo de pago con
   solicitudes de próxima semana → renombrar a "📥 Citas por confirmar fecha y hora (N)" con
   chip por fila: `🎓 Especializada · pago pendiente` / `🗓 Semana próxima · sin hora`.
2. Botón del flujo general corregir copia: "Asignar y pasar a 'asignada'" → "✅ Confirmar
   horario y avisar al cliente" (el backend ya confirma con WhatsApp).
3. Hora manual del counter (Archivo `src/internal/ConsultasTab.tsx`, PendingRow):
   reemplazar el input time suelto por chips cada 15 min dentro del horario real del doctor
   + desplegable pequeño "⏱ Otra hora (excepcional)". El usuario lo pidió explícitamente.

### M1 — Honestidad de WhatsApp en citas (después de V2)
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
