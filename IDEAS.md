# IDEAS.md — Mejoras futuras del proyecto (contexto y planes)

Este archivo guarda ideas acordadas para implementar más adelante, con su
contexto, para no tener que recordar la conversación de donde surgieron.

---

## 0. CHECKLIST: prueba real de envío de WhatsApp en mi PC (para demo)

La configuración ya está lista (docker-compose local + código del comprobante
al cliente). Cuando se quiera demostrar que "sí sale el mensaje", seguir los
pasos completos de la sección **"Demo local" del README.md**. Resumen rápido:

- [ ] Docker corriendo (abrir Docker Desktop / asegurar el daemon)
- [ ] `npm run demo:up` → Evolution API en `http://localhost:8080`
- [ ] Crear instancia `ariels-demo` y **escanear QR con mi WhatsApp personal**
      (manager en localhost:8080/manager · API key de demo: `ariels-demo-key`
      — o el comando `curl` que está en el README)
- [ ] `.env.local`: `EVOLUTION_API_URL=http://127.0.0.1:8080`,
      `EVOLUTION_API_KEY=ariels-demo-key`, `EVOLUTION_INSTANCE=ariels-demo`,
      `WHATSAPP_DESTINO` = mi número personal, y **dejar `VITE_N8N_WEBHOOK_URL` vacía**
- [ ] `npx vercel link` (una vez) y luego `npx vercel dev`
- [ ] Hacer una reserva completa; en "teléfono del cliente" usar un número
      **distinto** al de la línea demo (ej. de un familiar)
- [ ] Verificar: mensaje de "NUEVA RESERVA" en el número de clínica +
      comprobante 🐾 en el teléfono "cliente"; `npm run demo:logs` para ver todo
- [ ] Terminar la demo: `npm run demo:down`

Punto crítico del demo: la reserva debe llegar de verdad — si antes se usa el
modo sin WhatsApp, `EVOLUTION_DRY_RUN=true` imprime los mensajes exactos en
los logs (`npm run demo:logs`), útil para ensayar la demo sin QR conectado.

---

## 1. Recordatorio mensual de grooming por WhatsApp

**Idea concreta**: recordatorio *personal* por mascota — "Hola Juan, a Rocky
le toca su baño este mes 🐶 ¿Quieres que repita el mismo servicio?
👉 [link al agendador]" — diferente del difusor actual de promos (masivo, al
azar, por grupos). No lo reemplaza: son complementarios (marketing vs servicio).

**Por qué funciona**: no es spam, es un servicio con datos reales. Y el link
aprovecha el perfil guardado del cliente (mascotas + dirección prellenadas):
la reserva toma ~30 segundos, lo que refuerza el objetivo del proyecto de que
reservar aquí sea más fácil que escribir por WhatsApp.

**Prerequisito (lo único que falta)**: una base de datos de reservas.
Ya existe la cosecha automática: cada `/api/booking` a producción respalda el
payload completo (teléfono, mascotas, fecha, código) a `BACKUP_WEBHOOK_URL`.

**Plan sugerido cuando toque**:

1. **Cosecha → Google Sheet** (n8n):
   - Webhook de n8n apuntando a una Google Sheet ("Reservas"): columnas
     fecha_reserva, nombre, teléfono, mascotas, sede, código, whatsappDelivered.
   - En Vercel configurar la variable `BACKUP_WEBHOOK_URL` con la URL del
     webhook de n8n (producción). Cero código: ya está cableado en el servidor.
2. **Flujo mensual** (n8n cron, ej. día 1 de cada mes 10 am):
   - Read Sheet → filtrar filas cuya última reserva por teléfono tenga más de
     ~25 días (regla por mascota idealmente, sección "Reservas" por mascota).
   - Para cada cliente: Enviar por Evolution API (la misma instancia de la
     veterinaria) un plantilla personalizada: nombre del dueño + mascota +
     servicio anterior + link.
   - Guardar en la Sheet "recordatorio enviado" para no repetir en el mes.
3. **Anti-spam básico**: máximo 1 recordatorio/mes/cliente; respetar a quien
   pida no recibir (columna "opt_out" en la Sheet).

**Costo**: 0 (n8n self-hosted ya existe, la Sheet gratis). Solo configuración
de n8n + una tarde de trabajo.

---

## 2. Migración de Evolution API a un VPS

**Contexto actual**: Evolution API corre en la PC local, expuesta con Tailscale
Funnel, y **dos proyectos comparten la misma instancia/línea** → un fallo de
cualquiera de los dos afecta al otro, y si la PC se apaga, se caen los envíos.

**Por qué migrar**: (a) aislamiento por proyecto: instancia y número separados,
un proyecto que explote no toca al otro; (b) uptime 24/7 sin depender de la PC;
(c) HTTPS directo con dominio propio; (d) mismo docker-compose que la demo local.

**Puntos clave**:

1. Contratar VPS (Hetzner/Contabo/DigitalOcean, ~4–6 USD/mes, Ubuntu 24.04).
2. Docker + Compose: contenedores **Evolution API + Postgres + Redis + Caddy/Nginx**
   (HTTPS con Let's Encrypt). Reutilizar casi tal cual
   `docker-compose.local-demo.yml` (cambiar puertos: publicar 80/443, dominio real).
3. Un **número de WhatsApp por instancia** — un número no puede estar conectado
   en dos instancias a la vez; planificar cuál va a cuál antes de escanear QR.
4. Volumen persistente para las sesiones (`/evolution/instances`) — ojo al
   recrear contenedores: no perder el volumen; sino hay que re-escanear QR.
5. Volver a apuntar este proyecto: en Vercel → `EVOLUTION_API_URL` y
   `EVOLUTION_INSTANCE` del VPS → redeploy. El proyecto que está produccion se
   migra aparte (puede seguir con Tailscale/PC mientras tanto).
6. Firewall del VPS: solo 22/80/443. La API key de Evolution nunca en el repo.

**Criterio para decidir**: migrar cuando este agendador pase a producción real
o cuando el otro proyecto se caiga de nuevo por depender de la PC.

---

## 3. PWA (instalar como app en el celular) — descartada por ahora

Ofrece un ícono en la pantalla de inicio del cliente habitual (sin app store).
Se descartó para mantener el alcance enfocado; se puede retomar si más adelante
los clientes de frecuencia alta lo piden.

## 4. Analítica de funnel — descartada por ahora

Medir en qué paso abandona el cliente (via BACKUP_WEBHOOK_URL ya puede deducirse
convertidos vs visitas). No prioritario hoy.
