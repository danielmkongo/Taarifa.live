# eCalendar Display Unit — Firmware Development Guide

**Platform:** Taarifa.live · eCalendar Module  
**Audience:** Embedded engineers building eCalendar screen hardware  
**API Base:** `https://<your-domain>/api/v1`  
**Last updated:** 2026-05-08

---

## 1. Overview

The eCalendar display unit is a WiFi-connected digital signage screen. It fetches a prioritised content feed from the Taarifa backend, renders content (announcements, images, videos, schedules), and reports its health status via periodic heartbeats. The backend controls what is shown and when — the device is a thin renderer.

```
┌─────────────────────────────────────────────────────────┐
│                    Taarifa Backend                       │
│  Dashboard → Content → Campaign → Feed builder          │
└──────────────────────┬──────────────────────────────────┘
                       │  HTTPS / REST
          ┌────────────▼────────────┐
          │   eCalendar Device      │
          │  - POST /heartbeat      │  ← primary loop
          │  - GET  /feed           │  ← content fetch
          │  - GET  /firmware/check │  ← OTA check
          │  Renders content feed   │
          └─────────────────────────┘
```

---

## 2. Hardware Requirements

| Component | Minimum spec | Notes |
|---|---|---|
| MCU | ESP32-S3 (dual-core, 240 MHz) | ESP32 works but S3 preferred for larger displays |
| RAM | 8 MB PSRAM | Required for image buffers |
| Flash | 16 MB | Firmware + SPIFFS for cached content |
| Display | Any (LVGL-compatible, HDMI, parallel RGB) | Resolution reported to server |
| WiFi | 802.11 b/g/n 2.4 GHz | WPA2-PSK minimum |
| RTC | DS3231 or PCF8523 | For accurate time-based scheduling |
| Storage | microSD (optional) | For media caching (images/video) |
| Power | 5 V 2 A minimum | Higher if driving large display backlight |

---

## 3. Authentication

Every device authenticates with a **raw 64-character hex API key** sent in the `X-API-Key` header. The key is issued once when the device is registered via the dashboard.

```
X-API-Key: a3f8c2d1e4b7...  (64 hex chars)
```

**Critical:** The backend stores only a SHA-256 hash of your key. If the key is lost, it cannot be recovered — the dashboard can rotate a new one.

**Store the key in NVS (Non-Volatile Storage), never in compiled firmware.**

```cpp
// nvs_storage.h
void storeApiKey(const char* key) {
    nvs_handle_t handle;
    nvs_open("taarifa", NVS_READWRITE, &handle);
    nvs_set_str(handle, "api_key", key);
    nvs_commit(handle);
    nvs_close(handle);
}

void loadApiKey(char* out, size_t len) {
    nvs_handle_t handle;
    nvs_open("taarifa", NVS_READONLY, &handle);
    nvs_get_str(handle, "api_key", out, &len);
    nvs_close(handle);
}
```

**First-boot provisioning:** Ship devices unconfigured. On first boot with no API key in NVS, start a WiFi captive portal (`192.168.4.1`) where a technician enters:
- WiFi SSID / password
- Server URL
- Device API key (copied from the dashboard after registering the device)

---

## 4. Device Identity

Each device has a MongoDB ObjectId as its `deviceId`. This is **not** secret — it is part of all endpoint URLs. Only the API key is secret.

```
Device ID:  66a1f3c2d4b7e8f901234567   (24-char hex, from dashboard)
API Key:    a3f8c2...                   (64-char hex, from dashboard)
```

Store both in NVS at provisioning time.

---

## 5. Main Firmware Loop

```
boot
 ├── load config from NVS (API key, device ID, server URL)
 ├── connect WiFi
 ├── sync time via NTP (pool.ntp.org)
 └── main_loop():
       every 60s ─── POST /heartbeat  ──► receive feed + OTA check
       on feed change ─── update display
       every 5min ─── check OTA if flagged
       on WiFi drop ─── reconnect, show offline indicator
```

