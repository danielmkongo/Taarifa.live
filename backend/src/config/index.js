import 'dotenv/config';

const required = (key) => {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
};

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),

  mongo: {
    url: required('MONGO_URL'),
    db:  process.env.MONGO_DB || 'taarifa',
  },

  redis: {
    // Redis is optional — if not set, caching/pub-sub features degrade gracefully
    url: process.env.REDIS_URL || null,
  },

  mqtt: {
    url:      process.env.MQTT_URL || 'mqtt://localhost:1883',
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    clientId: `taarifa-backend-${process.pid}`,
    topics: {
      data:   'taarifa/+/data',
      status: 'taarifa/+/status',
    },
  },

  jwt: {
    secret:         required('JWT_SECRET'),
    refreshSecret:  required('JWT_REFRESH_SECRET'),
    expiresIn:      '15m',
    refreshExpiresIn: '30d',
  },

  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || 'noreply@taarifa.live',
  },

  weather: {
    apiKey:   process.env.WEATHER_API_KEY,
    apiUrl:   process.env.WEATHER_API_URL || 'https://api.openweathermap.org/data/2.5',
    cacheTtlS: 1800,
  },

  appUrl:  process.env.APP_URL || 'http://localhost:5173',

  exports: {
    dir:   process.env.EXPORTS_DIR || '/app/exports',
    ttlMs: 24 * 60 * 60 * 1000,
  },
};
