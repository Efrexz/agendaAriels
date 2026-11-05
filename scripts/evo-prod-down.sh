#!/usr/bin/env bash
# Detiene el túnel y los containers de WhatsApp (la sesión del teléfono se conserva).
pkill -f "ngrok start evo" 2>/dev/null || true
docker compose -f docker-compose.local-demo.yml stop
echo "Servidor WhatsApp detenido (QR/instancia quedan guardados). Arranca de nuevo con scripts/evo-prod-up.sh"
