-- Taarifa.live — Initial Schema
-- Run order: 001 (PostgreSQL extensions must come first)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "timescaledb" CASCADE;
CREATE EXTENSION IF NOT EXISTS "postgis" CASCADE;

-- ── Enums ─────────────────────────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('super_admin', 'org_admin', 'manager', 'viewer');
CREATE TYPE device_status AS ENUM ('online', 'offline', 'alert', 'maintenance');
CREATE TYPE alert_severity AS ENUM ('info', 'warning', 'critical');
CREATE TYPE alert_state AS ENUM ('open', 'acknowledged', 'resolved');
CREATE TYPE notification_channel AS ENUM ('email', 'sms', 'web', 'webhook');
CREATE TYPE ecal_content_type AS ENUM ('event', 'news', 'announcement', 'advertisement');
CREATE TYPE export_format AS ENUM ('csv', 'excel');
CREATE TYPE export_status AS ENUM ('pending', 'processing', 'ready', 'failed');

-- ── Organizations (tenants) ────────────────────────────────────────────────────

CREATE TABLE organizations (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    settings    JSONB NOT NULL DEFAULT '{}',
    plan        TEXT NOT NULL DEFAULT 'free',
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Users ─────────────────────────────────────────────────────────────────────

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    full_name       TEXT NOT NULL,
    role            user_role NOT NULL DEFAULT 'viewer',
    locale          TEXT NOT NULL DEFAULT 'en',
    avatar_url      TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_org_id ON users(org_id);
CREATE INDEX idx_users_email ON users(email);

-- ── Refresh tokens ─────────────────────────────────────────────────────────────

CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);

-- ── Device Groups ──────────────────────────────────────────────────────────────

