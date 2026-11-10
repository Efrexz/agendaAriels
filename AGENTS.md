# AGENTS.md — Veterinaria Ariel (contexto ÚNICO de continuidad)

Veterinaria de 3 sedes en Lima (SPM/LO/SM). Sistema digital de grooming + citas + laboratorio.
Producción: https://agenda-ariels-nu.vercel.app — grooming `/` · panel `/internal` · tracking `/estado` · citas `/medical`. Local: `npm run dev` (5173). Supabase ref `hflqbiqcpkpdczcvakyy`, RLS deny-all (solo anon key en el cliente; TODO dato vía /api con service_role o JWT del staff).
**Este archivo es el ÚNICO documento de continuidad.** (Los HANDOFF viejos se consolidaron aquí y se eliminaron; el histórico vive en Git.) Al empezar: `git status --short` limpio + leer la sección "Estado vivo".

## Stack + reglas no negociables
- React 19 + TS strict + Vite 8 multi-entry (index/internal/status/medical/preview.html) + Tailwind 4 + framer-motion + vitest + Playwright + lucide-react.
- `America/Lima` SIEMPRE para horas (`src/utils/limaTime`, `api/lib-lima`; nunca toISOString para lógica).
- Endpoints públicos: SOLO campos seguros (nunca teléfono/dirección/DNI del dueño ni email del staff).
- API = Vercel catch-all: `api/[...path].ts` enruta todo vía `api/index.ts` (ROUTES). Archivos nuevos en `api/` con prefijo `_` (Vercel Hobby: máx 12 funciones; los `_x` no cuentan). Tests con `_x.test.ts`.
- **Gates antes de commit (en SECUENCIA)**: `npm run lint` · `tsc -b --force` + `tsc -p api/tsconfig.json` · `npm test` · `build` con `VITE_*` vacías · `test:e2e` (21 specs; liberar puerto 5173 antes). QA visual: scripts ad-hoc playwright en `/tmp/opencode` con APIs interceptadas (login stub de Supabase si es el panel). NO commitear maquetas/screenshots.
- Cambios de estructura BD: Management API (SQL en transacción con query PRE y POST de verificación; NO hay `schema_migrations` remoto). No inventar/aplicar migraciones históricas a ciegas.

## Módulos
### Grooming (VA-XXXXX)
- Wizard `/` (BookingWizard + steps/) → `POST /api/booking`: INSERT ANTES de WhatsApp; falla WA con BD ok → 200 `whatsappDelivered:false` y wizard muestra "¡Reserva registrada!" ámbar (cero duplicados); dedupe por UNIQUE booking_code.
- Estados: pendiente→en_camino_recojo→recibido→en_bano→en_secado→en_corte→listo→en_camino_entrega→entregado (+cancelado). WhatsApp al cliente en en_camino_recojo/listo/en_camino_entrega (Evolution).
- **G1 estado por mascota (05/11)**: `bookings.pet_status` jsonb `{"<idx>":{"s":"bano|secado|corte|listo|entregado","by","at"}}`. Endpoint `POST /api/internal/pet-status` (staff; valida índice; registra quién/cuándo; sin historial global extra). **Derivación server-side**: todas las mascotas con fase → el estado general avanza al mínimo (no retrocede; entregado/cancelado no se tocan); todas ≥ listo → general "listo" = **ÚNICO WhatsApp final** (decisión del comité: sin aviso por mascota). Panel: chips por mascota (multi-mascota) con respuesta optimista; fases pasadas azul con ✓; SIN resaltado naranja hasta que exista estado. `/estado`: "Cada mascota, su estado" con tarjetitas (petStatus proyectado SIN datos staff). Reservas viejas sin pet_status: intachables (fallback visual global).
- Boleta 80mm vía QZ Tray (`src/internal/qz.ts`, ESC/POS) con fallback window.print; auto-impresión OFF por defecto.
### Citas médicas (CM-XXXXX)
- Wizard `/medical`: sede→servicio(general/rayos/eco/especializada; rayos/eco preguntan orden sellada)→especialidad/doctor→agenda→datos→copiable.
- **Especializada** (interconsulta): sin calendario, fecha/hora la fija el counter tras verificar pago (`pagado` → asignación → `confirmada` con fecha/hora/doctor **y WhatsApp automático al cliente — incluye especializadas (hueco cerrado 06/11)**; marca wa_entregado). Solapamientos prohibidos en BD (RPC `api_*_transition`/`api_medical_assign`; 409 amigable). Solicitudes de PRÓXIMA semana sin hora → banda de panel "Citas por confirmación" → confirmación de horario envía WhatsApp. Especialistas deben existir por sede: **sin filas kind=especialista el modal del counter falla con mensaje orientativo a ⚙ Config → Doctores**.
- Recordatorios día-antes cron 23:00 UTC (`api/medical/_reminders.ts`, CRON_SECRET).
### Laboratorio (LAB-XXXXX)
- Órdenes cross-sede (origen/responsable): recibida→en_laboratorio→resultado_listo→entregada. Resultado privado: PDF/JPG + token 256-bit (`result_access_hash`), descarga en `/estado` sin cuenta; ventana 20 días + purge (`api/lab/_purge.ts`); reenvío de enlace con endpoint propio. Storage exige staff activo (policy única aplicada).
### Panel interno (`/internal`)
- Tabs: Grooming · Consultas · Laboratorio · Historial · Config (doctores/especialidades/horarios).
- Auto-refresh visible (`useVisibleRefresh` 30s/60s, pausado en búsquedas/modales/peticiones) · toast de llegadas · reagendar 1 clic · guía "?" · MiniWhatsApp.
- **M1 honestidad WhatsApp (05/11)**: cada envío registra su entrega en el historial (`recordWhatsappNotice` → `wa_entregado`/`wa_fallado`). Las cards muestran badge roja **⚠ WhatsApp** cuando un aviso falló sin entrega posterior + botón **🔁 Reenviar aviso** (endpoint propio; usa el mensaje del estado ACTUAL). Wizards: verde SOLO con entrega confirmada; ámbar honesta con el código si falló o no se pudo confirmar.

