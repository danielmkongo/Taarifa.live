# Running Taarifa.live locally (no Docker)

## Prerequisites
- Node.js 20+  →  https://nodejs.org
- (Optional) Redis for real-time WebSocket updates — skip it to start

---

## 1 — Backend

```powershell
cd backend
npm install
npm run dev
```

Runs on **http://localhost:3000**
API docs → http://localhost:3000/docs

---

## 2 — Frontend (separate terminal)

```powershell
cd frontend
npm install
npm run dev
```

Opens on **http://localhost:5173**

---

## 3 — Create your first user

```powershell
cd backend
node ../scripts/seed-admin.js admin@you.com yourpassword "Your Name"
```

Then sign in at http://localhost:5173/login

---

## Credentials already wired in

| Service | Config file | Key |
|---|---|---|
| MongoDB Atlas | `backend/.env` | `MONGO_URL` |
| Google Maps | `frontend/.env` | `VITE_GOOGLE_MAPS_API_KEY` |

---

## Device ingestion (test)

```powershell
curl -X POST http://localhost:3000/api/v1/ingest `
  -H "X-Api-Key: YOUR_DEVICE_KEY" `
  -H "Content-Type: application/json" `
  -d '{"readings":[{"key":"temperature","value":24.5},{"key":"humidity","value":68}]}'
```
