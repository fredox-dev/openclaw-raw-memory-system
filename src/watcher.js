#!/usr/bin/env node
/**
 * watcher.js — Raw memory backup daemon v2.0
 *
 * Backs up all agent conversations from JSONL session files to daily
 * Markdown files. Zero token cost — pure file I/O.
 *
 * Originally created by oceanwh (MIT License).
 * Refactored by Pulse for OpenClaw plugin API v2 (2026-07-12).
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// ============================================================
// getConfig() — Centralized configuration resolver
// Priority: ENV > openclaw.json > fallback
// ============================================================

let _cachedConfig = null;

function getConfig() {
  if (_cachedConfig) return _cachedConfig;

  const home = process.env.HOME || process.env.USERPROFILE || os.homedir();

  // --- Base paths ---
  const openclawBase = process.env.OPENCLAW_BASE || path.join(home, '.openclaw');
  const agentsDir = process.env.OPENCLAW_AGENTS_DIR || path.join(openclawBase, 'agents');
  const backupBase = process.env.RAW_MEMORY_BACKUP_PATH || path.join(openclawBase, 'raw-memory-backup');
  const pollInterval = parseInt(process.env.RAW_MEMORY_POLL_INTERVAL) || 600000; // 10 min

  // --- Timezone ---
  const timezone = process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  // --- User label ---
  const userLabel = process.env.RAW_MEMORY_USER_LABEL || _autoDetectUserLabel(openclawBase) || 'User';

  // --- Agent mapping ---
  let agentMapping = {};

  // 1. Try environment variables
  const envKeys = ['RAW_MEMORY_AGENT_MAIN', 'RAW_MEMORY_AGENT_PULSE', 'RAW_MEMORY_AGENT_LUMINA',
                   'RAW_MEMORY_AGENT_ATLAS', 'RAW_MEMORY_AGENT_LEXIS'];
  for (const key of envKeys) {
    if (process.env[key]) {
      const agentId = key.replace('RAW_MEMORY_AGENT_', '').toLowerCase();
      agentMapping[agentId] = process.env[key];
    }
  }

  // 2. If no env vars found, try openclaw.json auto-detection
  if (Object.keys(agentMapping).length === 0) {
    agentMapping = _autoDetectAgentMapping(openclawBase);
  }

  // 3. Fallback: use agentId capitalized
  // (handled per-agent in _getAgentLabel)

  _cachedConfig = {
    openclawBase,
    agentsDir,
    backupBase,
    pollInterval,
    timezone,
    userLabel,
    agentMapping,
  };

  return _cachedConfig;
}

/**
 * Auto-detect user label from openclaw.json
 */