## Sistema visual (aprobado por el dueño — no rediseñar sin maqueta)
- Estilo pastel del wizard (mockup del dueño): card top degradado azul→naranja; progreso con paso ACTIVO naranja y halo; `SERVICE_TINT` por servicio; mascotas webp en `public/images/vetMascot/`; avatares por especie; verde reservado a semántica de éxito. Cambios visuales: captura + aprobación (comité). Sin rediseños agresivos.

## Estado vivo (REVISAR ANTES DE TOCAR NADA)
- **WhatsApp de producción TEMPORAL vive en ESTA PC** (hasta que paguen → VPS): Vercel Production `EVOLUTION_API_URL = https://shorter-disjoin-habitant.ngrok-free.dev` (dominio reservado del dueño) · `EVOLUTION_API_KEY = EVUL_API_KEY` (en `.env`, no en repo; compose la interpola `${EVUL_API_KEY:?}`) · `EVOLUTION_INSTANCE = ariels-demo` (teléfono de PRUEBA del dueño sirve mientras; línea del negocio después: instancia `ariels-prod` + QR del negocio + cambiar SOLO este env). `EVOLUTION_DRY_RUN` NO existe en Production (envía real). Preview SIN envs de Evolution (a propósito).
- **Rutina de encendido (automática)**: `.bat` en Startup de Windows espera 60s y corre `npm run evo:prod-up` (compose + ngrok con dominio fijo + health-check `"state":"open"`); manual: scripts/evo-prod-up.sh · down: evo:prod-down. **Diagnóstico si "no entregado"**: 1) Docker "Engine running" (más autostart "Start Docker Desktop when you sign in"), 2) `npm run evo:prod-up`, 3) state close → manager `localhost:8080/manager` (KEY global = EVUL_API_KEY) → re-escanear QR. PC apagado = wizard ámbar honesto — NO es bug. VPS futuro: mismo compose; cambian 2 envs.
- **Doctores especialistas FICTICIOS en producción** (06/11, para demo hasta el pago real): 5 especialistas × 3 sedes (Nolasco/Neuro, Uchiyama/Cardio, Ccahuana/Odont, Quiroz/Nutri, Palomino/Trauma) + horarios demo **Lun-Sáb 9-13 y 15-19 (domingo cerrado; regenerable con /tmp/opencode/seed-horarios-completos.mjs)** (emails `.local`, tel 999000000). **Reemplazar por reales pre go-live** (Config ⚙ → baja + alta real; /tmp/opencode/seed-especialistas.mjs para regenerar).
- Cron pendiente de 1.ª prueba en la realtà real con Docker alto (recordatorio 18:00 Lima); sin purgas reales sin consentimiento.
- Citas QA — NO borrar sin acuerdo: VA-C42S8 · CM-TVPKV · CM-WL5FX (reenvío pruebas) · LAB-T87WZ · CM-WEEK1.

## Deuda / cola (nada bloquea la demo a los jefes)
1. Pre go-live: reemplazar doctores ficticios por reales + limpiar citas QA (visto bueno del jefe).
2. Cuentas staff reales (altas `INSERT INTO staff_users SELECT id FROM auth.users WHERE email=...`) + cambiar contraseña expuesta de `vet_ariel@hotmail.com`.
3. QZ Tray física en el PC del mostrador + prueba TM-T20II.
4. VPS cuando paguen (misma rutina) + QR de la línea del negocio. Entretanto, el teléfono del dueño sirve para las demos (los jefes ponen su número como cliente).
5. Ideas apuntadas (maqueta/plan antes de construir): doctores con sede "todas" (evita duplicar al especialista por sede) · búsqueda por teléfono normalizada/paginación (auditoría ítem 9) · actualizar dependencias menores · ESPEJO del calendario grooming: día elegido azul + puntito naranja (el médico ya va así por maqueta 07/11; al grooming darle su mini-maqueta primero).

## Env vars (Vercel) resumen
SUPABASE_URL/ANON/SERVICE_ROLE · VITE_SUPABASE_URL/ANON_KEY · TRACKING_ENABLED=true · VET_MESSAGE_MODE (short en Production) · EVOLUTION_API_URL/INSTANCE/KEY (temporal = esta PC vía ngrok; VER arriba) · EVOLUTION_DRY_RUN (solo dev) · WHATSAPP_DESTINO (número counter) · CRON_SECRET (no rotar sin necesidad) · LAB_RESULT_PUBLIC_ORIGIN opcional. Vercel Hobby: ≤12 funciones + crons gratis.

## Comite de estilos + descartado
- Usuarios finales: recepcionistas + dueño de mascotas. Toda mejora visual: maqueta/captura y confirmación (el jefe aprueba los cambios grandes).
- Descartado NO re-proponer: ficha por mascota/historial clínico (usan VetPraxis) · notas internas · métricas/export CSV · foto/video del staff al cliente · foto de referencia y "cómo llegar" · hora de recogida en /estado (movilidad siempre lleva de vuelta).
