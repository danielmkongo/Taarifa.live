#!/usr/bin/env bash
# Taarifa.live — One-time setup script
set -euo pipefail

echo "🌍 Taarifa.live Setup"
echo "====================="

# 1. Copy env file
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✅ Created .env — EDIT it with your secrets before continuing!"
  echo "   Required: MONGO_PASSWORD, REDIS_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET"
  exit 1
fi

# 2. Generate MQTT password file
if [ ! -f mqtt-broker/passwd ]; then
  echo "Creating MQTT password file..."
  MQTT_USER="${MQTT_USERNAME:-taarifa_broker}"
  MQTT_PASS="${MQTT_PASSWORD:-change_me}"
  docker run --rm eclipse-mosquitto:2 \
    mosquitto_passwd -b -c /tmp/passwd "$MQTT_USER" "$MQTT_PASS" 2>/dev/null || true
  echo "$MQTT_USER:$(docker run --rm eclipse-mosquitto:2 mosquitto_passwd -b /dev/stdin "$MQTT_USER" "$MQTT_PASS" 2>/dev/null | tail -1)" > mqtt-broker/passwd || true
  echo "⚠️  Set MQTT password manually if the above failed: see docs"
fi

# 3. Create SSL directory
mkdir -p nginx/ssl
if [ ! -f nginx/ssl/fullchain.pem ]; then
  echo "⚠️  No SSL certificates found in nginx/ssl/"
  echo "   For production: copy fullchain.pem and privkey.pem from your CA"
  echo "   For local dev: run: mkcert -install && mkcert taarifa.live localhost"
fi

# 4. Pull images
docker compose pull

echo ""
echo "✅ Setup complete. Start with:"
echo "   docker compose up -d"
echo ""
echo "📖 API docs: http://localhost:3000/docs"
echo "🖥  Frontend: http://localhost:5173"
