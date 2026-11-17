#!/usr/bin/env bash
# TEMPORAL: esta PC sirve el WhatsApp de producción vía túnel ngrok (dominio
# reservado). Cuando exista el VPS, esta rutina se muda al server tal cual.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || { echo "Falta .env con EVUL_API_KEY (ver .env.example)."; exit 1; }

# Containers de WhatsApp (auto-arrancan con Docker Desktop si estaban stopped)
docker compose -f docker-compose.local-demo.yml up -d

# HOTFIX 18/11: al suspender la PC el socket de WhatsApp muere pero Evolution
# sigue reportando "open" cacheado → sendText falla con "Connection Closed".
# Reinicio garantiza un socket fresco con la sesión guardada (sin re-escanear QR).
echo "→ Reinicio del contenedor (socket fresco)..."
docker restart ariels_demo_evolution >/dev/null

# Stack abandonado viejo: lo mantenemos detenido para no gastar CPU
docker ps -a --format "{{.Names}}" | grep "^agenda_server_" | xargs -r docker stop >/dev/null 2>&1 || true

# Túnel con dominio fijo (queda corriendo en esta terminal)
echo "→ Túnel ngrok con dominio reservado..."
ngrok start evo --log=stdout > /tmp/opencode/ngrok-prod.log 2>&1 &
NGROK_PID=$!
sleep 5

# Health-check (Evolution contestó por el túnel?)
URL="https://shorter-disjoin-habitant.ngrok-free.dev"
KEY=$(grep EVUL_API_KEY .env | cut -d= -f2)
STATE=$(curl -s -m 15 "$URL/instance/connectionState/ariels-demo" -H "apikey: $KEY" | grep -oE '"state":"[a-z]+"' || true)
echo "→ Estado instancia ariels-demo: ${STATE:-sin respuesta}"
echo ""
echo "✅ Servidor WhatsApp de producción en marcha (ngrok PID $NGROK_PID)."
echo "   NO cierres esta terminal. El PC debe quedarse encendido."
echo "   Para detener todo: kill $NGROK_PID && docker compose -f docker-compose.local-demo.yml down"