CREATE TABLE device_groups (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT,
    metadata    JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_device_groups_org_id ON device_groups(org_id);

-- ── Devices ───────────────────────────────────────────────────────────────────

CREATE TABLE devices (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    group_id            UUID REFERENCES device_groups(id) ON DELETE SET NULL,
    name                TEXT NOT NULL,
    description         TEXT,
    serial_number       TEXT UNIQUE,
    firmware_version    TEXT,
    hardware_version    TEXT,
    -- Location (PostGIS)
    location            GEOGRAPHY(POINT, 4326),
    location_name       TEXT,
    altitude_m          NUMERIC(8,2),
    -- Status
    status              device_status NOT NULL DEFAULT 'offline',
    last_seen_at        TIMESTAMPTZ,
    battery_level       SMALLINT CHECK (battery_level BETWEEN 0 AND 100),
    signal_strength     SMALLINT,
    -- Configuration (sent to device on next connect)
    config              JSONB NOT NULL DEFAULT '{"sampling_interval_s": 60, "upload_interval_s": 300}',
    config_pending      BOOLEAN NOT NULL DEFAULT false,
    -- Auth
    api_key_hash        TEXT NOT NULL UNIQUE,
    api_key_prefix      TEXT NOT NULL,
    -- Flags
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_devices_org_id ON devices(org_id);
CREATE INDEX idx_devices_group_id ON devices(group_id);
CREATE INDEX idx_devices_status ON devices(status);
CREATE INDEX idx_devices_api_key_prefix ON devices(api_key_prefix);
CREATE INDEX idx_devices_location ON devices USING GIST(location);

-- ── Sensor types (metadata registry) ──────────────────────────────────────────

CREATE TABLE sensor_types (
    id          SERIAL PRIMARY KEY,
    key         TEXT NOT NULL UNIQUE,   -- e.g. "temperature", "humidity"
    label       TEXT NOT NULL,
    unit        TEXT NOT NULL,          -- e.g. "°C", "%", "mm"
    description TEXT
);

INSERT INTO sensor_types (key, label, unit) VALUES
    ('temperature',     'Temperature',      '°C'),
    ('humidity',        'Humidity',         '%'),
    ('pressure',        'Pressure',         'hPa'),
    ('rainfall',        'Rainfall',         'mm'),
    ('wind_speed',      'Wind Speed',       'm/s'),
    ('wind_direction',  'Wind Direction',   '°'),
    ('uv_index',        'UV Index',         ''),
    ('soil_moisture',   'Soil Moisture',    '%'),
    ('soil_temp',       'Soil Temperature', '°C'),
    ('co2',             'CO₂',             'ppm'),
    ('pm25',            'PM2.5',            'µg/m³'),
    ('pm10',            'PM10',             'µg/m³'),
    ('battery_voltage', 'Battery Voltage',  'V'),
    ('solar_radiation', 'Solar Radiation',  'W/m²');

-- ── Sensor readings (TimescaleDB hypertable) ───────────────────────────────────

CREATE TABLE sensor_readings (
    time        TIMESTAMPTZ NOT NULL,
    device_id   UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    sensor_key  TEXT NOT NULL,
    value       DOUBLE PRECISION NOT NULL,
    quality     SMALLINT NOT NULL DEFAULT 100,  -- 0-100 quality score
    raw_value   DOUBLE PRECISION                -- original before normalization
);

-- Convert to hypertable (partition by month)
SELECT create_hypertable('sensor_readings', 'time', chunk_time_interval => INTERVAL '1 month');

CREATE INDEX idx_readings_device_time ON sensor_readings(device_id, time DESC);
CREATE INDEX idx_readings_sensor_key ON sensor_readings(sensor_key, time DESC);

-- Retention policy: keep raw data for 1 year
SELECT add_retention_policy('sensor_readings', INTERVAL '1 year');

-- ── Hourly aggregates (continuous aggregate) ───────────────────────────────────

CREATE MATERIALIZED VIEW sensor_readings_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS bucket,
    device_id,
    sensor_key,
    AVG(value)  AS avg_value,
    MIN(value)  AS min_value,
    MAX(value)  AS max_value,
    COUNT(*)    AS sample_count
FROM sensor_readings
GROUP BY 1, 2, 3
WITH NO DATA;

SELECT add_continuous_aggregate_policy('sensor_readings_hourly',
    start_offset => INTERVAL '3 hours',
    end_offset   => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour');

-- Retain hourly aggregates for 5 years
SELECT add_retention_policy('sensor_readings_hourly', INTERVAL '5 years');

-- ── Daily aggregates ───────────────────────────────────────────────────────────

CREATE MATERIALIZED VIEW sensor_readings_daily
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', time) AS bucket,
    device_id,
    sensor_key,
    AVG(value)  AS avg_value,
    MIN(value)  AS min_value,
    MAX(value)  AS max_value,
    SUM(value)  AS sum_value,
    COUNT(*)    AS sample_count
FROM sensor_readings
GROUP BY 1, 2, 3
WITH NO DATA;

SELECT add_continuous_aggregate_policy('sensor_readings_daily',
    start_offset => INTERVAL '2 days',
    end_offset   => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day');

-- ── Alert rules ────────────────────────────────────────────────────────────────

CREATE TABLE alert_rules (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT,
    -- Scope: all devices in org, a group, or a specific device
    device_id       UUID REFERENCES devices(id) ON DELETE CASCADE,
    group_id        UUID REFERENCES device_groups(id) ON DELETE CASCADE,
    -- Condition
    sensor_key      TEXT NOT NULL,
    operator        TEXT NOT NULL CHECK (operator IN ('>', '<', '>=', '<=', '=', '!=')),
    threshold       DOUBLE PRECISION NOT NULL,
    duration_s      INTEGER NOT NULL DEFAULT 0,  -- must persist for N seconds
    severity        alert_severity NOT NULL DEFAULT 'warning',
    -- Notifications
    channels        notification_channel[] NOT NULL DEFAULT '{web}',
    webhook_url     TEXT,
    -- State
    is_active       BOOLEAN NOT NULL DEFAULT true,
    cooldown_s      INTEGER NOT NULL DEFAULT 300,  -- min seconds between alerts
    last_triggered_at TIMESTAMPTZ,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alert_rules_org_id ON alert_rules(org_id);
CREATE INDEX idx_alert_rules_device_id ON alert_rules(device_id);

-- ── Alert events ───────────────────────────────────────────────────────────────

CREATE TABLE alert_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_id         UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    device_id       UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    sensor_key      TEXT NOT NULL,
    trigger_value   DOUBLE PRECISION NOT NULL,
    severity        alert_severity NOT NULL,
    state           alert_state NOT NULL DEFAULT 'open',
    message         TEXT,
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMPTZ,
    resolved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alert_events_rule_id ON alert_events(rule_id);
CREATE INDEX idx_alert_events_device_id ON alert_events(device_id);
CREATE INDEX idx_alert_events_state ON alert_events(state);
CREATE INDEX idx_alert_events_created_at ON alert_events(created_at DESC);

-- ── Notification log ───────────────────────────────────────────────────────────

CREATE TABLE notification_log (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id    UUID REFERENCES alert_events(id) ON DELETE SET NULL,
    channel     notification_channel NOT NULL,
    recipient   TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending',
    error       TEXT,
    sent_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Audit log ──────────────────────────────────────────────────────────────────

CREATE TABLE audit_log (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id      UUID REFERENCES organizations(id) ON DELETE SET NULL,
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    action      TEXT NOT NULL,
    entity_type TEXT,
    entity_id   UUID,
    diff        JSONB,
    ip_address  INET,
    user_agent  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_org_id ON audit_log(org_id, created_at DESC);
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id, created_at DESC);

-- ── Weather forecast cache ─────────────────────────────────────────────────────

CREATE TABLE weather_cache (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lat         NUMERIC(9,6) NOT NULL,
    lon         NUMERIC(9,6) NOT NULL,
    data        JSONB NOT NULL,
    fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX idx_weather_cache_coords ON weather_cache(ROUND(lat::NUMERIC, 2), ROUND(lon::NUMERIC, 2));
CREATE INDEX idx_weather_cache_expires ON weather_cache(expires_at);

-- ── Scheduled reports ──────────────────────────────────────────────────────────

CREATE TABLE scheduled_reports (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by      UUID REFERENCES users(id),
    name            TEXT NOT NULL,
    format          export_format NOT NULL DEFAULT 'csv',
    schedule        TEXT NOT NULL DEFAULT '0 6 * * 1',  -- cron expression
    filters         JSONB NOT NULL DEFAULT '{}',
    recipients      TEXT[] NOT NULL DEFAULT '{}',
    is_active       BOOLEAN NOT NULL DEFAULT true,
    last_run_at     TIMESTAMPTZ,
    next_run_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Export jobs ────────────────────────────────────────────────────────────────

CREATE TABLE export_jobs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    requested_by    UUID REFERENCES users(id),
    format          export_format NOT NULL,
    filters         JSONB NOT NULL DEFAULT '{}',
    status          export_status NOT NULL DEFAULT 'pending',
    file_path       TEXT,
    error           TEXT,
    row_count       INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_export_jobs_org_id ON export_jobs(org_id, created_at DESC);

-- ── E-Calendar: device groups ──────────────────────────────────────────────────

CREATE TABLE ecal_device_groups (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT,
    timezone    TEXT NOT NULL DEFAULT 'UTC',
    metadata    JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── E-Calendar: display devices ────────────────────────────────────────────────

CREATE TABLE ecal_devices (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    group_id        UUID REFERENCES ecal_device_groups(id) ON DELETE SET NULL,
    name            TEXT NOT NULL,
    location        TEXT,
    api_key_hash    TEXT NOT NULL UNIQUE,
    api_key_prefix  TEXT NOT NULL,
    last_seen_at    TIMESTAMPTZ,
    status          device_status NOT NULL DEFAULT 'offline',
    config          JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── E-Calendar: content items ──────────────────────────────────────────────────

CREATE TABLE ecal_content (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by      UUID REFERENCES users(id),
    type            ecal_content_type NOT NULL,
    title           TEXT NOT NULL,
    body            TEXT,
    media_url       TEXT,
    priority        SMALLINT NOT NULL DEFAULT 5,  -- 1 (highest) to 10 (lowest)
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── E-Calendar: campaigns (schedule content to groups) ────────────────────────

CREATE TABLE ecal_campaigns (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    content_id      UUID NOT NULL REFERENCES ecal_content(id) ON DELETE CASCADE,
    group_id        UUID NOT NULL REFERENCES ecal_device_groups(id) ON DELETE CASCADE,
    starts_at       TIMESTAMPTZ NOT NULL,
    ends_at         TIMESTAMPTZ NOT NULL,
    display_duration_s INTEGER NOT NULL DEFAULT 30,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_dates CHECK (ends_at > starts_at)
);

CREATE INDEX idx_ecal_campaigns_group_time ON ecal_campaigns(group_id, starts_at, ends_at);

-- ── Updated_at triggers ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'organizations','users','devices','device_groups',
        'alert_rules','ecal_content'
    ] LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_updated_at BEFORE UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t);
    END LOOP;
END;
$$;

-- ── Seed: default super-admin org ─────────────────────────────────────────────

INSERT INTO organizations (id, name, slug, plan) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Taarifa Platform', 'taarifa', 'enterprise');