Heartbeat is the **single source of truth**. The server updates `lastSeenAt` and sets device status to `online` when it receives a heartbeat. Missing heartbeats for ~5 minutes will flip the device to `offline` in the dashboard.

---

## 6. Heartbeat Endpoint

```
POST /api/v1/ecal/device/{deviceId}/heartbeat
X-API-Key: {apiKey}
Content-Type: application/json
```

**Request body:**
```json
{
  "firmware": "1.2.3",
  "resolution": "1920x1080",
  "nowPlaying": "Staff Safety Briefing"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `firmware` | string | **Yes** | Current firmware version string |
| `resolution` | string | No | Display resolution, e.g. `"1920x1080"` |
| `nowPlaying` | string | No | Title of currently displayed content |

**Response (200):**
```json
{
  "ok": true,
  "syncedAt": "2026-05-08T14:30:00.000Z",
  "deviceId": "66a1f3c2d4b7e8f901234567",
  "feed": [
    {
      "_id": "66b2e4d3f5c8a9b012345678",
      "type": "announcement",
      "title": "Staff Safety Briefing",
      "body": "All staff must complete fire safety training by Friday.",
      "priority": "high",
      "zone": "main",
      "durationS": 30,
      "mediaUrl": null,
      "schedule": {
        "startAt": "2026-05-08T08:00:00.000Z",
        "endAt": "2026-05-09T18:00:00.000Z"
      }
    }
  ],
  "ota": {
    "version": "1.3.0",
    "fileUrl": "https://your-cdn.com/firmware/ecal-v1.3.0.bin"
  },
  "market": {
    "diesel": 3200.0,
    "petrol": 3100.0
  }
}
```

- `ota` is **only present** when an update is pending. When absent, no update is available.
- `market` is **only present** when fuel prices have been set by the organisation. When absent or `null`, keep showing the previous cached values (or `---` if none ever received).

**C++ example:**
```cpp
bool sendHeartbeat(const char* deviceId, const char* apiKey,
                   const char* firmware, DynamicJsonDocument& responseDoc) {
    HTTPClient http;
    char url[256];
    snprintf(url, sizeof(url), "%s/ecal/device/%s/heartbeat", SERVER_URL, deviceId);

    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-API-Key", apiKey);

    DynamicJsonDocument body(256);
    body["firmware"]   = firmware;
    body["resolution"] = "1024x600";
    body["nowPlaying"] = currentContentTitle;   // global string

    String payload;
    serializeJson(body, payload);

    int code = http.POST(payload);
    if (code == 200) {
        deserializeJson(responseDoc, http.getString());
        http.end();
        return true;
    }
    http.end();
    return false;
}
```

---

## 7. Content Feed

The `feed` array is **already sorted by priority** (critical → high → normal → low). Display items in order. Each item has a `durationS` field — rotate after that many seconds, then advance to the next item, looping back to the start.

### Content item structure

```json
{
  "_id": "66b2e4d3f5c8a9b012345678",
  "type": "announcement",
  "title": "string",
  "body": "string or null",
  "mediaUrl": "https://... or null",
  "priority": "critical | high | normal | low",
  "zone": "main | secondary | ticker | null",
  "durationS": 30,
  "schedule": {
    "startAt": "ISO8601 or null",
    "endAt": "ISO8601 or null"
  },
  "target": {
    "scope": "global | group | device",
    "groupId": "...",
    "deviceId": "..."
  }
}
```

### Content types

| `type` | What to render |
|---|---|
| `announcement` | Full-screen text card. Use `title` (large) + `body` (smaller). |
| `image` | Fetch `mediaUrl` and display full-screen. Cache to SD/SPIFFS. |
| `video` | Stream or buffer from `mediaUrl`. |
| `schedule` | Structured schedule data in `body` (JSON string). Parse and render timetable layout. |
| `ticker` | Short message for a bottom ticker strip. `durationS` is per full scroll cycle. |
| `iframe` / `web` | URL in `mediaUrl`. Only viable if running a Linux/Android SBC, not bare-metal MCU. |

### Rendering loop

```cpp
struct ContentItem {
    String id;
    String type;
    String title;
    String body;
    String mediaUrl;
    uint32_t durationMs;
};

