# Guía de pruebas completa — Cliente y Recepcionista

Checklist para verificar TODOS los casos de uso del sistema, uno por uno.
Preparada el 18/11 tras la ronda de mejoras (wizard reorganizado, lab web,
campana/sonido, encuesta, cambio de horario).

## 0. Preparación (5 min, cada sesión)

| # | Paso | ✓ |
|---|---|---|
| 0.1 | Docker Desktop corriendo (si la PC se suspendió y no salen mensajes: `npm run evo:prod-up`) | ☐ |
| 0.2 | Celular de PRUEBA del dueño a mano (recibe los WhatsApp de cliente) | ☐ |
| 0.3 | Abrir https://agenda-ariels-nu.vercel.app en el CELULAR (rol cliente) y /internal en la PC (rol recepcionista) | ☐ |
| 0.4 | Sesión iniciada en /internal (la campana 🔔 debe verse en el navbar) | ☐ |

> 💡 **Tip**: deja el /internal abierto y minimizado TODO el tiempo de las
> pruebas — así pruebas también la campana y el sonido a cada reserva nueva.

---

## A. CLIENTE — Grooming (VA-XXXXX)

| # | Caso de uso | Resultado esperado | ✓ |
|---|---|---|---|
| A1 | `/` desde el celular → Bienvenida primera vez (intro + sede) | Intro explica qué guarda el navegador | ☐ |
| A2 | Elegir sede + mascota + datos → fecha → confirmar | Pantalla verde con código VA-XXXXX + WhatsApp recibido | ☐ |
| A3 | Tocar el link de /estado que viene en el WhatsApp | Abre `/estado?code=VA-…` SIN escribir nada, muestra "Pendiente" | ☐ |
| A4 | Botón "copiar enlace" en /estado y compartirlo | El enlace copiado abre el mismo estado | ☐ |
| A5 | Volver a `/` (2ª visita): saluda con las mascotas guardadas y pide solo fecha | Reserva rápida sin rellenar datos | ☐ |
| A6 | (Panel) Cancelar una reserva desde /internal | Cliente: /estado muestra "Cancelada"; el counter ve badge si el WhatsApp falló | ☐ |

## B. CLIENTE — Cita médica General (CM-XXXXX)

| # | Caso de uso | Resultado esperado | ✓ |
|---|---|---|---|
| B1 | `/cita-medica` → sede → **Consulta General** → doctor → día → hora | El Resumen muestra "Servicio: Consulta General" (hotfix 18/11) | ☐ |
| B2 | Datos → Confirmar | WhatsApp al cliente con link `/estado?code=CM-…` → /estado muestra "Confirmada" | ☐ |
| B3 | Repetir B1 eligiendo día de LA PRÓXIMA semana | Sale "Semana por confirmar · se publica cada lunes" y va como solicitud (sin hora) | ☐ |
| B4 | Dos personas eligen la MISMA hora (o tú dos veces rápido) | La segunda ve aviso amigable "ese horario ya no está disponible" (409) | ☐ |

## C. CLIENTE — Rayos X y Ecografía (orden)

| # | Caso de uso | Resultado esperado | ✓ |
|---|---|---|---|
| C1 | `/cita-medica` → **Rayos X y Ecografía** → ver precios "Desde S/ X" (si están en ⚙ Config) | Precios visibles + "¿Dudas? Escríbenos" | ☐ |
| C2 | Elegir Radiografía → "Sí, tengo orden" → subir FOTO de una orden | Vista previa de la foto → Continuar | ☐ |
| C3 | Datos → Confirmar | Código CM- + WhatsApp "recibimos tu orden, te escribimos para confirmar fecha/hora/costo" | ☐ |
| C4 | Repetir con "No tengo orden" | Guía clara: "primero consulta general" con botón directo al flujo | ☐ |

## D. CLIENTE — Laboratorio (LAB-XXXXX)

| # | Caso de uso | Resultado esperado | ✓ |
|---|---|---|---|
| D1 | `/cita-medica` → **Exámenes de Laboratorio** → "Sí, tengo orden" → foto → escribir el examen → datos | Código LAB-XXXXX + WhatsApp con "toma de muestra S/ 25" y link `/estado?code=LAB-…` | ☐ |
| D2 | El link de /estado | Muestra "📄 Solicitada" (la muestra aún no se toma) | ☐ |
| D3 | "No tengo orden" | Mismo carril de consulta general primero | ☐ |

## E. CLIENTE — Especializada (interconsulta)

| # | Caso de uso | Resultado esperado | ✓ |
|---|---|---|---|
| E1 | Tile → especialidad (ej. Cardiología) → datos | WhatsApp con **métodos de pago** (se configuran en ⚙) — sin fecha todavía | ☐ |
| E2 | (Panel) Counter verifica pago → asigna doctor/fecha/hora | Cliente recibe WhatsApp de confirmación con fecha y doctor | ☐ |

---

## F. RECEPCIONISTA — Panel Grooming

