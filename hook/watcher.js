#!/usr/bin/env node
/**
 * watcher.js — 原始记忆库备份守护进程 v2
 * 
 * 按天为单位备份，一天一个 markdown 文件，只追加增量。
 * 零 token 消耗，纯文件操作。
 */

const fs = require('fs');
const path = require('path');

// ============================================================
// 配置（可通过环境变量覆盖）
// ============================================================

const USERPROFILE = process.env.USERPROFILE || process.env.HOME || '';
const AGENTS_DIR = process.env.OPENCLAW_AGENTS_DIR || path.join(USERPROFILE, '.openclaw', 'agents');
const BACKUP_BASE = process.env.RAW_MEMORY_BACKUP_PATH || path.join(USERPROFILE, '.openclaw', 'raw-memory-backup');

// 轮询间隔（毫秒）
const POLL_INTERVAL = parseInt(process.env.RAW_MEMORY_POLL_INTERVAL) || 600000; // 默认10分钟

// 状态文件：记录每个 JSONL 文件的已处理位置
const STATE_FILE = path.join(__dirname, 'watcher-state-v2.json');

// ============================================================
// 日志
// ============================================================

function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [raw-backup] ${msg}`);
}

// ============================================================
// 读取/写入状态
// ============================================================

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch (e) {
    return {};
  }
}

function writeState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

// ============================================================
// 获取所有 agent 的 session 目录
// ============================================================

function getAgentSessions() {
  const agents = [];
  
  try {
    const dirs = fs.readdirSync(AGENTS_DIR);
    for (const dir of dirs) {
      const sessionsPath = path.join(AGENTS_DIR, dir, 'sessions');
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
// 解析 JSONL，提取对话内容，按日期分组
// ============================================================

function parseJsonlByDate(content, agentId) {
  const byDate = {};
  const lines = content.split('\n');
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    try {
      const obj = JSON.parse(line);
      if (obj.type !== 'message' || !obj.message) continue;
      
      const role = obj.message.role;
      if (role !== 'user' && role !== 'assistant') continue;
      
      // 提取文本
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
      
      // 按日期分组（转换为本地时间 UTC+8）
      const ts = obj.timestamp || new Date().toISOString();
      const d = new Date(ts);
      // 手动计算 UTC+8
      const utcMs = d.getTime() + d.getTimezoneOffset() * 60000;
      const localMs = utcMs + 8 * 3600000; // UTC+8
      const ld = new Date(localMs);
      const yyyy = ld.getUTCFullYear();
      const mm = String(ld.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(ld.getUTCDate()).padStart(2, '0');
      const hh = String(ld.getUTCHours()).padStart(2, '0');
      const mi = String(ld.getUTCMinutes()).padStart(2, '0');
      const ss = String(ld.getUTCSeconds()).padStart(2, '0');
      const dateStr = yyyy + '-' + mm + '-' + dd;
      const timeStr = hh + ':' + mi + ':' + ss;
      
      if (!byDate[dateStr]) byDate[dateStr] = [];
      
      const label = role === 'user' ? '主人' : agentId.charAt(0).toUpperCase() + agentId.slice(1);
      byDate[dateStr].push(`--- ${timeStr} | source:gateway ---\n**${label}：** ${text}\n`);
      
    } catch (e) {
      // skip bad lines
    }
  }
  
  return byDate;
}

// ============================================================
// 追加写入 markdown 文件（不覆写）
// ============================================================

function appendToMarkdown(filePath, entries) {
  // 如果文件不存在，创建文件头
  if (!fs.existsSync(filePath)) {
    const dateStr = path.basename(filePath, '.md');
    fs.writeFileSync(filePath, `# RAW: ${dateStr}\n\n`, 'utf8');
  }
  
  // 追加内容
  fs.appendFileSync(filePath, entries.join('\n'), 'utf8');
}

// ============================================================
// 备份单个 agent 的所有 session（包括历史文件）
// ============================================================

function backupAgent(agentId, sessionsPath) {
  const stateKey = agentId;
  const state = readState();
  
  try {
    const backupDir = path.join(BACKUP_BASE, agentId);
    fs.mkdirSync(backupDir, { recursive: true });
    
    // 扫描所有 JSONL 文件（包括历史文件和 reset 文件）
    const allFiles = fs.readdirSync(sessionsPath)
      .filter(f => (f.endsWith('.jsonl') || f.includes('.jsonl.reset.')) && 
                    !f.includes('.trajectory.') &&
                    f !== 'sessions.json');
    
    for (const file of allFiles) {
      const filePath = path.join(sessionsPath, file);
      const sessionId = file.replace('.jsonl', '');
      
      const sessionStateKey = stateKey + ':' + sessionId;
      const prevState = state[sessionStateKey] || { lastSize: 0 };
      
      // 检查文件是否有变化
      const stat = fs.statSync(filePath);
      if (stat.size <= prevState.lastSize) continue;
      
      // 读取整个文件并按日期分组
      const content = fs.readFileSync(filePath, 'utf8');
      const byDate = parseJsonlByDate(content, agentId);
      
      // 按日期写入 markdown
      for (const [dateStr, entries] of Object.entries(byDate)) {
        const mdFile = path.join(backupDir, dateStr + '.md');
        appendToMarkdown(mdFile, entries);
      }
      
      // 更新状态
      state[sessionStateKey] = { lastSize: stat.size, lastCheck: Date.now() };
      
      log(`Processed: ${agentId}/${sessionId} (${Math.round(stat.size / 1024)}KB)`);
    }
    
    writeState(state);
    
  } catch (e) {
    log(`Error processing ${agentId}: ${e.message}`);
  }
}

// ============================================================
// 主轮询逻辑
// ============================================================

function poll() {
  const agents = getAgentSessions();
  
  for (const agent of agents) {
    backupAgent(agent.agentId, agent.sessionsPath);
  }
}

// ============================================================
// 启动
// ============================================================

log('Backup watcher v2 starting...');
log('Backup destination: ' + BACKUP_BASE);
log('Format: markdown, one file per day');

// 确保备份目录存在
fs.mkdirSync(BACKUP_BASE, { recursive: true });

// 初始备份
poll();

// 定时轮询
setInterval(poll, POLL_INTERVAL);

log('Watcher running, polling every ' + (POLL_INTERVAL / 1000) + 's');

// 保持进程存活
process.on('SIGTERM', () => {
  log('Watcher shutting down');
  process.exit(0);
});

process.on('SIGINT', () => {
  log('Watcher shutting down');
  process.exit(0);
});
