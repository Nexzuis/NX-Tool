const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Auth token — trim whitespace to prevent confusing lockouts
const rawAuthToken = (process.env.API_AUTH_TOKEN || '').trim();

const config = {
  apiAuthToken: rawAuthToken || null,
  apiAuthConfigured: !!rawAuthToken,
  nx: {
    host: process.env.NX_HOST || 'https://192.168.1.110:7001',
    username: process.env.NX_USERNAME || 'admin',
    password: process.env.NX_PASSWORD || '',
    engineId: process.env.NX_ENGINE_ID || null,
  },
  intervals: {
    analyticsMs: parseInt(process.env.POLL_INTERVAL_ANALYTICS_MS, 10) || 600000,
    serverMs: parseInt(process.env.POLL_INTERVAL_SERVER_MS, 10) || 300000,
    alarmsMs: parseInt(process.env.POLL_INTERVAL_ALARMS_MS, 10) || 60000,
  },
  logDir: process.env.LOG_DIR || './logs',
  dailyReportHour: (() => {
    const v = parseInt(process.env.DAILY_REPORT_HOUR, 10);
    return Number.isInteger(v) && v >= 0 && v <= 23 ? v : 6;
  })(),
  dailyReportHourEvening: (() => {
    const v = parseInt(process.env.DAILY_REPORT_HOUR_EVENING, 10);
    return Number.isInteger(v) && v >= 0 && v <= 23 ? v : 18;
  })(),
  massOfflineThreshold: (() => {
    const v = parseInt(process.env.MASS_OFFLINE_THRESHOLD, 10);
    return Number.isInteger(v) && v > 0 ? v : 20;
  })(),
  staleDaytimeMs: 3600000,    // 1 hour
  staleEveningMs: 7200000,    // 2 hours
  quietTimeStart: 23,          // SAST hour
  quietTimeEnd: 6,             // SAST hour
  telegramConfigured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
};

module.exports = config;
