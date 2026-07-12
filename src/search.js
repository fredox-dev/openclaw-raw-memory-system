#!/usr/bin/env node
/**
 * search.js — Raw Memory Search Tool
 *
 * Search raw conversation backups by keyword with context window.
 * Zero external dependencies.
 *
 * Forked from oceanwh/openclaw-memory-system, refactored v2.0.0
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// ============================================================
// Config — reuse getConfig from watcher
// ============================================================

function getConfig() {
  const HOME = os.homedir();
  const openclawJsonPath = path.join(HOME, '.openclaw', 'openclaw.json');

  let openclawConfig = {};
  try {
    openclawConfig = JSON.parse(fs.readFileSync(openclawJsonPath, 'utf8'));
  } catch (e) {
    // openclaw.json not available
  }

  const backupBase =
    process.env.RAW_MEMORY_BACKUP_PATH ||
    path.join(HOME, '.openclaw', 'raw-memory-backup');

  const workspaceBase =
    process.env.OPENCLAW_WORKSPACE_BASE ||
    path.join(HOME, '.openclaw');

  // Auto-detect agent workspaces
  function getAgentWorkspaces() {
    // ENV override (format: agentId:dir-name,agentId2:dir-name2)
    const envMapping = process.env.AGENT_WORKSPACES;
    if (envMapping) {
      const workspaces = {};
      envMapping.split(',').forEach(item => {
        const parts = item.split(':');
        if (parts.length === 2) {
          workspaces[parts[0].trim()] = path.join(workspaceBase, parts[1].trim());
        }
      });
      return workspaces;
    }

    // Auto-detect: scan workspace-* directories
    const workspaces = {};
    try {
      const dirs = fs.readdirSync(workspaceBase);
      for (const dir of dirs) {
        if (dir.startsWith('workspace-')) {
          const agentId = dir.replace('workspace-', '');
          workspaces[agentId] = path.join(workspaceBase, dir);
        } else if (dir === 'workspace') {
          workspaces['main'] = path.join(workspaceBase, dir);
        }
      }
    } catch (e) {
      // detection failed
    }
    return workspaces;
  }

  return { backupBase, workspaceBase, getAgentWorkspaces };
}

// ============================================================
// Resolve raw backup directory for an agent
// ============================================================

function getRawDir(agentId, config) {
  // Primary: backup base (watcher output)
  const backupPath = path.join(config.backupBase, agentId);
  if (fs.existsSync(backupPath)) return backupPath;

  // Fallback: workspace-based path (legacy)
  const workspaces = config.getAgentWorkspaces();
  const ws = workspaces[agentId];
  if (ws) {
    const name = agentId.charAt(0).toUpperCase() + agentId.slice(1);
    const legacyPath = path.join(ws, 'memory', 'raw', name);
    if (fs.existsSync(legacyPath)) return legacyPath;
  }

  return backupPath; // return default even if not exists
}

// ============================================================
// Extract text from message
// ============================================================

function extractText(msg) {
  const role = msg.role;
  if (!role || (role !== 'user' && role !== 'assistant')) return null;

  let text = '';
  if (typeof msg.content === 'string') {
    text = msg.content.trim();
  } else if (Array.isArray(msg.content)) {
    const parts = msg.content
      .filter(x => x && x.type === 'text' && x.text)
      .map(x => x.text.trim());
    text = parts.join('\n').trim();
  }

  if (!text || text === 'HEARTBEAT_OK') return null;
  return text;
}

// ============================================================
// SEARCH — keyword match with context window
// ============================================================

function search(agentId, query, opts) {
  const config = getConfig();
  const rawDir = getRawDir(agentId, config);

  if (!fs.existsSync(rawDir)) {
    return { results: [], error: `Raw memory not found for agent: ${agentId}` };
  }

  opts = opts || {};
  const fromDate = opts.from || '2000-01-01';
  const toDate = opts.to || '2099-12-31';
  const limit = opts.limit || 3;
  const contextSize = opts.context || 3; // sentences before/after

  const files = fs.readdirSync(rawDir)
    .filter(f => f.endsWith('.md') && f !== 'state.json')
    .sort();

  const results = [];
  const queryLower = query.toLowerCase();
  const keywords = queryLower.split(/\s+/).filter(k => k.length > 0);

  for (const file of files) {
    const dateStr = file.replace('.md', '');
    if (dateStr < fromDate || dateStr > toDate) continue;

    const content = fs.readFileSync(path.join(rawDir, file), 'utf8');
    const blocks = content.split(/\n(?=--- )/);

    for (let b = 0; b < blocks.length; b++) {
      const blockLower = blocks[b].toLowerCase();
      const matchAll = keywords.every(k => blockLower.includes(k));
      if (!matchAll) continue;

      // Context window: N sentences before + target + N after
      const contextStart = Math.max(0, b - contextSize);
      const contextEnd = Math.min(blocks.length - 1, b + contextSize);
      const contextBlocks = [];
      for (let i = contextStart; i <= contextEnd; i++) {
        contextBlocks.push(blocks[i].trim());
      }

      const tsMatch = blocks[b].match(/--- (.+?) \| source:gateway ---/);
      const timestamp = tsMatch ? tsMatch[1] : '';
      let snippet = contextBlocks.join('\n\n');

      // Truncate if too long
      if (snippet.length > 1500) snippet = snippet.slice(0, 1500) + '...';

      results.push({
        timestamp,
        date: dateStr,
        snippet,
        source: file,
        contextRange: `${contextSize * 2 + 1} sentences`,
      });
    }
  }

  // Sort newest first
  results.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

  return { results: results.slice(0, limit), total: results.length };
}

// ============================================================
// STATUS — show backup state
// ============================================================

function showStatus(agentId) {
  const config = getConfig();
  const rawDir = getRawDir(agentId, config);

  const info = { agent: agentId, rawDir };

  info.exists = fs.existsSync(rawDir);

  if (info.exists) {
    const files = fs.readdirSync(rawDir).filter(f => f.endsWith('.md'));
    info.fileCount = files.length;

    let totalBytes = 0;
    for (const file of files) {
      try {
        totalBytes += fs.statSync(path.join(rawDir, file)).size;
      } catch (e) { /* skip */ }
    }
    info.totalBytes = totalBytes;
    info.totalKB = Math.round(totalBytes / 1024);

    // Date range
    if (files.length > 0) {
      const sorted = files.sort();
      info.earliestDate = sorted[0].replace('.md', '');
      info.latestDate = sorted[sorted.length - 1].replace('.md', '');
    }
  }

  return info;
}

