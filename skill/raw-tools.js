#!/usr/bin/env node
/**
 * raw-tools.js — 原始记忆库工具
 * 
 * 用法：
 *   node raw-tools.js save --agent <id>              增量保存当前 session
 *   node raw-tools.js save --agent <id> --all        提取所有历史 session
 *   node raw-tools.js search --agent <id> --query <q> [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--limit N]
 *   node raw-tools.js status --agent <id>            查看原始记忆库状态
 * 
 * 支持 agent: loli, main
 * 零外部依赖
 */

const fs = require('fs');
const path = require('path');

// ============================================================
// 配置（可通过环境变量覆盖）
// ============================================================

const USERPROFILE = process.env.USERPROFILE || process.env.HOME || '';
const WORKSPACE_BASE = process.env.OPENCLAW_WORKSPACE_BASE || path.join(USERPROFILE, '.openclaw');
const AGENTS_DIR = process.env.OPENCLAW_AGENTS_DIR || path.join(WORKSPACE_BASE, 'agents');

// Agent workspace 映射（自动检测或从环境变量读取）
function getAgentWorkspaces() {
  // 从环境变量读取（格式：AGENT_WORKSPACES=loli:workspace-loli,main:workspace）
  const envMapping = process.env.AGENT_WORKSPACES;
  if (envMapping) {
    const workspaces = {};
    envMapping.split(',').forEach(function(item) {
      const parts = item.split(':');
      if (parts.length === 2) {
        workspaces[parts[0].trim()] = path.join(WORKSPACE_BASE, parts[1].trim());
      }
    });
    return workspaces;
  }
  
  // 自动检测：扫描 workspace 目录下的所有 workspace-* 文件夹
  const workspaces = {};
  try {
    const dirs = fs.readdirSync(WORKSPACE_BASE);
    for (const dir of dirs) {
      if (dir.startsWith('workspace-')) {
        const agentId = dir.replace('workspace-', '');
        workspaces[agentId] = path.join(WORKSPACE_BASE, dir);
      } else if (dir === 'workspace') {
        // 默认 workspace 对应 main agent
        workspaces['main'] = path.join(WORKSPACE_BASE, dir);
      }
    }
  } catch (e) {
    // 如果检测失败，返回空对象
  }
  
  return workspaces;
}

const AGENT_WORKSPACES = getAgentWorkspaces();

// ============================================================
// 辅助
// ============================================================

function getRawDir(agentId) {
  const ws = AGENT_WORKSPACES[agentId];
  if (!ws) throw new Error('Unknown agent: ' + agentId);
  const name = agentId.charAt(0).toUpperCase() + agentId.slice(1);
  return path.join(ws, 'memory', 'raw', name);
}

function getStateFile(agentId) {
  return path.join(getRawDir(agentId), 'state.json');
}

function getSessionsDir(agentId) {
  return path.join(AGENTS_DIR, agentId, 'sessions');
}

function log(msg) {
  console.error('[raw-tools] ' + msg);
}

// ============================================================
// 提取消息文本
// ============================================================

function extractText(msg) {
  var role = msg.role;
  if (!role || (role !== 'user' && role !== 'assistant')) return null;

  var text = '';
  if (typeof msg.content === 'string') {
    text = msg.content.trim();
  } else if (Array.isArray(msg.content)) {
    var parts = msg.content
      .filter(function(x) { return x && x.type === 'text' && x.text; })
      .map(function(x) { return x.text.trim(); });
    text = parts.join('\n').trim();
  }

  if (!text || text === 'HEARTBEAT_OK') return null;
  return text;
}

function roleLabel(role, agentId) {
  return role === 'user' ? '主人' : agentId.charAt(0).toUpperCase() + agentId.slice(1);
}

// ============================================================
// SAVE — 增量保存
// ============================================================

