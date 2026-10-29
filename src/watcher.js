#!/usr/bin/env node
/**
 * watcher.js — Raw memory backup daemon v3.0
 *
 * Backs up all agent conversations to daily Markdown files.
 * Dual storage support, detected at runtime per agent:
 *   - SQLite (OpenClaw >= 2026.8.1): agents/<id>/agent/openclaw-agent.sqlite
 *     (events may be zstd-compressed; requires Node >= 24)
 *   - Legacy JSONL: agents/<id>/sessions/*.jsonl
 * Zero token cost — pure file I/O. Zero npm dependencies.
 *
 * Originally created by oceanwh (MIT License).
 * Refactored by Pulse for OpenClaw plugin API v2 (2026-07-12).
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const zlib = require('zlib');

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
  return path.join(config.backupBase, 'watcher-state-v3.json');
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

// NOTE: message rendering duplicated in renderEventToEntry() (SQLite mode) — keep in sync.
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
// SQLite storage (OpenClaw >= 2026.8.1) — dual-mode support
// Sessions moved from agents/<id>/sessions/*.jsonl to
// agents/<id>/agent/openclaw-agent.sqlite (events may be zstd-compressed).
// Storage mode is detected at runtime, per agent.
// ============================================================

function getSqliteDbPath(agentDir) {
  return path.join(agentDir, 'agent', 'openclaw-agent.sqlite');
}

function decodeEventRow(row) {
  try {
    if (row.event_json != null) return row.event_json;
    if (row.event_zstd != null) {
      if (typeof zlib.zstdDecompressSync !== 'function') {
        throw new Error('zstd-compressed events require Node >= 24');
      }
      return zlib.zstdDecompressSync(row.event_zstd).toString('utf8');
    }
  } catch (e) {
    log('decodeEventRow failed: ' + e.message);
  }
  return null;
}

// Render ONE parsed event to a markdown entry.
// KEEP IN SYNC with parseJsonlByDate() (legacy JSONL mode).
function renderEventToEntry(obj, agentId, config) {
  if (obj.type !== 'message' || !obj.message) return null;

  const role = obj.message.role;
  if (role !== 'user' && role !== 'assistant') return null;

  let text = '';
  if (typeof obj.message.content === 'string') {
    text = obj.message.content.trim();
  } else if (Array.isArray(obj.message.content)) {
    const texts = obj.message.content
      .filter(x => x && x.type === 'text' && x.text)
      .map(x => x.text.trim());
    text = texts.join('\n').trim();
  }

  if (!text || text === 'HEARTBEAT_OK') return null;

  const ts = obj.timestamp || new Date().toISOString();
  const d = new Date(ts);
  const dateStr = formatLocalDate(d, config.timezone);
  const timeStr = formatLocalTime(d, config.timezone);

  const label = role === 'user'
    ? config.userLabel
    : _getAgentLabel(agentId, config);

  return {
    dateStr,
    entry: `--- ${dateStr}T${timeStr} | source:gateway ---\n**${label}:** ${text}\n`
  };
}

// Where to start collecting events on first SQLite backup (no state yet).
// Priority: RAW_MEMORY_BACKFILL_FROM > RAW_MEMORY_BACKFILL_DAYS >
// midnight of the last existing daily .md (1-day overlap by design,
// so the tail of the last backed-up day is never lost) > full history.
function determineBackfillFromMs(agentId, backupDir) {
  if (process.env.RAW_MEMORY_BACKFILL_FROM) {
    const t = Date.parse(process.env.RAW_MEMORY_BACKFILL_FROM);
    if (!isNaN(t)) {
      log(`${agentId}: backfill from RAW_MEMORY_BACKFILL_FROM`);
      return t;
    }
    log('RAW_MEMORY_BACKFILL_FROM is not a valid ISO date — ignoring');
  }
  if (process.env.RAW_MEMORY_BACKFILL_DAYS !== undefined) {
    const d = parseInt(process.env.RAW_MEMORY_BACKFILL_DAYS);
    if (!isNaN(d) && d >= 0) {
      log(`${agentId}: backfill from RAW_MEMORY_BACKFILL_DAYS=${d}`);
      return Date.now() - d * 86400000;
    }
  }
  try {
    const files = fs.readdirSync(backupDir)
      .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
      .sort();
    if (files.length > 0) {
      const last = files[files.length - 1].replace('.md', '');
      const t = Date.parse(last + 'T00:00:00');
      if (!isNaN(t)) {
        log(`${agentId}: no state — backfilling from ${last} (overlap on last day by design)`);
        return t;
      }
    }
  } catch { /* backupDir may not exist yet */ }
  log(`${agentId}: no state, no existing backups — collecting FULL history (first run may take a while)`);
  return null;
}

// v2 → v3: same state format, new filename. Keeps legacy JSONL offsets.
function migrateStateFile(config) {
  const v3 = getStateFile(config);
  const v2 = path.join(path.dirname(v3), 'watcher-state-v2.json');
  try {
    if (!fs.existsSync(v3) && fs.existsSync(v2)) {
      fs.renameSync(v2, v3);
      log('State migrated: watcher-state-v2.json → watcher-state-v3.json');
    }
  } catch (e) {
    log('State migration failed: ' + e.message);
  }
}

