# Veterinaria Ariel · Reserva de Grooming

Página web para que los clientes agenden servicios de baño y corte (grooming) para sus mascotas: eligen sede, servicio, fecha y horario, y la reserva llega por WhatsApp a la veterinaria.

> 📁 Documentos del proyecto: `PLAN.md` (plan y registro de sesiones) · `PLAN-UX.md` (estilos) · `COSTOS-Y-LIMITES.md` (dónde vive el sistema, cuándo pagar Vercel/Supabase y guía de migración a Netlify) · `IDEAS.md`.

## Stack

- React 19 + TypeScript (strict) + Vite
- Tailwind CSS 4
- React Hook form wizard con `useReducer` + tests con Vitest
- Validación de formularios con Zod
- Google Maps (Places Autocomplete + mapa para dirección de recojo)
- Cloudinary (fotos de referencia del corte)
- Notificación de reservas vía WhatsApp (Evolution API, self-hosted) a través de una función serverless (`/api/booking` en Vercel)

## Cómo correr el proyecto

```bash
npm install
npm run dev
```

## Variables de entorno

Copia `.env.example` a `.env.local` y completa los valores:

| Variable | Descripción |
| --- | --- |
| `VITE_GOOGLE_MAPS_API_KEY` | API key de Google Maps con Places habilitado |
| `VITE_CLOUDINARY_CLOUD_NAME` | Cloud name de Cloudinary |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | Upload preset (unsigned) de Cloudinary |
| `VITE_N8N_WEBHOOK_URL` | Opcional. En `npm run dev`, si existe, se envía por este webhook en lugar de `/api/booking` |

Variables privadas de servidor (se configuran en Vercel → Environment Variables, **sin** prefijo `VITE_`; nunca commitear valores reales):

| Variable | Descripción |
| --- | --- |
| `EVOLUTION_API_URL` | URL pública (Tailscale Funnel o VPS) de Evolution API |
| `EVOLUTION_API_KEY` | API key de Evolution (header `apikey`) |
| `EVOLUTION_INSTANCE` | Nombre de la instancia/linea WhatsApp que envía |
| `WHATSAPP_DESTINO` | Número WhatsApp que recibe la reserva (la veterinaria) |
| `EVOLUTION_DRY_RUN` | `"true"`: imprime los mensajes por consola sin enviarlos (modo prueba) |
| `CLIENT_COPY_ENABLED` | `"false"`: no envía comprobante al cliente (default: activado) |
| `BACKUP_WEBHOOK_URL` | Opcional. Webhook que registra un respaldo de cada reserva |

> Las `VITE_*` se exponen en el bundle del navegador: jamás pongas secretos privados en ellas.

## Scripts

```bash
npm run dev        # desarrollo
npm run build      # verificación de tipos + build de producción
npm run test       # correr tests (vitest)
npm run test:e2e   # correr tests e2e (Playwright, Chromium)
npm run lint       # eslint
npm run preview    # previsualizar el build

# Demo local de WhatsApp (Evolution API en Docker, ver sección "Demo local")
npm run demo:up && npm run demo:down && npm run demo:logs
# Regenerar la imagen para compartir el link (og:image)
npm run generate:og
```

## Deploy

- Deploy en Vercel.
- En Vercel → Project Settings → Environment Variables, se configuran las variables `VITE_*` (públicas) y las privadas de servidor (ver tablas arriba). `.env.local` local no se sube.
- Después de cambiar variables hay que hacer **redeploy (rebuild completo)**, no solo "Redeploy" de un build existente.
- La key de Google Maps debe estar restringida por HTTP referrer a los dominios de producción en Google Cloud Console.

## Flujo de una reserva

```
Wizard (React) ──POST──> /api/booking (Vercel Function)
                            │ valida payload con Zod (server-side)
                            │ valida sede, radio de cobertura y ventana de agenda
                            │ dedupe: misma reserva (teléfono+fecha+franja) en 60s → mismo código
                            │ (opcional) envía respaldo a BACKUP_WEBHOOK_URL
                            ├→ WhatsApp de la veterinaria (NUEVA RESERVA + ubicación)
                            └→ WhatsApp del CLIENTE (comprobante: fecha, sede, mascotas y código)
```