ContentItem feed[MAX_FEED_ITEMS];
int feedLen = 0;
int feedIdx = 0;
unsigned long showSince = 0;

void parseFeed(JsonArray arr) {
    feedLen = 0;
    for (JsonObject item : arr) {
        if (feedLen >= MAX_FEED_ITEMS) break;
        feed[feedLen++] = {
            item["_id"].as<String>(),
            item["type"].as<String>(),
            item["title"].as<String>(),
            item["body"].as<String>(),
            item["mediaUrl"].as<String>(),
            (uint32_t)(item["durationS"].as<int>() * 1000UL),
        };
    }
    feedIdx = 0;
    showSince = millis();
    renderCurrent();
}

void tickDisplay() {
    if (feedLen == 0) return;
    if (millis() - showSince >= feed[feedIdx].durationMs) {
        feedIdx = (feedIdx + 1) % feedLen;
        showSince = millis();
        renderCurrent();
    }
}

void renderCurrent() {
    ContentItem& item = feed[feedIdx];
    currentContentTitle = item.title.c_str();  // reported in next heartbeat

    if (item.type == "announcement") renderAnnouncement(item.title, item.body);
    else if (item.type == "image")   renderImage(item.mediaUrl);
    else if (item.type == "ticker")  renderTicker(item.title);
    else                             renderAnnouncement(item.title, item.body); // fallback
}
```

### Empty feed

When the server returns an empty `feed` array, show a default standby screen (logo, clock, org name). Do **not** show an error — empty feed is a valid state.

---

## 7a. Image Content — LVGL Binary Format

### How images reach the device

A content item with `type: "image"` delivers an LVGL `.bin` file via `mediaUrl`:

```json
{
  "type": "image",
  "title": "optional caption shown as footer",
  "mediaUrl": "https://your-server.com/content/img_001.bin",
  "durationS": 15
}
```

`body` is ignored for image type. `mediaUrl` must be a direct HTTPS URL to the binary — no redirects.

### Binary file format — LVGL 8.x `.bin`

Generate with the [LVGL online image converter](https://lvgl.io/tools/imageconverter) or the `lv_img_conv` CLI tool.

| Setting | Value |
|---|---|
| LVGL version | 8.x |
| Color format | `CF_TRUE_COLOR` (RGB565, 16-bit) |
| Output format | Binary (`.bin`) |
| Dither | Yes |

File layout:
```
Bytes 0–3   : lv_img_header_t  (4 bytes, packed)
               bits  0– 4 : color format  (4 = CF_TRUE_COLOR)
               bits  5– 7 : always 0
               bits  8–18 : width  (up to 2047 px)
               bits 19–29 : height (up to 2047 px)
               bits 30–31 : reserved
Bytes 4–end : raw RGB565 pixel data  (width × height × 2 bytes)
```

No compression, no additional headers — exactly 4 header bytes then raw pixels.

### Size constraints

The image widget zone is **520 × 280 px**. Images render at 1:1 pixel (no auto-scale); anything larger is clipped.

| | Recommended | Hard limit |
|---|---|---|
| Width | ≤ 520 px | 520 px |
| Height | ≤ 280 px | 280 px |
| File size | ≤ 291 KB | ~390 KB |

`520 × 280 × 2 = 291,200 bytes`. Allocated from 8 MB PSRAM — safe, but stay under 390 KB to leave headroom.

### Device-side rendering

```cpp
void renderImage(const String& url) {
    // Download binary into PSRAM buffer
    HTTPClient http;
    http.begin(url);
    http.addHeader("X-API-Key", apiKey);
    int code = http.GET();
    if (code != 200) { http.end(); return; }

    int len = http.getSize();
    if (len < 4 || len > 400000) { http.end(); return; }

    uint8_t* buf = (uint8_t*)ps_malloc(len);
    if (!buf) { http.end(); return; }

    WiFiClient* stream = http.getStreamPtr();
    stream->readBytes(buf, len);
    http.end();

    // Parse 4-byte LVGL header
    uint32_t header = buf[0] | (buf[1] << 8) | (buf[2] << 16) | (buf[3] << 24);
    uint16_t w = (header >> 8)  & 0x7FF;
    uint16_t h = (header >> 19) & 0x7FF;

    // Register as LVGL image source and display
    lv_img_dsc_t dsc = {};
    dsc.header.cf     = LV_IMG_CF_TRUE_COLOR;
    dsc.header.w      = w;
    dsc.header.h      = h;
    dsc.data_size     = len - 4;
    dsc.data          = buf + 4;   // skip header bytes

    lv_img_set_src(imgWidget, &dsc);
    // free(buf) after LVGL finishes rendering or on next content item
}
```

### Platform checklist

- [ ] Run image through LVGL converter → save as `.bin`
- [ ] Host the `.bin` with a direct `https://` URL (no redirects)
- [ ] Serve with `Content-Type: application/octet-stream`
- [ ] Set `type: "image"` and put the URL in `mediaUrl` in the dashboard

