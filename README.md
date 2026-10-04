# Veterinaria Ariel · Reserva de Grooming

Página web para que los clientes agenden servicios de baño y corte (grooming) para sus mascotas: eligen sede, servicio, fecha y horario, y la reserva llega por WhatsApp a la veterinaria.

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
| `EVOLUTION_API_URL` | URL pública (Tailscale Funnel) de Evolution API |
| `EVOLUTION_API_KEY` | API key de Evolution (header `apikey`) |
| `EVOLUTION_INSTANCE` | Nombre de la instancia/linea WhatsApp que envía |
| `WHATSAPP_DESTINO` | Número WhatsApp que recibe la reserva (la veterinaria) |
| `BACKUP_WEBHOOK_URL` | Opcional. Webhook que registra un respaldo de cada reserva |

> Las `VITE_*` se exponen en el bundle del navegador: jamás pongas secretos privados en ellas.

## Scripts

```bash
npm run dev        # desarrollo
npm run build      # verificación de tipos + build de producción
npm run test       # correr tests (vitest)
npm run lint       # eslint
npm run preview    # previsualizar el build
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
                            │ (opcional) envía respaldo a BACKUP_WEBHOOK_URL
                            ▼
                      POST {EVOLUTION_API_URL}/message/sendText/{EVOLUTION_INSTANCE}
                      con header apikey → WhatsApp de la veterinaria
```

- En `npm run dev`, la reserva va directo al `VITE_N8N_WEBHOOK_URL` si está configurado (flujo de desarrollo con n8n).
- En producción siempre pasa por `/api/booking`, que oculta la configuración del servidor y reintenta hasta 3 veces si la entrega falla.

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
  utils/
    geo.ts                 # distancia haversine entre sede y dirección
    limaTime.ts            # fecha/hora actual en zona America/Lima
```