function _autoDetectUserLabel(openclawBase) {
  try {
    const configPath = path.join(openclawBase, 'openclaw.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    // Try to find user name in various locations
    if (config.user && config.user.name) return config.user.name;
    if (config.owner && config.owner.name) return config.owner.name;
    // Some configs have it in agents.defaults
    if (config.agents && config.agents.defaults && config.agents.defaults.userLabel) {
      return config.agents.defaults.userLabel;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Auto-detect agent mapping from openclaw.json
 */
function _autoDetectAgentMapping(openclawBase) {
  try {
    const configPath = path.join(openclawBase, 'openclaw.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const mapping = {};

    // Look for agents.list array
    const agentsList = config.agents && config.agents.list;
    if (Array.isArray(agentsList)) {
      for (const agent of agentsList) {
        const id = agent.id;
        const name = (agent.identity && agent.identity.name) ||
                     id.charAt(0).toUpperCase() + id.slice(1);
        if (id) mapping[id] = name;
      }
    }

    // Also look for agents as object
    if (config.agents && typeof config.agents === 'object' && !Array.isArray(config.agents)) {
      for (const [id, agentConfig] of Object.entries(config.agents)) {
        if (id === 'defaults') continue;
        if (typeof agentConfig === 'object' && agentConfig !== null) {
          const name = (agentConfig.identity && agentConfig.identity.name) ||
                       id.charAt(0).toUpperCase() + id.slice(1);
          mapping[id] = name;
        }
      }
    }

    return mapping;
  } catch {
    return {};
  }
}

/**
 * Get display label for an agent
 */
function _getAgentLabel(agentId, config) {
  return config.agentMapping[agentId] ||
         agentId.charAt(0).toUpperCase() + agentId.slice(1);
}

// ============================================================
// Logging
// ============================================================

function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [raw-backup] ${msg}`);
}

// ============================================================
// State management
// ============================================================

function getStateFile(config) {
  return path.join(config.backupBase, 'watcher-state-v2.json');
}

function readState(config) {
  try {
    return JSON.parse(fs.readFileSync(getStateFile(config), 'utf8'));
  } catch {
    return {};
  }
}

function writeState(state, config) {
  fs.writeFileSync(getStateFile(config), JSON.stringify(state, null, 2), 'utf8');
}

// ============================================================
// Timezone-aware date formatting
// ============================================================

function formatLocalDate(date, timezone) {
  // Use Intl with the resolved timezone for correct local date
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date); // Returns YYYY-MM-DD in en-CA locale
}

function formatLocalTime(date, timezone) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return formatter.format(date); // Returns HH:MM:SS
}

// ============================================================
// Parse JSONL and group by date
// ============================================================

function parseJsonlByDate(content, agentId, config) {
  const byDate = {};
  const lines = content.split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const obj = JSON.parse(line);
      if (obj.type !== 'message' || !obj.message) continue;

      const role = obj.message.role;
      if (role !== 'user' && role !== 'assistant') continue;

      // Extract text content
      let text = '';
      if (typeof obj.message.content === 'string') {
        text = obj.message.content.trim();
      } else if (Array.isArray(obj.message.content)) {
        const texts = obj.message.content
          .filter(x => x && x.type === 'text' && x.text)
          .map(x => x.text.trim());
        text = texts.join('\n').trim();
      }

      if (!text || text === 'HEARTBEAT_OK') continue;

      // Parse timestamp and format in local timezone
      const ts = obj.timestamp || new Date().toISOString();
      const d = new Date(ts);
      const dateStr = formatLocalDate(d, config.timezone);
      const timeStr = formatLocalTime(d, config.timezone);

      if (!byDate[dateStr]) byDate[dateStr] = [];

      const label = role === 'user'
        ? config.userLabel
        : _getAgentLabel(agentId, config);

      byDate[dateStr].push(`--- ${dateStr}T${timeStr} | source:gateway ---\n**${label}:** ${text}\n`);
    } catch {
      // skip bad lines
    }
  }

  return byDate;
}

// ============================================================
// Append to markdown file (no overwrite)
// ============================================================

function appendToMarkdown(filePath, entries) {
  if (!fs.existsSync(filePath)) {
    const dateStr = path.basename(filePath, '.md');
    fs.writeFileSync(filePath, `# RAW: ${dateStr}\n\n`, 'utf8');
  }
  fs.appendFileSync(filePath, entries.join('\n'), 'utf8');
}

// ============================================================
// Backup a single agent's sessions
// ============================================================

function backupAgent(agentId, sessionsPath, config) {
  const state = readState(config);

  try {
    const backupDir = path.join(config.backupBase, agentId);
    fs.mkdirSync(backupDir, { recursive: true });

    // Scan all JSONL files (including history and reset files)
    const allFiles = fs.readdirSync(sessionsPath)
      .filter(f =>
        (f.endsWith('.jsonl') || f.includes('.jsonl.reset.')) &&
        !f.includes('.trajectory.') &&
        f !== 'sessions.json'
      );

    for (const file of allFiles) {
      const filePath = path.join(sessionsPath, file);
      const sessionId = file.replace('.jsonl', '');

      const sessionStateKey = agentId + ':' + sessionId;
      const prevState = state[sessionStateKey] || { lastSize: 0 };

      // Skip if file hasn't changed
      const stat = fs.statSync(filePath);
      if (stat.size <= prevState.lastSize) continue;

      // Read and parse
      const content = fs.readFileSync(filePath, 'utf8');
      const byDate = parseJsonlByDate(content, agentId, config);

      // Write by date
      for (const [dateStr, entries] of Object.entries(byDate)) {
        const mdFile = path.join(backupDir, dateStr + '.md');
        appendToMarkdown(mdFile, entries);
      }

      // Update state
      state[sessionStateKey] = { lastSize: stat.size, lastCheck: Date.now() };

      log(`Processed: ${agentId}/${sessionId} (${Math.round(stat.size / 1024)}KB)`);
    }

    writeState(state, config);
  } catch (e) {
    log(`Error processing ${agentId}: ${e.message}`);
  }
}

// ============================================================
// Discover agents from sessions directory
// ============================================================

function getAgentSessions(config) {
  const agents = [];

  try {
    const dirs = fs.readdirSync(config.agentsDir);
    for (const dir of dirs) {
      const sessionsPath = path.join(config.agentsDir, dir, 'sessions');
      if (fs.existsSync(sessionsPath)) {
        agents.push({ agentId: dir, sessionsPath });
      }
    }
  } catch (e) {
    log('Error reading agents dir: ' + e.message);
  }

  return agents;
}

// ============================================================
// Main poll cycle
// ============================================================

function poll(config) {
  const agents = getAgentSessions(config);
  for (const agent of agents) {
    backupAgent(agent.agentId, agent.sessionsPath, config);
  }
}

// ============================================================
// Start (when called directly as a daemon)
// ============================================================

function start() {
  const config = getConfig();

  log('Backup watcher v2.0 starting...');
  log('Backup destination: ' + config.backupBase);
  log('Timezone: ' + config.timezone);
  log(`Agent mapping: ${Object.keys(config.agentMapping).length} agent(s) configured`);
  log('Format: markdown, one file per day');

  // Ensure backup directory exists
  fs.mkdirSync(config.backupBase, { recursive: true });

  // Initial backup
  poll(config);

  // Schedule periodic polling
  const interval = setInterval(() => poll(config), config.pollInterval);

  log('Watcher running, polling every ' + (config.pollInterval / 1000) + 's');

  // Graceful shutdown
  const shutdown = () => {
    log('Watcher shutting down');
    clearInterval(interval);
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return { config, interval };
}

// Export for use by dist/index.js
module.exports = {
  getConfig,
  poll,
  start,
  backupAgent,
  getAgentSessions,
  parseJsonlByDate,
  formatLocalDate,
  formatLocalTime,
};

// Run as standalone daemon if executed directly
if (require.main === module) {
  start();
}