---

## 7b. Fuel Prices

### How prices reach the device

Fuel prices are carried in the `market` object of every heartbeat response (see section 6). No separate endpoint is needed.

```json
{
  "feed": [ ... ],
  "market": {
    "diesel": 3200.0,
    "petrol": 3100.0
  }
}
```

Values are **TZS per litre** as a float. They are set by the organisation through the eCalendar Overview dashboard (Fuel Prices card → Edit prices).

### Device handling

```cpp
float fuelDiesel = 0.0f;
float fuelPetrol = 0.0f;

void parseMarket(JsonObject market) {
    if (market.isNull()) return;
    float d = market["diesel"] | 0.0f;
    float p = market["petrol"] | 0.0f;
    if (d > 100.0f) fuelDiesel = d;   // sanity check — ignore zeros / nulls
    if (p > 100.0f) fuelPetrol = p;
    updateFuelDisplay();               // refresh the ticker / widget
}
```

| Condition | Behaviour |
|---|---|
| Field present, value > 100 | Update label immediately |
| Field missing or `null` | Keep previous value |
| Value ≤ 100 (sanity fail) | Keep previous value |
| No heartbeat yet fired | Show `---` placeholder |

Prices update on-screen within 60 seconds of being changed in the dashboard.

### Displaying prices

Typical placement is a persistent **bottom ticker strip** or a dedicated **price board zone**:

```cpp
char priceBuf[64];
snprintf(priceBuf, sizeof(priceBuf),
         "DIESEL  TZS %.0f/L     PETROL  TZS %.0f/L",
         fuelDiesel, fuelPetrol);
lv_label_set_text(tickerLabel, priceBuf);
```

---

## 8. OTA Firmware Update

### Flow

```
heartbeat response contains "ota" field
       │
       ▼
Compare response["ota"]["version"] with current firmware string
       │
  version differs?
       │
      YES ── download binary from response["ota"]["fileUrl"]
               │
               ├── use esp_https_ota() or Update library
               ├── verify download completes (check content-length)
               └── reboot via esp_restart()
```

### Version comparison

The server does a semver comparison to decide whether to send the `ota` field. On the device side, simply check if the version string in the response **differs** from your current version — the server already guarantees it only sends newer versions.

```cpp
void checkOta(JsonObject& ota) {
    if (!ota.containsKey("version")) return;

    const char* newVersion = ota["version"];
    if (strcmp(newVersion, FIRMWARE_VERSION) == 0) return;  // already up to date

    const char* fileUrl = ota["fileUrl"];
    Serial.printf("OTA update available: %s -> %s\n", FIRMWARE_VERSION, newVersion);

    // Show update screen
    displayMessage("Updating firmware...", newVersion);

    esp_http_client_config_t config = {};
    config.url = fileUrl;
    config.cert_pem = SERVER_CERT_PEM;  // pin your server cert
    config.timeout_ms = 30000;

    esp_err_t ret = esp_https_ota(&config);
    if (ret == ESP_OK) {
        Serial.println("OTA succeeded, rebooting...");
        esp_restart();
    } else {
        Serial.printf("OTA failed: %s\n", esp_err_to_name(ret));
        // continue running current firmware, retry next heartbeat cycle
    }
}
```