- En `npm run dev`, la reserva va directo al `VITE_N8N_WEBHOOK_URL` si está configurado (flujo de desarrollo con n8n).
- El comprobante al cliente es "best effort": si falla el envío, la reserva sigue confirmada (solo se registra en logs). Se desactiva con `CLIENT_COPY_ENABLED=false`.
- `EVOLUTION_DRY_RUN=true` imprime los mensajes (clínica y cliente) en los logs del servidor sin enviar WhatsApp: ideal para probar la plantilla sin tener una instancia conectada.
- En producción siempre pasa por `/api/booking`, que oculta la configuración del servidor y reintenta hasta 3 veces si la entrega falla.

## Demo local (WhatsApp desde tu PC, para pruebas/demos)

Corre Evolution API en Docker **solo en tu máquina** (no se publica a internet) para
probar los mensajes reales — clínicos y el comprobante al cliente — mientras el
proyecto está en desarrollo o se muestra como demo. NO interfiere con la instancia
de producción que usa otro proyecto.

**1. Levantar el stack** (requiere Docker encendido):

```bash
npm run demo:up       # Evolution API en http://localhost:8080 + Postgres + Redis
```

**2. Crear la instancia de demo y conectar un WhatsApp:**

Opción UI: abre el manager en `http://localhost:8080/manager`
(API Base URL: `http://localhost:8080`, Global API key: `ariels-demo-key`) → **Create Instance** → nombre `ariels-demo` → conecta escaneando el QR con el celular.

Opción CLI:

```bash
curl -X POST http://localhost:8080/instance/create \
  -H "Content-Type: application/json" \
  -H "apikey: ariels-demo-key" \
  -d '{"instanceName": "ariels-demo", "qrcode": true}'
# Imprime un QR/pairing code: vincula el celular allí
```

> Conecta un número de PRUEBA (ej. tu WhatsApp personal), no el número real de la
> veterinaria: un número no puede estar conectado en dos instancias a la vez.

**3. Variables para el modo demo** (en `.env.local`, comentar/dejar vacía `VITE_N8N_WEBHOOK_URL`
para que `/api/booking` reciba la reserva):

```bash
EVOLUTION_API_URL=http://127.0.0.1:8080
EVOLUTION_API_KEY=ariels-demo-key
EVOLUTION_INSTANCE=ariels-demo
WHATSAPP_DESTINO=51XXXXXXXXX   # número que recibe la "reserva de la clínica"
```

**4. Correr la función local:**

```bash
npx vercel link   # una sola vez
npx vercel dev    # sirve la app + /api/booking en localhost
```

En la reserva escribe como "teléfono del cliente" un número distinto al de la línea
demo (ej. de un familiar) → la clínica recibe la reserva y el cliente el comprobante.

**5. Logs y apagar:**

```bash
npm run demo:logs    # ver los envíos en vivo (incluye EVOLUTION_DRY_RUN si está activo)
npm run demo:down    # detener (los datos se conservan en volúmenes)
```

Cuando se compre el VPS, este mismo compose se reutiliza casi igual — ver `IDEAS.md`.

## Estructura

```
api/
  booking.ts               # serverless de Vercel: rate limit + orquestador compartido
src/
  components/
    BookingWizard.tsx      # orquesta los pasos con useReducer
    ErrorModal.tsx
    ErrorBoundary.tsx
    steps/                 # un componente por paso del wizard
  lib/
    bookingApi.ts          # contrato del envío: esquema Zod, plantilla WhatsApp, entrega (compartido con api/)
  state/
    wizardReducer.ts       # máquina de estados del flujo + FormData
    schemas.ts             # validaciones Zod transversales
  data/
    branches.ts            # sedes, horarios y cobertura de recojo
    labels.ts              # diccionarios de textos/servicios
  services/
    submitBooking.ts       # envía la reserva a /api/booking (o al webhook en dev)
    uploadImage.ts         # comprime y sube fotos de referencia a Cloudinary
    clientProfile.ts       # perfil del cliente guardado en localStorage (localStorage)
  e2e/
    welcome-*.spec.ts      # Playwright: bienvenida primera vez / recurrente
    full-booking.spec.ts   # flujo completo con /api/booking interceptado
  utils/
    geo.ts                 # distancia haversine entre sede y dirección
    limaTime.ts            # fecha/hora actual en zona America/Lima
```
