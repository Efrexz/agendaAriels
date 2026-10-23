# COSTOS-Y-LIMITES.md — Dónde vive el sistema, cuándo pagar y sin sorpresas

> Guía para el dueño del proyecto (no técnica). Actualizada: 2026-10-22.
> Regla general: **$0 hasta que haya producción comercial** — y para ese día
> la decisión ya está tomada abajo (migrar a Netlify o Vercel Pro).

---

## 1. Dónde vive TODO (mapa del sistema)

```
PC del staff
  └─ Navegador ──▶ Web + panel: VERCEL (serverless, gratis por ahora)
                     ├─ / /cita-medica /estado /internal → páginas React
                     └─ /api/* → 1 función única (api/index.ts)
                          │
                          ├─▶ SUPABASE (gratis) — BD (bookings, medical_*,
                          │     lab_orders…) + Storage privado ("lab-results",
                          │     PDFs/fotos de resultados, se borran a 20 días)
                          │
                          └─▶ EVOLUTION API → WhatsApp
                                (LAPTOP con Docker + Tailscale — $0;
                                 migrará a VPS ~$5/mes cuando se deje la laptop)
```

- **Subidas de resultados**: del navegador del counter → DIRECTO al bucket
  privado de Supabase (con el login del staff). NO pasan por Vercel.
- **El cliente** solo recibe links firmados de 10 min generados por la API.
- **Se limpia solo**: los resultados se borran a los 20 días (cron diario)
  → el storage queda en megas, siempre.

## 2. Límites del plan GRATIS actual (verificados 2026-10-22)

| Recurso | Límite free | Uso típico del sistema | ¿Cabe? |
|---|---|---|---|
| Vercel bandwidth | 100 GB/mes | ~1–2 GB (solo páginas) | ✅ sobra |
| Vercel funciones | 1M invocaciones/mes (tope duro) | ~10–50k | ✅ |
| Vercel crons | **2** | ya se usan ambos (recordatorios + purga lab) | ⚠ al tope — nueva tarea programada → Pro o exterior |
| Supabase BD | 500 MB | kb–MB | ✅ años |
| Supabase Storage | 1 GB | ~60–70 MB "Vivo" (purga 20d) | ✅ |
| Supabase descargas (egress) | 5 GB/mes | ~1 GB con 1.000 descargas | ✅ |
| Supabase proyectos free | 2 activos | 1 (CitasAriels) | ⚠ los free se **PAUSAN tras 7 días sin uso** — reactiva con un clic |
| Netlify free (futuro) | 100 GB, 125k funciones + 1M edge/mes | similar | ✅ |

## 3. TRIGGERS DE PAGO (reglas del negocio — no adivinar, medir)

| Situación | Decisión | Costo |
|---|---|---|
| Demo hoy / uso interno | nada que hacer | **$0** |
| **OK del jefe → producción real** (uso comercial) | **MIGRAR A NETLIFY (free — permite comercial, guía §5)** o pagar Vercel Pro | **$0** o $20/mes |
| Storage de Supabase > 70% o si quieres backups diarios | Supabase Pro | $25/mes |
| Veterinaria #2, #3… | un proyecto free de Netlify por clínica; encima solo si el cliente paga ese nivel | $0 |
| WhatsApp cuando se deje la laptop | VPS (misma carpeta deploy/evolution-server) | ~$5/mes |

Presupuesto realista en plena operación: **$0–45/mes**, con topes (§6).

## 4. Vercel Pro $20 vs Netlify free — comparación honesta

| | Vercel Pro $20 | Netlify free $0 |
|---|---|---|
| Uso comercial | ✅ | ✅ |
| Si te pasas de límites | paga solo el excedente (centavos) | suspende el resto del mes; reactivas al subir de plan |
| Tareas programadas | 40 crons | funciones programadas equivalentes |
| Velocidad de builds / DX | la mejor del mercado | muy buena |
| Dominio propio | 1 gratis el primer año | SSL gratis |