// ============================================================
// CLI entry point
// ============================================================

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('Usage:');
    console.log('  node search.js search --agent <id> --query <q> [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--limit N]');
    console.log('  node search.js status --agent <id>');
    process.exit(0);
  }

  const cmd = args[0];
  let agentId = '';
  let query = '';
  let fromDate = '';
  let toDate = '';
  let limit = 3;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--agent' || args[i] === '-a') { agentId = args[++i] || ''; }
    else if (args[i] === '--query' || args[i] === '-q') { query = args[++i] || ''; }
    else if (args[i] === '--from' || args[i] === '-f') { fromDate = args[++i] || ''; }
    else if (args[i] === '--to' || args[i] === '-t') { toDate = args[++i] || ''; }
    else if (args[i] === '--limit' || args[i] === '-l') { limit = parseInt(args[++i], 10) || 3; }
  }

  if (!agentId) {
    console.error('--agent is required');
    process.exit(1);
  }

  if (cmd === 'search') {
    if (!query) { console.error('--query is required for search'); process.exit(1); }
    const result = search(agentId, query, { from: fromDate, to: toDate, limit });
    console.log(JSON.stringify(result, null, 2));
  } else if (cmd === 'status') {
    const info = showStatus(agentId);
    console.log(JSON.stringify(info, null, 2));
  } else {
    console.error('Unknown command: ' + cmd);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { search, showStatus, getRawDir, extractText };