function saveSession(agentId) {
  var rawDir = getRawDir(agentId);
  var stateFile = getStateFile(agentId);
  var sessionsDir = getSessionsDir(agentId);

  fs.mkdirSync(rawDir, { recursive: true });

  // 读 state
  var state = { lastId: '', lastTime: '', lastSave: '', lastMsgCount: 0 };
  try {
    state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch (e) { /* first run */ }

  // 读 sessions.json 找出当前 session
  var sessionsJsonPath = path.join(sessionsDir, 'sessions.json');
  var currentSessionId = '';
  try {
    var sessionsRaw = fs.readFileSync(sessionsJsonPath, 'utf8');
    var sessions = JSON.parse(sessionsRaw);
    var mainKey = 'agent:' + agentId + ':main';
    if (sessions[mainKey] && sessions[mainKey].sessionId) {
      currentSessionId = sessions[mainKey].sessionId;
    }
  } catch (e) {
    log('Cannot read sessions.json: ' + e.message);
    return { written: 0, error: e.message };
  }

  if (!currentSessionId) {
    log('No active session found');
    return { written: 0, error: 'No active session' };
  }

  var jsonlFile = path.join(sessionsDir, currentSessionId + '.jsonl');
  if (!fs.existsSync(jsonlFile)) {
    log('Session file not found: ' + jsonlFile);
    return { written: 0, error: 'Session file not found' };
  }

  log('Session: ' + currentSessionId);
  log('Last ID: ' + (state.lastId || '(none)'));

  // 读 JSONL
  var content = fs.readFileSync(jsonlFile, 'utf8');
  var lines = content.split('\n').filter(function(l) { return l.trim(); });

  // 检查 lastId 是否有效
  var lastIdValid = !state.lastId;
  if (!lastIdValid) {
    for (var i = 0; i < lines.length; i++) {
      try {
        var obj = JSON.parse(lines[i]);
        if (obj.type === 'message' && obj.id === state.lastId) {
          lastIdValid = true;
          break;
        }
      } catch (e) { /* skip */ }
    }
  }

  if (!lastIdValid) {
    log('Session changed, resetting lastId (was: ' + state.lastId + ')');
    state.lastId = '';
  }

  // 增量提取
  var found = !state.lastId;
  var output = [];
  var newLastId = state.lastId;
  var written = 0;
  var skipped = 0;

  for (var i = 0; i < lines.length; i++) {
    try {
      var obj = JSON.parse(lines[i]);
      if (obj.type !== 'message' || !obj.message) continue;

      if (!found) {
        if (obj.id === state.lastId) { found = true; }
        continue;
      }

      var text = extractText(obj.message);
      if (!text) { skipped++; continue; }

      var label = roleLabel(obj.message.role, agentId);
      var ts = obj.timestamp || new Date().toISOString();

      output.push('--- ' + ts + ' | source:gateway ---');
      output.push('**' + label + '：** ' + text);
      output.push('');

      newLastId = obj.id;
      written++;
    } catch (e) { /* skip bad lines */ }
  }

  // 统计消息总数（用于 5% 增量检查）
  var totalMsgCount = 0;
  for (var i = 0; i < lines.length; i++) {
    try {
      var obj = JSON.parse(lines[i]);
      if (obj.type === 'message' && obj.message && 
          (obj.message.role === 'user' || obj.message.role === 'assistant')) {
        totalMsgCount++;
      }
    } catch (e) { /* skip */ }
  }

  if (written > 0) {
    var dateStr = new Date().toISOString().slice(0, 10);
    var rawFile = path.join(rawDir, dateStr + '.md');

    if (!fs.existsSync(rawFile)) {
      fs.writeFileSync(rawFile, '# RAW: ' + dateStr + '\n\n', 'utf8');
    }

    fs.appendFileSync(rawFile, output.join('\n'), 'utf8');

    state.lastId = newLastId;
    state.lastTime = new Date().toISOString();
    state.lastSave = new Date().toISOString();
    state.lastMsgCount = totalMsgCount;
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf8');

    log('Appended: ' + written + ' msgs, skipped: ' + skipped);
    log('Total msgs in session: ' + totalMsgCount);
    log('Raw file: ' + rawFile);
  } else {
    log('No new messages. Total msgs: ' + totalMsgCount);
  }

  return { written: written, skipped: skipped, totalMsgs: totalMsgCount };
}

// ============================================================
// SAVE --all — 提取所有历史 session
// ============================================================

function saveAllSessions(agentId) {
  var rawDir = getRawDir(agentId);
  var sessionsDir = getSessionsDir(agentId);
  fs.mkdirSync(rawDir, { recursive: true });

  var files = fs.readdirSync(sessionsDir)
    .filter(function(f) {
      return f.endsWith('.jsonl') &&
        f.indexOf('.reset.') === -1 &&
        f.indexOf('.trajectory.') === -1 &&
        f !== 'sessions.json';
    })
    .sort();

  log('Found ' + files.length + ' historical session files');

  var byDate = {};
  var totalWritten = 0;
  var totalSkipped = 0;

  for (var f = 0; f < files.length; f++) {
    var filePath = path.join(sessionsDir, files[f]);
    var content;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch (e) { totalSkipped++; continue; }

    var lines = content.split('\n').filter(function(l) { return l.trim(); });

    for (var i = 0; i < lines.length; i++) {
      try {
        var obj = JSON.parse(lines[i]);
        if (obj.type !== 'message' || !obj.message) continue;

        var text = extractText(obj.message);
        if (!text) continue;
        if (!obj.timestamp) continue;

        var dateStr = obj.timestamp.slice(0, 10);
        var label = roleLabel(obj.message.role, agentId);
        var entry = '--- ' + obj.timestamp + ' | source:gateway ---\n**' + label + '：** ' + text + '\n\n';

        if (!byDate[dateStr]) byDate[dateStr] = [];
        byDate[dateStr].push(entry);
        totalWritten++;
      } catch (e) { totalSkipped++; }
    }
  }

  var dateKeys = Object.keys(byDate).sort();
  for (var d = 0; d < dateKeys.length; d++) {
    var rawFile = path.join(rawDir, dateKeys[d] + '.md');
    fs.writeFileSync(rawFile, '# RAW: ' + dateKeys[d] + '\n\n' + byDate[dateKeys[d]].join(''), 'utf8');
    log('Wrote ' + byDate[dateKeys[d]].length + ' entries to ' + dateKeys[d] + '.md');
  }

  log('Total: ' + totalWritten + ' extracted, ' + totalSkipped + ' skipped, ' + dateKeys.length + ' date files');
  return { written: totalWritten, skipped: totalSkipped, dates: dateKeys.length };
}

// ============================================================
// SEARCH — 检索
// ============================================================

function search(agentId, query, opts) {
  var rawDir = getRawDir(agentId);
  if (!fs.existsSync(rawDir)) {
    return { results: [], error: 'Raw memory not found for ' + agentId };
  }

  opts = opts || {};
  var fromDate = opts.from || '2000-01-01';
  var toDate = opts.to || '2099-12-31';
  var limit = opts.limit || 3;
  var contextSize = opts.context || 3; // 前后各3句

  var files = fs.readdirSync(rawDir)
    .filter(function(f) { return f.endsWith('.md') && f !== 'state.json'; })
    .sort();

  var results = [];
  var queryLower = query.toLowerCase();
  var keywords = queryLower.split(/\s+/).filter(function(k) { return k.length > 0; });

  for (var f = 0; f < files.length; f++) {
    var dateStr = files[f].replace('.md', '');
    if (dateStr < fromDate || dateStr > toDate) continue;

    var content = fs.readFileSync(path.join(rawDir, files[f]), 'utf8');
    var blocks = content.split(/\n(?=--- \d{4})/);

    for (var b = 0; b < blocks.length; b++) {
      var blockLower = blocks[b].toLowerCase();
      var matchAll = keywords.every(function(k) { return blockLower.indexOf(k) !== -1; });
      if (!matchAll) continue;

      // 找到目标句，扩展上下文：前3句 + 目标句 + 后3句
      var contextStart = Math.max(0, b - contextSize);
      var contextEnd = Math.min(blocks.length - 1, b + contextSize);
      var contextBlocks = [];
      for (var i = contextStart; i <= contextEnd; i++) {
        contextBlocks.push(blocks[i].trim());
      }

      var tsMatch = blocks[b].match(/--- (.+?) \| source:gateway ---/);
      var timestamp = tsMatch ? tsMatch[1] : '';
      var snippet = contextBlocks.join('\n\n');

      // 限制总长度
      if (snippet.length > 1500) snippet = snippet.slice(0, 1500) + '...';

      results.push({ 
        timestamp: timestamp, 
        date: dateStr, 
        snippet: snippet, 
        source: files[f],
        contextRange: (contextSize * 2 + 1) + ' sentences'
      });
    }
  }

  results.sort(function(a, b) {
    return (b.timestamp || '').localeCompare(a.timestamp || '');
  });

  return { results: results.slice(0, limit), total: results.length };
}

// ============================================================
// STATUS — 查看状态
// ============================================================

function showStatus(agentId) {
  var rawDir = getRawDir(agentId);
  var stateFile = getStateFile(agentId);

  var info = { agent: agentId, rawDir: rawDir };
  info.exists = fs.existsSync(rawDir);

  if (info.exists) {
    var files = fs.readdirSync(rawDir)
      .filter(function(f) { return f.endsWith('.md'); });
    info.fileCount = files.length;

    var totalBytes = 0;
    for (var i = 0; i < files.length; i++) {
      try { totalBytes += fs.statSync(path.join(rawDir, files[i])).size; } catch (e) {}
    }
    info.totalBytes = totalBytes;
    info.totalKB = Math.round(totalBytes / 1024);
  }

  try {
    info.state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch (e) {
    info.state = '(not initialized)';
  }

  return info;
}

// ============================================================
// 主入口
// ============================================================

function main() {
  var args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('Usage:');
    console.log('  node raw-tools.js save --agent <id>');
    console.log('  node raw-tools.js save --agent <id> --all');
    console.log('  node raw-tools.js search --agent <id> --query <q> [--from YYYY-MM-DD] [--to] [--limit N]');
    console.log('  node raw-tools.js status --agent <id>');
    console.log('Agents: loli, main');
    process.exit(0);
  }

  var cmd = args[0];
  var agentId = '';
  var query = '';
  var fromDate = '';
  var toDate = '';
  var limit = 5;
  var allSessions = false;

  for (var i = 1; i < args.length; i++) {
    if (args[i] === '--agent' || args[i] === '-a') { agentId = args[++i] || ''; }
    else if (args[i] === '--query' || args[i] === '-q') { query = args[++i] || ''; }
    else if (args[i] === '--from' || args[i] === '-f') { fromDate = args[++i] || ''; }
    else if (args[i] === '--to' || args[i] === '-t') { toDate = args[++i] || ''; }
    else if (args[i] === '--limit' || args[i] === '-l') { limit = parseInt(args[++i]) || 5; }
    else if (args[i] === '--all') { allSessions = true; }
  }

  if (!agentId) agentId = 'loli';
  if (!AGENT_WORKSPACES[agentId]) {
    console.error('Unknown agent: ' + agentId);
    process.exit(1);
  }

  if (cmd === 'save') {
    var result = allSessions ? saveAllSessions(agentId) : saveSession(agentId);
    console.log(JSON.stringify(result, null, 2));
  } else if (cmd === 'search') {
    if (!query) { console.error('--query is required for search'); process.exit(1); }
    var result = search(agentId, query, { from: fromDate, to: toDate, limit: limit });
    console.log(JSON.stringify(result, null, 2));
  } else if (cmd === 'status') {
    var info = showStatus(agentId);
    console.log(JSON.stringify(info, null, 2));
  } else {
    console.error('Unknown command: ' + cmd);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { saveSession: saveSession, saveAllSessions: saveAllSessions, search: search };
