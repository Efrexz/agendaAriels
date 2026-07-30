# Vet Grooming App

Wizard multi-paso para reservas de grooming de **Veterinaria Ariel** (3 sedes en Lima: San Martín de Porres, Los Olivos y San Miguel).

## Stack

| Categoría | Tecnología |
|---|---|
| Framework | React 19 con TypeScript |
| Build | Vite (Bundler mode) |
| Estilos | Tailwind CSS 4 |
| Animaciones | Framer Motion |
| Iconos | Lucide React |
| Fechas | date-fns (con locale español) |
| Mapas | @react-google-maps/api (Places Autocomplete + Geocoding) |
| Imágenes | Cloudinary (upload unsigned) |
| Backend | n8n webhook para recepción de reservas |

## Cómo correr

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus claves reales

# 3. Dev server con HMR
npm run dev

# 4. Build de producción
npm run build

# 5. Previsualizar build
npm run preview
```

## Variables de entorno

Creá un archivo `.env.local` en la raíz con estas variables:

| Variable | Descripción |
|---|---|
| `VITE_GOOGLE_MAPS_API_KEY` | API key de Google Maps (Places API + Geocoding habilitados) |
| `VITE_N8N_WEBHOOK_URL` | URL del webhook de n8n que recibe el payload de la reserva |
| `VITE_CLOUDINARY_CLOUD_NAME` | Cloud name de tu cuenta de Cloudinary |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | Upload preset sin firma (unsigned) para Cloudinary |

## Estructura de carpetas

```
src/
├── App.tsx                              # Entrada: monta el wizard
├── main.tsx                             # Punto de montaje React
├── index.css                            # Estilos globales + tema Tailwind
├── components/
│   ├── BookingWizard.tsx                # Orquestador del wizard multi-paso
│   ├── LazyImage.tsx                    # Imagen con lazy loading + skeleton
│   ├── ErrorModal.tsx                   # Modal de errores con animación
│   └── steps/
│       ├── BranchSelectionStep.tsx      # Paso 1: selección de sede
│       ├── ServiceTypeStep.tsx          # Paso 2: perro o gato
│       ├── PetInfoStep.tsx              # Paso 3: servicios, baño, extras, corte, perfume
│       ├── OwnerInfoStep.tsx            # Paso 4: tamaño de la mascota (solo perros)
│       ├── MascotaAgregadaStep.tsx      # Paso 5: resumen de mascota, agregar otra
│       ├── ScheduleStep.tsx             # Paso 6: fecha y horario de recojo
│       ├── ReviewStep.tsx               # Paso 7: datos del cliente + ubicación
│       └── ConfirmationStep.tsx         # Paso 8: resumen final + envío de reserva
├── data/
│   ├── branches.ts                      # Datos de las 3 sedes + util isBranchOpen
│   └── labels.ts                        # Labels centralizados (tipos, servicios, tamaños, etc.)
└── services/
    ├── uploadImage.ts                   # Subida de imágenes a Cloudinary
    └── submitBooking.ts                 # Construcción del payload y envío al webhook n8n
```

## Flujo del wizard

```
[1] Sede → [2] Tipo mascota → [3] Servicios → [4] Tamaño → [5] Mascota Agregada → [6] Fecha/Horario → [7] Tus datos → [8] Resumen
```

**Casos especiales:**

- **Gatos:** se saltea el paso de tamaño (4). Desde servicios (3) va directo a "Mascota Agregada" (5).
- **Agregar otra mascota:** en el paso 5 se puede elegir "Agregar otra mascota" y vuelve al paso 2 con el formulario limpio.
- **Editar mascota:** desde el resumen (8), se puede editar cualquier mascota. Carga los datos en el formulario y permite modificarlos.
- **"¿Tiene historia clínica?":** en el paso 7, si responde "Sí", solo pide DNI, nombre y teléfono registrado. Si "No", pide registrar una historia clínica nueva con fecha de nacimiento, especie, raza y castración.

### Casos a probar manualmente

- Flujo perro: Sede → Perro → Servicios → Tamaño → Agregada → Fecha → Datos → Resumen → Confirmar
- Flujo gato: Sede → Gato → Servicios → Agregada → Fecha → Datos → Resumen → Confirmar
- Agregar otra mascota desde paso 5
- Agregar otra mascota desde paso 8 (resumen)
- Editar mascota desde paso 8
- Eliminar mascota desde paso 8
- Historia clínica: flujo "Sí" y flujo "No"
- Teléfono de movilidad diferente (checkbox en paso 7)
- Back en cada paso (incluyendo cancelar edición)
- Envío exitoso y error de envío (simular con webhook inválido)
- Selección de fecha inválida (días pasados bloqueados)
- Selección de antipulgas con duración 1 mes vs 3 meses

## Cómo se envía la reserva

1. El usuario completa los 8 pasos del wizard.
2. Al confirmar, se llama a `submitBooking(formData)` en `services/submitBooking.ts`.
3. Las imágenes de referencia de corte se suben a Cloudinary (unsigned upload) y se reemplaza el base64 por la URL definitiva.
4. Se construye un payload con `buildBookingPayload(formData)` que formatea todos los campos a labels legibles y fechas en español.
5. El payload se envía como `POST` con `Content-Type: application/json` al webhook de n8n.
6. n8n procesa la reserva y dispara notificaciones por WhatsApp.

## Scripts

```bash
npm run dev       # Dev server en localhost:5173
npm run build     # Compila TypeScript y genera el build en dist/
npm run preview   # Previsualiza el build de producción
npm run lint      # Ejecuta ESLint en todo el proyecto
```

## Convenciones del proyecto

- **TypeScript estricto:** `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`.
- **Estilos:** Tailwind CSS 4 con tema custom (`--font-display`, `--color-brand-blue`, etc.).
- **Animaciones:** framer-motion para transiciones entre pasos (`AnimatePresence`), feedback de errores (shake) y modales.
- **Iconos:** lucide-react exclusivamente.
- **Fechas:** date-fns con `es` locale.
- **Componentes:** un archivo por componente, export nombrado. Paso del wizard = `src/components/steps/*.tsx`.
- **Labels centralizados:** todas las traducciones y labels en `src/data/labels.ts`.
- **Sin clases de utilidad inline** para colores semánticos: usar los tokens definidos en `@theme`.