**Camino elegido cuando el jefe dé el OK: Netlify primero.** La migración es
corta porque toda la API vive en UNA función (`api/index.ts`) + un vercel.json
— se traducen pocos archivos. Estimo ½ día con pruebas completas.

## 5. Guía de migración Vercel → Netlify (½ día — hacerla cuando toque)

1. **netlify.toml** (reemplaza a vercel.json):
   ```toml
   [build]
     command = "npm run build"
     publish = "dist"

   [[redirects]]
     from = "/api/*"                 # hoy: rewrites con ?apiPath=$1
     to = "/.netlify/functions/api"  # Netlify entrega la ruta vía evento
     status = 200
     force = true

   [[redirects]] from = "/internal"   to = "/internal.html"  status = 200
   [[redirects]] from = "/estado"     to = "/status.html"    status = 200
   [[redirects]] from = "/cita-medica" to = "/medical.html"  status = 200
   [[redirects]] from = "/*"          to = "/index.html"     status = 200
   ```
2. **Función**: `api/index.ts` → copiar a `netlify/functions/api.mts` con el
   adaptador de handler de Netlify (~20 líneas: recibe `event`, expone
   `status/json/headers` como hoy). Los 20+ handlers internos NO se tocan.
3. **Variables de entorno**: duplicar en Netlify (Site settings → Environment):
   SUPABASE_*, EVOLUTION_*, WHATSAPP_DESTINO, VET_MESSAGE_MODE,
   TRACKING_ENABLED, CRON_SECRET, VITE_SUPABASE_* (build).
4. **Tareas programadas**: recordatorios + purga → funciones scheduled de
   Netlify (cron expr) o disparo manual desde el VPS.
5. **Dominio**: conectar dominio en Netlify (SSL gratis).
6. **Checklist de humo después** (30 min): wizard completo → /estado con VA
   real → /cita-medica → panel 4 pestañas → orden lab con PDF → WhatsApps
   reales → boleta QZ en la PC del counter → prueba manual de los crons.
7. **Rollback**: Vercel queda desplegable y vivo; el cambio es solo de
   dominio/DNS — se puede volver en menos de una hora.

## 6. Alertas anti-sorpresa (hacerlas YA, ~10 min)

- [ ] **Vercel → Team → Settings → Spend Management**: registrar tope de gasto
      (el free no gasta; ya en Pro: avisos al 75% del crédito y resúmenes
      diarios — nunca una factura sorpresa).
- [ ] **Supabase Dashboard → Usage**: revisar 1 vez al mes (2 clics): BD,
      Storage y egress; si Storage se acerca a 700 MB → decidir Supabase Pro
      ANTES del día del problema.
- [ ] No dejar otro proyecto free de Supabase fuera de uso (los free se
      pausan a los 7 días sin actividad).
- [ ] Evolution/laptop: seguir la rutina de PLAN.md §8 (docker compose up -d).
      Si la laptop está apagada la web sigue funcionando; solo el WhatsApp
      sale retrasado — la reserva NO se pierde (queda en la BD).

## 7. Precios de referencia (2026-10, fuentes oficiales)

- Vercel: Hobby $0 · Pro **$20/mes** (incluye $20 de crédito mensual de uso) — vercel.com/docs/plans
- Supabase: Free $0 (500 MB BD · 1 GB storage · 5 GB egress) · Pro **$25/mes** (8 GB BD · 100 GB storage · 250 GB egress + $25 crédito + backups) — supabase.com/pricing
- Netlify: Free $0 **permite uso comercial** (100 GB · 125k invocaciones + 1M edge/mes · 10 GB storage) — netlify.com/pricing
- VPS (DigitalOcean/Hetzner/similar): ~$4–6/mes, la más pequeña es suficiente.

> ⚠️ Los precios cambian: revisar la página oficial ANTES de pagar. La lógica
> de triggers (§3) no depende del precio.
