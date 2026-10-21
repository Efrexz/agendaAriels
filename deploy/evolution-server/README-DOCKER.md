# Guía: Servidor de WhatsApp (demo) en la laptop

> Objetivo: que la web de producción (Vercel) envíe WhatsApps REALES a través de
> TU laptop, para la demo con el jefe. Aislada del difusor: otra máquina, otra
> instancia, otro número. Cuando tengas el OK del proyecto, esta misma carpeta
> se copia tal cual al VPS y queda el servidor 24/7.

## Lo que ya está hecho (no lo repitas)

- `docker-compose.yml` en esta carpeta: Evolution + Postgres + Redis listos,
  con re-auto-arranque (`unless-stopped`) y volúmenes persistentes (el QR NO
  se pierde al reiniciar la laptop).
- API key del servidor: **`agenda-demo-key`** (valor de demo; en el VPS se pone uno fuerte).
- En Vercel ya está/apuntará: `EVOLUTION_API_URL` (la URL que Tú pasas del paso 7),
  `EVOLUTION_API_KEY=agenda-demo-key`, `EVOLUTION_INSTANCE=ariels-agenda`.

## Pasos que ejecutas TÚ (conmigo en chat si quieres, ~25 min la 1ª vez)

### 1. Activar Docker Desktop para esta laptop (WSL integration)

1. Abre **Docker Desktop** en Windows.
2. Icono de engranaje (Settings) → **Resources** → **WSL Integration**.
3. Activa "Enable integration with my default distro" y/o marca la distro
   (Ubuntu) — en Linux distro check on.
4. Botón **Apply & Restart**. Espera a que quede verde "Docker Desktop is running".

### 2. Levantar el servidor

```bash
cd ~/veterinaria/agendaAriels/deploy/evolution-server
docker compose up -d
docker compose ps          # deben aparecer 3 contenedores "Up"
```

(Primera vez descarga las imágenes: 1-2 min.)

### 3. Conectar el WhatsApp (TU número personal, se hace UNA vez)

1. Navegador → `http://localhost:8080/manager`
   (Global API key del manager: `agenda-demo-key`)
2. **Create Instance** → nombre: `ariels-agenda` → Create.
3. Aparece el **QR** → en tu celular: WhatsApp → *Cuenta* → *Dispositivo conectados* → escanea.
4. Espera que diga "connected" (verde).

> ⚠️ El número que escaneas es la LÍNEA QUE ENVÍA los mensajes del agendador.
> Tu número personal solo para la demo. En el VPS final: número dedicado de la veterinaria.

### 4. Instalar Tailscale + exponer el túnel HTTPS 24/7

```bash
# si aún no está instalada en la distro Linux:
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up          # abre el navegador → inicia sesión (cuenta gratis)
```

```bash
# exponer Evolution a internet por HTTPS:
tailscale funnel 8080 or http://localhost:8080/off
```

(Funnel pide activar HTTPS certificado la primera vez: `tailscale cert` follow.)

5. La salida muestra una **URL pública** tipo `https://<nombre-laptop>.ts.net`
   → **Esa es la EVOLUTION_API_URL**. Copiala y pásamela en el chat.

### 5. Prueba final (yo lo corro o tú)

```bash
curl <TU_URL>.ts.net/  → debe responder algo JSON de Evolution
```

Cuando me pases la URL → registro en Vercel → hago una reserva de prueba real →
llegan los 2 WhatsApps (el "dentro del horario" que toca).

## Para la DEMO con el jefe (día D)

| Qué | Checklist |
|---|---|
| Laptop encendida, **Docker Desktop abierto** | solo abrir Docker Desktop (los contenedores se levantan solos) |
| Verificación express (2 min, antes que llegue la gente) | `docker compose ps` Nota: debe decir "Up" y `curl tu-url.ts.net/` debe responder |
| La demo se hace en la PC del trabajo | navegar por la web, agendando valor real: los WhatsApp llegan |

## Problemas comunes

| Síntoma | Causa/Acción |
|---|---|
| "Cannot connect to the Docker daemon" | Docker Desktop no está abierto en Windows |
| curl a la URL .ts.net no responde | Tailscale Funnel adicional: se detiene si Tailscale apagado — corre `tailscale funnel 8080` de nuevo y verifica `tailscale status` |
| Reserva falla con "No se pudo entregar" | la instancia se desconectó: manager → `ariels-agenda` → re-escanea QR |
| Laptop se quedó sin energía / se apagó | los contenedores se levantan SOLA cuando Docker esté abierto; no se pierde el QR |
