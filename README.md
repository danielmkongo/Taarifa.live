# Taarifa.live

> A multi-module IoT platform built by Daniel Mkongo. *Taarifa* is Swahili for "information".

Taarifa.live collects data from field devices and turns it into dashboards, maps, alerts and exports. Users pick the modules they need.

## Modules

- **Devices and data**: register devices, ingest telemetry over HTTP or MQTT, browse and export readings
- **Map**: devices on a live map
- **Alerts**: alerts raised from incoming data
- **Energy** and **weather** data views
- **eCalendar**: Wi-Fi digital-signage screens that pull a scheduled content feed (announcements, images, video), report health by heartbeat and update their firmware over the air. See [`docs/ecalendar-firmware-guide.md`](docs/ecalendar-firmware-guide.md).
- **Users**: user management and a super-admin console

## Stack

- `backend/`: Node.js API with WebSocket live updates and an MQTT worker
- `frontend/`: React dashboard
- `mqtt-broker/`, `nginx/`, `docker-compose.yml`: deployment

## Run it

Local setup without Docker: [`START.md`](START.md). Production deployment: [`DEPLOYMENT.md`](DEPLOYMENT.md).


---

## Author

Built by **Daniel Mkongo** (Daniel Godfrey Mkongo), mechatronics engineer, CEO and co-founder of [Vortan](https://vortan.io), Arusha, Tanzania. Daniel designs embedded hardware, firmware and the cloud platforms that run on top of them.

[GitHub](https://github.com/danielmkongo) · [LinkedIn](https://www.linkedin.com/in/daniel-mkongo-2a5906202)
