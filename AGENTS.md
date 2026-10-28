# AGENTS.md — Contexto del proyecto (sustituye a PLAN.md, que vive solo en el historial de git)

Veterinaria Ariel: sistema digital de la veterinaria (antes todo era WhatsApp + cuadernos).
Producción: https://agenda-ariels-nu.vercel.app — grooming `/` · panel `/internal` · tracking `/estado` · citas médicas `/medical`. Local dev: `npm run dev` (5173). Supabase: ref `hflqbiqcpkpdczcvakyy`, RLS deny-all (existe solo la anon key en el cliente; TODO dato via /api con service_role o JWT del staff).

## Stack + reglas no negociables
- React 19 + TS strict + Vite 8 multi-entry (`build.rollupOptions.input`: index/internal/status/medical/preview.html) + Tailwind 4 + framer-motion + vitest + Playwright + lucide-react.
- `America/Lima` SIEMPRE para horas (helpers `src/utils/limaTime`, `api/lib-lima`; nunca toISOString directo para lógica).
- Endpoints públicos: SOLO campos seguros (nunca teléfono, dirección, DNI del dueño).
- API = Vercel serverless en `api/` (service_role solo ahí). Búsqueda de estados/labels centralizada en catálogos: `src/statuses.ts` (grooming), `src/labStatuses.ts`, `src/medicalStatuses.ts` (+ `medStatusMeta` fallback `❔`).
- Gates obligatorios antes de commit: `npm run lint` · `typecheck` (doble: root + api/) · `test` (268 tests) · `build` · `test:e2e` (Playwright 10). QA visual: scripts ad-hoc playwright en /tmp/opencode con APIs interceptadas por `ctx.route`.

## Módulo 1 — Grooming (VA-XXXXX, el original)
- Wizard `/` (src/components/BookingWizard + steps/) → `POST /api/booking`: INSERT en Supabase ANTES de WhatsApp (si falla BD, igual sale por WhatsApp), dedupe por UNIQUE booking_code. SIFALLA el WhatsApp con BD-OK → responde 200 `whatsappDelivered:false` y el wizard muestra "¡Reserva registrada!" ámbar (sin "Reintentar" → cero duplicados; el panel marca ⚠️ WhatsApp con reenvío). Recordatorio automático día-antes: cron 23:00 UTC ya en vercel.json (2° crons gratis de Hobby queda para grooming si se activa).
- Estados: pendiente→en_camino_recojo→recibido→en_bano→en_secado→en_corte→listo→en_camino_entrega→entregado (+cancelado). Cada cambio registra quién/cuándo (`status_updates`).
- WhatsApp al cliente en `en_camino_recojo`/`listo`/`en_camino_entrega` (Evolution API). Panel imprime boleta 80mm (Epson TM-T20II) vía QZ Tray (`src/internal/qz.ts`, builder ESC/POS) con fallback window.print; auto-impresión OFF por defecto (solo reservas nuevas post-apertura).
- Panel marca "Auto", días cerrados por sede/franja (`day_closures`), búsqueda por código/teléfono/nombre.

## Módulo 2 — Citas médicas (CM-XXXXX, `/medical`)
- Wizard: sede→servicio(general/rayos/eco/especializada)→(rayos/eco: pregunta orden sellada)→doctor general o especialidad→agenda→datos→código copiable.
- FLUJO ESPECIALIZADA ("interconsulta"): NO pasa por calendario; `date/doctorId/startMinute = null` y el Resumen jamás muestra doctor/fecha — "La especialista confirma fecha y hora" (los asigna el counter tras verificar el pago en "📥 Pendientes de asignar"). Flujo: solicitud→pagado→asignada→confirmada→en_consulta→atendida (+no_llego).
- `chooseService` limpia el estado del flujo anterior al cambiar de tipo (no heredar doctor/fecha/especialidad).
- Estados/flow: `src/medicalStatuses.ts` (`MED_FLOW_NORMAL`, `MED_FLOW_ESPECIALIZADA`). Cita dura `appt_duration_minutes` (config en panel ⚙).
- Panel: `api/medical/slots.ts` deriva disponibilidad desde horarios de doctor + duración; recordatorios WhatsApp día-antes vía cron Vercel 23:00 UTC (18:00 Lima, `api/medical/_reminders.ts`, CRON_SECRET pendiente de registrar).

## Módulo 3 — Laboratorio (LAB-XXXXX)
- Órdenes cross-sede: `sede_origen` (registró) vs `sede_responsable` (atiende). Estados: recibida→en_laboratorio→resultado_listo→entregada (+cancelado); vencimiento >7 días dispara anillo ámbar.
- Resultado: PDF/JPG subido en panel → cliente lo descarga en `/estado` (URL firmada 10 min, ventana 20 días, purge `api/lab/_purge.ts`); expirado → CTA WhatsApp a la sede.
- Catálogo persistente de labs/exámenes (combobox con ➕ en vivo).

