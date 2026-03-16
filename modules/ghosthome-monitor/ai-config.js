'use strict';

/**
 * ai-config.js
 * AI configuration persistence — load/save data/ai-config.json.
 * API keys stored on disk; redacted when sent to frontend.
 *
 * Exports: load(), save(config), getDefault(), redactForClient(config)
 */

const fs = require('fs');
const path = require('path');
const { log } = require('./logger');

const WF = 'AI-CONFIG';
const DATA_DIR = path.join(__dirname, 'data');
const CONFIG_PATH = path.join(DATA_DIR, 'ai-config.json');

function getDefault() {
  return {
    _version: 1,
    _savedAt: null,
    enabled: false,
    apiKey: '',
    model: 'claude-haiku-4-5-20251001',
    maxQueriesPerHour: 30,
    monthlyBudgetCap: 50,
    estimatedMonthlySpend: 0,
    systemPromptOverride: null,
    spendResetDate: getNextMonthReset(),
    capabilities: {
      read: [
        'list_cameras', 'get_camera_details', 'get_event_rules',
        'get_server_health', 'get_server_info',
        'get_analytics_status', 'get_analytics_engines',
        'search_event_log', 'search_workflow_logs',
        'get_active_incidents', 'get_recording_status',
        'get_storage_info',
        'get_users',
        'get_bookmarks', 'get_layouts', 'get_site_info',
        'get_licenses',
        'get_suppressed_cameras', 'get_workflow_status',
      'get_infrastructure_summary', 'get_user_cameras',
      ],
      device_management: [],
      server_admin: [],
    },
    servers: [],
    telegram: {
      enabled: true,
      allowedChatIds: [],
    },
    web: {
      enabled: true,
    },
  };
}

function getNextMonthReset() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return next.toISOString().slice(0, 10);
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function load() {
  ensureDataDir();
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      return getDefault();
    }
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw);

    // Merge with defaults to pick up any newly added fields
    const defaults = getDefault();
    const merged = { ...defaults, ...parsed };
    merged.capabilities = { ...defaults.capabilities, ...parsed.capabilities };
    merged.telegram = { ...defaults.telegram, ...parsed.telegram };
    merged.web = { ...defaults.web, ...parsed.web };

    // Check if monthly spend should reset
    if (merged.spendResetDate && new Date() >= new Date(merged.spendResetDate)) {
      merged.estimatedMonthlySpend = 0;
      merged.spendResetDate = getNextMonthReset();
      save(merged);
    }

    return merged;
  } catch (err) {
    log(WF, 'LOAD_ERROR', { detail: { error: err.message } });
    return getDefault();
  }
}

function save(config) {
  ensureDataDir();
  try {
    config._savedAt = new Date().toISOString();
    const json = JSON.stringify(config, null, 2);
    // Atomic write: write to temp then rename
    const tmp = CONFIG_PATH + '.tmp';
    fs.writeFileSync(tmp, json, 'utf8');
    fs.renameSync(tmp, CONFIG_PATH);
  } catch (err) {
    log(WF, 'SAVE_ERROR', { detail: { error: err.message } });
  }
}

/**
 * Redact sensitive fields for API responses to the frontend.
 * API key is never sent in full — only last 4 characters.
 */
function redactForClient(config) {
  const redacted = { ...config };

  // Redact API key
  if (redacted.apiKey && redacted.apiKey.length > 4) {
    redacted.apiKeyRedacted = 'sk-ant-****' + redacted.apiKey.slice(-4);
  } else {
    redacted.apiKeyRedacted = '';
  }
  delete redacted.apiKey;

  // Redact server passwords
  if (Array.isArray(redacted.servers)) {
    redacted.servers = redacted.servers.map(s => {
      const copy = { ...s };
      delete copy.password;
      return copy;
    });
  }

  return redacted;
}

module.exports = { load, save, getDefault, redactForClient };