**Define `FIRMWARE_VERSION` at compile time:**
```cpp
// platformio.ini
build_flags =
    -DFIRMWARE_VERSION='"1.2.3"'
```

### OTA during display

Perform OTA at the **end of a content item's display duration** so the screen doesn't cut out mid-announcement. Set a flag when OTA is detected, then execute after `tickDisplay()` advances to the next item.

---

## 9. Standalone OTA Check Endpoint

In addition to the heartbeat, you can query OTA status directly (useful on boot before the main loop starts):

```
GET /api/v1/firmware/check/{deviceId}
X-API-Key: {apiKey}
```

**Response when update is available:**
```json
{
  "updateAvailable": true,
  "version": "1.3.0",
  "fileUrl": "https://your-cdn.com/firmware/ecal-v1.3.0.bin",
  "protocol": "http"
}
```

**Response when up to date:**
```json
{
  "updateAvailable": false
}
```

Call this on every cold boot before entering the main loop so the device applies any missed updates before starting to render.

---

## 10. WiFi & Connectivity

### Connection strategy

```cpp
void ensureWifi() {
    if (WiFi.status() == WL_CONNECTED) return;

    WiFi.begin(WIFI_SSID, WIFI_PASS);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(500);
        attempts++;
    }

    if (WiFi.status() != WL_CONNECTED) {
        showOfflineIndicator();   // subtle badge, keep showing last content
    } else {
        syncNtp();
    }
}
```

### Offline behaviour