## Panel interno (`/internal`, src/internal/)
- Pestañas: Grooming · Consultas · Laboratorio · Historial · Config. (Horarios médicos viven como sección desplegable dentro de ⚙ Config desde 2026-10-27 — tarea de baja frecuencia).
- Historial (HistoryTab) separa por tipo, rango ≤1 mes, agrupado por día y SALTA a la pestaña destino con el código buscado (prop `jumpSearch`; Consultas/Lab auto-buscan al montar).
- Cards acordeón accesibles (role=button, aria-expanded, Enter/Espacio). Creación CTAs = `bg-brand-blue`; verde reservado a semántica de éxito. Acento de pestaña activa: grooming azul / consultas sky / laboratorio naranja. Guardas defensivas `?? []` en todos los fetch (una API malformada no debe tumbar el panel).
- ⚙ Config médica: duración cita, texto métodos de pago, doctores (activate/baja) y especialidades (precio + sedes por botón SPA/LO/SM).
- MINI WHATSAPP (2026-10-27): botón verde junto al teléfono en cards de Consultas/Lab → `wa.me` normalizado `src/internal/waLink.ts` (helper con test) + `MiniWhatsApp.tsx` (mensaje pre-armado con código).
- TOAST de llegadas (`NewArrivalsToast.tsx`): si el panel está abierto y entra reserva/cita/orden creada después (sessionStart/seen por pestaña; en consultas solo Hoy/Mañana), toast azul abajo-derecha "clic para ver" → refresca y oculta 8s. Patrón anti-dismissed (visible = count ∉ dismissed).
- REAGENDAR 1 clic: en cards de Consultas con `no_llego/cancelado` → botón "🔁 Reagendar como nueva cita" abre el modal manual con prefill (dueño/mascota/tipo/sede/notas); el guard dirty compara contra el prefill (no pregunta si no se tocó nada).
- GUÍA "?" (`HelpGuide.tsx`): botón flotante abajo-izquierda → modal con pasos por pestaña en lenguaje de mostrador (onboarding del staff).
- Login pulido al nivel del wizard (pastel + huellitas + botón degradado de marca).

## Sistema visual del wizard médico (≈ 2026-10-26/27, estilo mockup del usuario)
- Card top con degradado azul→naranja. Progreso: completado=azul, ACTIVO=naranja con halo, label "Paso X de 4" naranja.
- Paso servicio: cards horizontales pastel por servicio (`SERVICE_TINT`: general azul, rayos cyan, eco naranja, especializada verde semántico) — foto circular con HALO desplazado detrás + ola grande inferior + rayitas "¡" ancladas al círculo de la foto + pill "📄 Requiere orden" (solo rayos/eco) + badge "El más solicitado" en general (flag `popular`).
- Paso especialidad: cards 2col con icono por palabra clave (`ESPECIALIDAD_REGEX_ICONS`, fallback birrete) + collage de 4 especialidades a la derecha (`especializada.webp`, RGB enmarcado con `EspecialidadCollage`). Paso doctor/orden: 2 col con mascota webp. Mascotas: webp en `public/images/vetMascot/` (listo=spaListo, entregado=entregado "Gracias por su preferencia", recogida/entrega comparten camino.webp; resultadoListo con alpha real). Pendientes de arte: LAB entregada (usa DogAndCatFamilia genérica), pago.webp duplicado de copy.webp, fotos reales de doctores en `public/images/doctores/` (no existe; cards muestran estetoscopio fallback).
- /estado: tracking con tinte por estado (`STATUS_TINT` en src/status/mascots.ts), métricas en fila 3-col, skeleton, card de error con mascota + CTA WhatsApp, botón copiar-enlace, document.title dinámico.

## Comité de estilos (el usuario confirma ideas antes de construir)
Usuarios finales = recepcionistas (panel) y dueños de mascotas. Todo cambio visual del wizard/panel se verifica con capturas antes de commitear; el usuario revisa y el jefe aprueba los cambios estéticos grandes (mockup del paso servicio aprobado). NO versionar maquetas de guía (patrón 83477a6).

## Descartado explícitamente (NO volver a proponer sin preguntar)
Ficha por mascota e historial clínico (usan VetPraxis) · notas internas por cliente · métricas/estadísticas ni export CSV (descartado por el jefe) · foto/video del staff al cliente · foto de referencia y "cómo llegar" en la página del cliente.

## Env vars (Vercel prod+preview+dev)
SUPABASE_URL/ANON/SERVICE_ROLE · TRACKING_ENABLED=true · VET_MESSAGE_MODE (short: activo en Development; falta Production+Preview + redeploy) · EVOLUTION_API_URL/INSTANCE/KEY (WhatsApp) · EVOLUTION_DRY_RUN · WHATSAPP_DESTINO · CRON_SECRET (PENDIENTE registrar) · VITE_SUPABASE_URL/ANON_KEY (panel).

## Deuda conocida (pendiente del usuario, no del código)
1. VET_MESSAGE_MODE=short en Production+Preview (hoy solo Development) + redeploy.
2. CRON_SECRET en Vercel para blindar el cron de recordatorios.
3. QZ Tray física: instalar en PC del mostrador y probar TM-T20II.
4. Cambiar contraseña de vet_ariel@hotmail.com (quedó compartida por chat).
5. Cuentas reales del staff por correo.
6. Grooming: faltan artes recibido/camino/corte (la cascada muestra placeholder DogAndCat).
7. Aún hay `window.confirm` en cancelaciones (documentado para otro ciclo: modal propio + semáforo de citas atrasadas en consultas + fetch por rango de la vista semana).
