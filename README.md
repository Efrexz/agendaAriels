# Veterinaria Ariel · Reserva de Grooming

Página web para que los clientes agenden servicios de baño y corte (grooming) para sus mascotas: eligen sede, servicio, fecha y horario, y la reserva llega por WhatsApp a la veterinaria.

## Stack

- React 19 + TypeScript (strict) + Vite
- Tailwind CSS 4
- React Hook form wizard con `useReducer` + tests con Vitest
- Validación de formularios con Zod
- Google Maps (Places Autocomplete + mapa para dirección de recojo)
- Cloudinary (fotos de referencia del corte)
- Notificación de reservas vía webhook externo (n8n + WhatsApp con Evolution API)

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
| `VITE_N8N_WEBHOOK_URL` | URL del webhook que recibe la reserva |
| `VITE_CLOUDINARY_CLOUD_NAME` | Cloud name de Cloudinary |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | Upload preset (unsigned) de Cloudinary |

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
- En Vercel → Project Settings → Environment Variables, se deben configurar las 4 variables `VITE_*` (`.env.local` local no se sube).
- Después de cambiar variables hay que hacer **redeploy (rebuild completo)**, no solo "Redeploy" de un build existente.
- La key de Google Maps debe estar restringida por HTTP referrer a los dominios de producción en Google Cloud Console.

## Estructura

```
src/
  components/
    BookingWizard.tsx      # orquesta los pasos con useReducer
    ErrorModal.tsx
    steps/                 # un componente por paso del wizard
  state/
    wizardReducer.ts       # máquina de estados del flujo + FormData
    schemas.ts             # validaciones Zod transversales
  data/
    branches.ts            # sedes, horarios y cobertura de recojo
    labels.ts              # diccionarios de textos/servicios
  services/
    submitBooking.ts       # envía la reserva al webhook
    uploadImage.ts         # sube fotos de referencia a Cloudinary
  utils/
    geo.ts                 # distancia haversine entre sede y dirección
```