function backupAgentSqlite(agentId, agentDir, config) {
  const state = readState(config);

  try {
    let DatabaseSync;
    try {
      ({ DatabaseSync } = require('node:sqlite'));
    } catch {
      log(`${agentId}: node:sqlite unavailable (Node < 22.5) — cannot read SQLite storage`);
      return;
    }

    const backupDir = path.join(config.backupBase, agentId);
    fs.mkdirSync(backupDir, { recursive: true });

    const dbPath = getSqliteDbPath(agentDir);
    const db = new DatabaseSync(dbPath, { readOnly: true });

    const prefix = 'sqlite:' + agentId + ':';
    const hasState = Object.keys(state).some(k => k.startsWith(prefix));
    const backfillFromMs = hasState ? undefined : determineBackfillFromMs(agentId, backupDir);

    const sessions = db
      .prepare('SELECT session_id, MAX(seq) AS maxSeq FROM transcript_events GROUP BY session_id')
      .all();

    let totalNew = 0;

    for (const s of sessions) {
      const key = prefix + s.session_id;
      const prev = state[key] || { lastSeq: 0 };
      let fromSeq = prev.lastSeq;

      if (s.maxSeq < prev.lastSeq) {
        log(`Warning: ${agentId}/${s.session_id.slice(0, 8)} seq regressed (${s.maxSeq} < ${prev.lastSeq}) — session reset? Re-reading (duplicates possible)`);
        fromSeq = 0;
      }
      if (fromSeq >= s.maxSeq) continue;

      const byDate = {};
      let cursor = fromSeq;

      // Batched read to bound memory on large sessions
      for (;;) {
        const rows = db
          .prepare('SELECT seq, event_json, event_zstd, created_at FROM transcript_events WHERE session_id = ? AND seq > ? ORDER BY seq LIMIT 2000')
          .all(s.session_id, cursor);
        if (rows.length === 0) break;

        for (const row of rows) {
          cursor = row.seq;
          if (backfillFromMs !== undefined && backfillFromMs !== null &&
              row.created_at != null && row.created_at < backfillFromMs) continue;
          const raw = decodeEventRow(row);
          if (!raw) continue;
          try {
            const rendered = renderEventToEntry(JSON.parse(raw), agentId, config);
            if (rendered) {
              if (!byDate[rendered.dateStr]) byDate[rendered.dateStr] = [];
              byDate[rendered.dateStr].push(rendered.entry);
            }
          } catch { /* skip bad events */ }
        }

        if (rows.length < 2000) break;
      }

      for (const [dateStr, entries] of Object.entries(byDate)) {
        appendToMarkdown(path.join(backupDir, dateStr + '.md'), entries);
      }

      totalNew += Object.values(byDate).reduce((n, a) => n + a.length, 0);
      state[key] = { lastSeq: s.maxSeq, lastCheck: Date.now() };
    }

    db.close();
    writeState(state, config);
    if (totalNew > 0) log(`Processed (sqlite): ${agentId} — ${totalNew} new message(s)`);
  } catch (e) {
    log(`Error processing ${agentId} (sqlite): ${e.message}`);
  }
}

// Discover agents and detect storage mode at runtime.
// SQLite DB present → sqlite mode; else legacy sessions/*.jsonl.
function discoverAgents(config) {
  const agents = [];
  try {
    const dirs = fs.readdirSync(config.agentsDir);
    for (const dir of dirs) {
      if (dir.startsWith('.')) continue;
      const agentDir = path.join(config.agentsDir, dir);
      try {
        if (!fs.statSync(agentDir).isDirectory()) continue;
      } catch { continue; }

      if (fs.existsSync(getSqliteDbPath(agentDir))) {
        agents.push({ agentId: dir, agentDir, storage: 'sqlite' });
        continue;
      }

      const sessionsPath = path.join(agentDir, 'sessions');
      if (fs.existsSync(sessionsPath) && fs.statSync(sessionsPath).isDirectory()) {
        agents.push({ agentId: dir, sessionsPath, storage: 'jsonl' });
      }
    }
  } catch (e) {
    log('Error discovering agents: ' + e.message);
  }
  return agents;
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
  // Runtime storage detection: sqlite first, then legacy jsonl
  const agents = discoverAgents(config);
  for (const agent of agents) {
    if (agent.storage === 'sqlite') {
      backupAgentSqlite(agent.agentId, agent.agentDir, config);
    } else {
      backupAgent(agent.agentId, agent.sessionsPath, config); // legacy JSONL
    }
  }
}

// ============================================================
// Start (when called directly as a daemon)
// ============================================================

function start() {
  const config = getConfig();

  log('Backup watcher v3.0 starting...');
  log('Backup destination: ' + config.backupBase);
  log('Timezone: ' + config.timezone);
  log(`Agent mapping: ${Object.keys(config.agentMapping).length} agent(s) configured`);
  log('Format: markdown, one file per day');

  // Ensure backup directory exists
  fs.mkdirSync(config.backupBase, { recursive: true });

  // v2→v3 state migration — must run BEFORE any poll writes the new state file
  migrateStateFile(config);

  // Initial backup
  poll(config);

  // --once: single poll then exit (testing / cron mode)
  if (process.argv.includes('--once')) {
    log('One-shot mode (--once)');
    poll(config);
    log('One-shot poll complete.');
    process.exit(0);
  }

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