| # | Caso de uso | Resultado esperado | ✓ |
|---|---|---|---|
| F1 | Campana 🔔 al llegar la reserva de A2 (panel minimizado) | Suena el "tin" + badge naranja; clic → va a Grooming | ☐ |
| F2 | Reserva de A2 en la franja → expandir → **N° de baño** por mascota (ej. 20) → Guardar | "visible en /estado" y /estado (A3) muestra "N° 20" | ☐ |
| F3 | Chips por mascota: recibido → en baño → secado → corte → listo | Multi-mascota: chip naranja activo + ✓ azules en pasadas; al llegar TODAS a listo → ÚNICO WhatsApp final "listo" | ☐ |
| F4 | Marcar "En camino de recojo" / "Listo" (botones azules) | WhatsApps correspondientes al cliente | ☐ |
| F5 | Imprimir boleta (QZ Tray en la PC del mostrador; si no, diálogo del navegador) | Boleta 80mm | ☐ |
| F6 | Reagendar / cancelar 1 clic | Cliente avisado por WhatsApp (o badge ⚠ si falló) | ☐ |

## G. RECEPCIONISTA — Panel Consultas

| # | Caso de uso | Resultado esperado | ✓ |
|---|---|---|---|
| G1 | Confirmar la solicitud de B3 (banda "Citas por confirmación") | Cliente recibe WhatsApp con fecha/hora/doctor | ☐ |
| G2 | En la cita confirmada: **🕐 Cambiar horario** (nueva fecha/doctor) | WhatsApp "❌ Antes → ✅ Nueva cita" al cliente; historial "🕐 Reprogramada"; se puede repetir | ☐ |
| G3 | "🏥 Entró" → "🏁 Atendida" | WhatsApp de **encuesta** (1-5, ¿nos recomendaría?, ¿mejorar?) + link de Google si está en ⚙ | ☐ |
| G4 | Orden de rayos/eco de C2 en la banda: chip "✅ Orden subida" → **📄 Ver orden** | Abre la foto firmada (solo staff) | ☐ |
| G5 | Fijar horario de esa orden → tarjeta verde 💬 | Texto con fecha/doctor y "S/ ______" para editar el costo | ☐ |
| G6 | Si un aviso falla (badge ⚠ WhatsApp) | Botón 🔁 Reenviar lo manda con el estado actual | ☐ |

## H. RECEPCIONISTA — Panel Laboratorio

| # | Caso de uso | Resultado esperado | ✓ |
|---|---|---|---|
| H1 | Banda "📥 Exámenes por confirmar" con la orden de D1 | Chip "✅ Orden subida" + **📄 Ver orden** abre la foto | ☐ |
| H2 | **Fijar fecha de toma** (sin hora) + Guardar | Chip "📅 Toma: dd/mm" en la fila y la card | ☐ |
| H3 | 💬 Coordinar | Texto con fecha + S/ 25 listo para editar → enviar | ☐ |
| H4 | Cliente llega y toma la muestra → **🩸 Muestra tomada** | Orden pasa a "📥 Muestra recibida"; /estado del cliente se actualiza solo | ☐ |
| H5 | **🔬 Enviar al laboratorio** (elige lab del catálogo; puedes agregar uno nuevo con ➕) | Estado "En laboratorio" | ☐ |
| H6 | Resultado en PDF → **✅ Resultado listo** + subir PDF | Cliente recibe WhatsApp con enlace PRIVADO de descarga (20 días) | ☐ |
| H7 | Cliente descarga en /estado; luego **📋 Entregada** | Flujo cerrado; el resultado se purga solo a los 20 días | ☐ |

## I. RECEPCIONISTA — Config y generalidades

| # | Caso de uso | Resultado esperado | ✓ |
|---|---|---|---|
| I1 | ⚙ Config: costos de rayos/eco → guardar → C1 muestra "Desde S/ X" | Visible en el wizard al recargar | ☐ |
| I2 | ⚙ Config: links de Google por sede → luego G3 incluye el link de reseña | Aparece en la encuesta | ☐ |
| I3 | ⚙ Config → Doctores/Horarios: baja/alta de doctor | La web refleja doctores activos por sede | ☐ |
| I4 | 📚 Historial: buscar un código → "abrir en su pestaña" | Salta a Grooming/Consultas/Lab con la búsqueda hecha | ☐ |
| I5 | Campana 🔔 desglose: clic en "Consultas por confirmar" | Navega a esa pestaña | ☐ |
| I6 | Cerrar sesión y volver a entrar (login nuevo) | Login 2 columnas con mascotas; sesión funciona | ☐ |

---

## Riesgos conocidos (NO son bugs)

- **PC suspendida/apagada** → el túnel ngrok muere y los WhatsApp se van en
  "ámbar honesto". Fix: `npm run evo:prod-up`. Definitivo: VPS (cuando paguen).
- **Doctor sin horarios ese día** → pantalla diseñada (no es error): cambia de
  fecha o de doctor.
- **Reservas/citas viejas sin datos nuevos** (n° de baño, orden, fecha de toma)
  → no muestran nada de lo nuevo: comportamiento intencional.
- **Doble click en confirmar** → dedupe: no genera duplicados (puede que veas
  el mismo código dos veces: es el mismo).