- Keep the last received feed in memory (and optionally write to NVS/SPIFFS).
- Continue rotating through the cached feed — do not show a blank or error screen.
- Show a small connectivity badge (icon, not full-screen error).
- Attempt reconnection on every heartbeat cycle.
- On reconnect, fetch a fresh heartbeat immediately (don't wait for the 60 s timer).

### NTP time sync

Content scheduling relies on correct device time. Sync NTP once on boot and once every 6 hours:

```cpp
void syncNtp() {
    configTime(3 * 3600, 0, "pool.ntp.org", "time.cloudflare.com");
    // UTC+3 = East Africa Time (Tanzania)
    struct tm timeinfo;
    if (!getLocalTime(&timeinfo, 5000)) {
        Serial.println("NTP sync failed");
    }
}
```

---

## 11. Config Management

The dashboard can push device configuration. After a config change, the backend sets `configPending = true` on the device record. The device **acknowledges** the config by making a GET request:

```
GET /api/v1/ingest/config
X-API-Key: {apiKey}
```

**Response:**
```json
{
  "sampling_interval_s": 60,
  "upload_interval_s": 300,
  "timezone": "Africa/Dar_es_Salaam"
}
```

Calling this endpoint clears the `configPending` flag. Do this on boot and whenever the heartbeat response indicates a pending config (check for this field if added in future).

---

## 12. Certificate Pinning

Do not use `setInsecure()` in production. Pin the server's root CA certificate:

```cpp
// embed cert at compile time
extern const uint8_t server_cert_pem_start[] asm("_binary_server_cert_pem_start");
extern const uint8_t server_cert_pem_end[]   asm("_binary_server_cert_pem_end");

// or load from SPIFFS
WiFiClientSecure client;
client.setCACert((const char*)server_cert_pem_start);
```

Update the pinned cert before it expires. Consider shipping two certs (current + next) to allow rolling renewal without a firmware update.

---

## 13. Error Codes & Recovery

| HTTP code | Meaning | Action |
|---|---|---|
| 200 | OK | Process response normally |
| 401 | Bad or missing API key | Flash error LED. Do not retry automatically — needs re-provisioning |
| 403 | Device deactivated | Same as 401. Show "Device deactivated" screen |
| 404 | Device ID not found | Same as above |
| 429 | Rate limited | Back off 5 minutes before retrying |
| 5xx | Server error | Back off 2 minutes, retry up to 3 times, then show offline indicator |
| Network timeout | WiFi/DNS/TLS failure | Reconnect WiFi, retry after 30 s |

---

## 14. PlatformIO Project Structure

```
ecalendar-firmware/
├── platformio.ini
├── src/
│   ├── main.cpp          # setup() + loop()
│   ├── heartbeat.cpp/h   # POST /heartbeat, parse feed + OTA
│   ├── ota.cpp/h         # esp_https_ota wrapper
│   ├── display.cpp/h     # rendering (LVGL or custom)
│   ├── nvs_store.cpp/h   # NVS read/write helpers
│   ├── wifi_mgr.cpp/h    # WiFi + NTP
│   └── provisioning.cpp/h # Captive portal for first-boot setup
├── data/                 # SPIFFS: cert, default logo
│   └── server_ca.pem
└── certs/
    └── server_ca.pem     # embedded via build system
```

**platformio.ini:**
```ini
[env:esp32s3]
platform = espressif32
board = esp32-s3-devkitc-1
framework = arduino
board_build.psram = enabled
board_build.filesystem = littlefs
monitor_speed = 115200

lib_deps =
    bblanchon/ArduinoJson @ ^7.0
    knolleary/PubSubClient @ ^2.8    ; if using MQTT heartbeat variant
    lvgl/lvgl @ ^9.0                 ; if using LVGL for display

build_flags =
    -DFIRMWARE_VERSION='"1.0.0"'
    -DSERVER_URL='"https://your-domain.com/api/v1"'
    -DHEARTBEAT_INTERVAL_MS=60000
    -DBOARD_HAS_PSRAM
```

---

## 15. Provisioning & Registration Sequence

```
1. Manufacture device with blank NVS (no API key)

2. First power-on:
   - Device starts WiFi AP: "eCalendar-Setup-XXXX"
   - Captive portal at 192.168.4.1
   - Technician connects phone/laptop

3. Technician fills form:
   - WiFi SSID + password
   - Taarifa server URL
   - Device API key (from dashboard: Screens → Add Screen → copy key)
   - Device ID (from dashboard)
   - (Optional) device name / location label

4. Device stores all values in NVS, reboots into production firmware

5. First heartbeat confirms device appears "online" in dashboard
```

---

## 16. Quick Reference — Endpoints Summary

| Purpose | Method | Path |
|---|---|---|
| **Heartbeat + feed** | `POST` | `/ecal/device/{id}/heartbeat` |
| **Feed only** | `GET` | `/ecal/device/{id}/feed` |
| **OTA check** | `GET` | `/firmware/check/{id}` |
| **Fetch config** | `GET` | `/ingest/config` |

All requests:
- Base: `https://<domain>/api/v1`
- Header: `X-API-Key: <64-char-hex-key>`
- Header: `Content-Type: application/json` (POST only)

---

## 17. Checklist Before First Deployment

- [ ] API key and device ID stored in NVS (not hardcoded in firmware)
- [ ] `FIRMWARE_VERSION` defined in build flags and matches what's registered in dashboard
- [ ] Server CA cert pinned (`setCACert`, not `setInsecure`)
- [ ] NTP synced to UTC+3 (EAT) on boot
- [ ] Heartbeat loop confirmed at ≤ 60 s intervals
- [ ] `nowPlaying` field sent in heartbeat body
- [ ] OTA check on cold boot before main loop
- [ ] OTA applied cleanly, device reboots, new version confirmed by next heartbeat
- [ ] Empty feed shows standby screen (not error)
- [ ] WiFi dropout shows offline badge, continues from cached feed
- [ ] 401/403 response shows human-readable error on screen, no retry loop
- [ ] `market.diesel` / `market.petrol` parsed from heartbeat and shown on-screen
- [ ] Missing `market` field keeps previous price values (no reset to `---`)
- [ ] Image type: LVGL `.bin` downloaded, 4-byte header parsed, rendered via `lv_img_set_src`
- [ ] Image buffer allocated from PSRAM (`ps_malloc`), freed after display
