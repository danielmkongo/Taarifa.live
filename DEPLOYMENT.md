# Taarifa.live — Deployment Guide

## Prerequisites
- Docker ≥ 24 + Docker Compose ≥ 2.20
- 4 GB RAM minimum (8 GB recommended)
- Domain name with DNS pointing to your server

---

## 1. Clone & Configure

```bash
git clone https://github.com/your-org/taarifa.live.git
cd taarifa.live
cp .env.example .env
```

Edit `.env` — set **all** required values:

| Variable | Description |
|---|---|
| `MONGO_PASSWORD` | Strong MongoDB password |
| `REDIS_PASSWORD` | Strong Redis password |
| `JWT_SECRET` | Min 32 random characters |
| `JWT_REFRESH_SECRET` | Min 32 random characters (different) |
| `MQTT_PASSWORD` | MQTT broker password |
| `SMTP_*` | Email server credentials |
| `WEATHER_API_KEY` | [OpenWeatherMap](https://openweathermap.org/api) free key |
| `APP_URL` | Your public URL e.g. `https://taarifa.live` |

---

## 2. SSL Certificates

```bash
mkdir -p nginx/ssl
# Option A: Let's Encrypt (production)
certbot certonly --standalone -d taarifa.live
cp /etc/letsencrypt/live/taarifa.live/fullchain.pem nginx/ssl/
cp /etc/letsencrypt/live/taarifa.live/privkey.pem nginx/ssl/

# Option B: Self-signed (dev only)
openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
  -keyout nginx/ssl/privkey.pem -out nginx/ssl/fullchain.pem \
  -subj "/CN=taarifa.live"
```

---

## 3. MQTT Password File

```bash
# Create Mosquitto password file
docker run --rm -it eclipse-mosquitto:2 \
  mosquitto_passwd -c /tmp/passwd your_mqtt_user
# Copy output to mqtt-broker/passwd
```

---

## 4. Start Services

```bash
docker compose up -d

# Check logs
docker compose logs -f backend

# Create admin user
docker compose exec backend node /app/scripts/seed-admin.js \
  admin@yourorg.com your_password "Admin Name"
```

---

## 5. Access

| Service | URL |
|---|---|
| Frontend | https://taarifa.live |
| API Docs | https://taarifa.live/api/v1 (proxied) or http://localhost:3000/docs |
| MongoDB | localhost:27017 (internal only) |
| MQTT | mqtt://localhost:1883 |

---

## Device Integration

### HTTP Ingestion

```bash
# POST sensor readings
curl -X POST https://taarifa.live/api/v1/ingest \
  -H "X-Api-Key: YOUR_DEVICE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp": "2026-05-01T10:00:00Z",
    "readings": [
      {"key": "temperature", "value": 24.5},
      {"key": "humidity", "value": 68.2},
      {"key": "rainfall", "value": 0.0}
    ]
  }'
```

### MQTT Ingestion

Topic: `taarifa/{API_KEY_PREFIX}/data`

Payload:
```json
{
  "timestamp": "2026-05-01T10:00:00Z",
  "readings": [
    {"key": "temperature", "value": 24.5},
    {"key": "humidity", "value": 68.2}
  ]
}
```

### Arduino/ESP32 Example

```cpp
#include <WiFi.h>
#include <HTTPClient.h>

const char* INGEST_URL = "https://taarifa.live/api/v1/ingest";
const char* API_KEY = "your_device_api_key";

void sendReading(float temp, float hum) {
  HTTPClient http;
  http.begin(INGEST_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Api-Key", API_KEY);

  String payload = "{\"readings\":[{\"key\":\"temperature\",\"value\":" +
    String(temp, 1) + "},{\"key\":\"humidity\",\"value\":" + String(hum, 1) + "}]}";

  http.POST(payload);
  http.end();
}
```

---

## Scaling

### Horizontal scaling (multiple backend instances)
```yaml
# docker-compose.override.yml
services:
  backend:
    deploy:
      replicas: 3
```

### MongoDB replica set (production)
Replace single MongoDB with a replica set or use MongoDB Atlas.

### Monitoring
- MongoDB: use MongoDB Atlas or Mongo Express (`docker compose --profile monitoring up`)
- Application: integrate with Prometheus + Grafana

---

## Backup

```bash
# MongoDB backup
docker compose exec mongo mongodump --out /backup --gzip
docker cp taarifa_mongo:/backup ./backups/$(date +%Y%m%d)

# Automate with cron
echo "0 2 * * * docker compose exec mongo mongodump --out /backup --gzip" | crontab -
```

---

## Architecture Summary

```
Internet
    │
  Nginx (443/80)
    ├── /api/*  ──→  Backend (Fastify, port 3000)
    │                   ├── MongoDB (time-series + relational)
    │                   ├── Redis (cache, sessions, pub/sub)
    │                   └── MQTT Broker (device data)
    └── /*      ──→  Frontend (React SPA, Nginx)
```

**Data flow:**
1. Device sends readings via MQTT or HTTP POST to `/api/v1/ingest`
2. Backend validates, normalizes, stores in MongoDB Time Series Collection
3. Alert rules evaluated; notifications sent via email/webhook
4. Frontend reads via REST API + WebSocket for real-time updates
5. E-Calendar displays sync via `/api/v1/ecal/sync/:deviceId`
