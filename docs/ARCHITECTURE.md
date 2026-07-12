# Architecture

## Overview

The Raw Memory System is a two-component plugin for OpenClaw:

1. **Backup Daemon** (`src/watcher.js`) — runs as a background process, polls agent session JSONL files, and writes daily Markdown backups.
2. **Search Tool** (`src/search.js`) — CLI tool for searching backup files by keyword with context window.

## System Flow

```
┌──────────────────────────────────────────────────────────┐
│                     OpenClaw Gateway                      │
│                                                          │
│  ┌─────────────┐    JSONL     ┌─────────────────────┐   │
│  │ Agent       │ ──────────►  │ Session Storage     │   │
│  │ Sessions    │              │ (~/.openclaw/agents)│   │
│  └─────────────┘              └─────────┬───────────┘   │
│                                          │               │
│  ┌──────────────────────────────────────┘               │
│  │ gateway:startup event                                  │
│  ▼                                                       │
│  ┌─────────────────────────────────────────────────┐     │
│  │ dist/index.js (Plugin Entry Point)              │     │
│  │  └─ spawns watcher.js as detached process       │     │
│  └──────────────────────┬──────────────────────────┘     │
│                         │                                │
│  ┌──────────────────────┘                                │
│  ▼                                                       │
│  ┌─────────────────────────────────────────────────┐     │
│  │ src/watcher.js (Backup Daemon)                  │     │
│  │  ├─ Polls every 10 min                          │     │
│  │  ├─ Reads JSONL session files                   │     │
│  │  ├─ Parses messages (user/assistant)            │     │
│  │  ├─ Groups by date (local timezone)             │     │
│  │  └─ Appends to daily .md files                  │     │
│  └──────────────────────┬──────────────────────────┘     │
│                         │                                │
│                         ▼                                │
│  ┌─────────────────────────────────────────────────┐     │
│  │ ~/.openclaw/raw-memory-backup/                  │     │
│  │  ├─ main/2026-07-08.md                          │     │
│  │  ├─ pulse/2026-07-08.md                         │     │
│  │  └─ atlas/2026-07-08.md                         │     │
│  └──────────────────────┬──────────────────────────┘     │
│                         │                                │
│  ┌──────────────────────┘                                │
│  ▼                                                       │
│  ┌─────────────────────────────────────────────────┐     │
│  │ src/search.js (Search Tool)                     │     │
│  │  ├─ Keyword search (AND logic)                  │     │
│  │  ├─ Context window (3+1+3 sentences)            │     │
│  │  ├─ Date filtering                              │     │
│  │  └─ Status reporting                            │     │
│  └─────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────┘
```

## Config Resolution

All configuration follows a 3-tier priority system:

```
ENV variable  ──►  openclaw.json  ──►  built-in fallback
     (highest)         (middle)            (lowest)
```

### `getConfig()` Implementation

```javascript
function getConfig() {
  // 1. Read openclaw.json
  const openclawConfig = JSON.parse(fs.readFileSync(openclawJsonPath));

  // 2. ENV > openclaw.json > fallback
  const timezone = process.env.TZ || 
                   Intl.DateTimeFormat().resolvedOptions().timeZone || 
                   'UTC';

  const userLabel = process.env.RAW_MEMORY_USER_LABEL || 
                    openclawConfig.user?.name || 
                    'User';

  // 3. Agent labels: ENV > openclaw.json.agents.<id>.identity.name > capitalize(agentId)
  function getAgentLabel(agentId) {
    const envKey = `RAW_MEMORY_AGENT_${agentId.toUpperCase()}`;
    return process.env[envKey] || 
           openclawConfig.agents?.[agentId]?.identity?.name || 
           agentId.charAt(0).toUpperCase() + agentId.slice(1);
  }

  return { timezone, userLabel, getAgentLabel, ... };
}
```

## Integration with OpenClaw

### Plugin API (dist/index.js)

Uses the new OpenClaw plugin API with `api.on()`:

- `api.on('gateway:startup')` — spawns the watcher as a detached process
- `api.on('gateway:shutdown')` — kills the watcher process

### Relationship to Other Systems

| System | Role | Relationship |
|--------|------|-------------|
| **OpenClaw Memory Sync** | Curated summaries | Complementary — this provides the raw data |
| **LanceDB** | Vector search | Independent — this uses exact text match |
| **Memory Sync Cron** | Scheduled cleanup | Can call cleanup.sh |
| **Dreaming** | Off-hour processing | Can read raw backups for analysis |

## State Management

The watcher maintains a state file (`watcher-state.json`) tracking:

- Each session file's last processed size
- Last check timestamp

This enables incremental backup — only process files that have grown since last check.

## Performance Characteristics

- **Backup**: < 1s per agent per poll cycle (typical)
- **Search**: < 100ms for 30 days of conversations
- **Disk**: ~50-100KB per agent per day
- **Memory**: ~10MB for 100 files
- **Dependencies**: Zero (pure Node.js)
