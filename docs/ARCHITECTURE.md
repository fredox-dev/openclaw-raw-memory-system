# Architecture

<div align="center">

English | <a href="README_fr.md">Français</a>

</div>

## Overview

The Raw Memory System is a two-component plugin for OpenClaw:

1. **Backup Daemon** (`src/watcher.js`) — runs as a background process, polls agent session JSONL files, and writes daily Markdown backups.
2. **Search Tool** (`src/search.js` and `skill/scripts/search.js`) — CLI tool for searching backup files by keyword with context window.

The plugin entry point (`dist/index.js`) uses the OpenClaw plugin API (`register(api)` with `api.registerHook()`) to start and stop the watcher alongside the Gateway lifecycle.

## System Flow

```
┌──────────────────────────────────────────────────────────────┐
│                       OpenClaw Gateway                       │
│                                                              │
│  ┌─────────────┐    JSONL     ┌─────────────────────┐        │
│  │ Agent       │ ──────────►  │ Session Storage     │        │
│  │ Sessions    │              │ (~/.openclaw/agents)│        │
│  └─────────────┘              └─────────┬───────────┘        │
│                                          │                   │
│  ┌──────────────────────────────────────┘                    │
│  │ gateway:startup event                                     │
│  ▼                                                           │
│  ┌───────────────────────────────────────────────────┐       │
│  │ dist/index.js (Plugin Entry Point)                │       │
│  │  register(api) {                                  │       │
│  │    api.registerHook('gateway:startup', ...)       │       │
│  │    api.registerHook('gateway:shutdown', ...)      │       │
│  │  }                                                │       │
│  │  └─ spawns watcher.js as detached process         │       │
│  └──────────────────────┬────────────────────────────┘       │
│                         │                                    │
│  ┌──────────────────────┘                                    │
│  ▼                                                           │
│  ┌───────────────────────────────────────────────────┐       │
│  │ src/watcher.js (Backup Daemon)                    │       │
│  │  ├─ Polls every 10 min (configurable)             │       │
│  │  ├─ Reads JSONL session files incrementally       │       │
│  │  ├─ Parses messages (user/assistant only)         │       │
│  │  ├─ Groups by date (local timezone)               │       │
│  │  ├─ Appends to daily .md files (no overwrite)     │       │
│  │  └─ Tracks state for incremental backup           │       │
│  └──────────────────────┬────────────────────────────┘       │
│                         │                                    │
│                         ▼                                    │
│  ┌───────────────────────────────────────────────────┐       │
│  │ ~/.openclaw/raw-memory-backup/                    │       │
│  │  ├─ main/2026-07-08.md                            │       │
│  │  ├─ pulse/2026-07-08.md                           │       │
│  │  ├─ atlas/2026-07-08.md                           │       │
│  │  └─ watcher-state-v2.json                         │       │
│  └──────────────────────┬────────────────────────────┘       │
│                         │                                    │
│  ┌──────────────────────┘                                    │
│  ▼                                                           │
│  ┌───────────────────────────────────────────────────┐       │
│  │ skill/scripts/search.js (Search Tool)             │       │
│  │  ├─ Keyword search (AND logic)                    │       │
│  │  ├─ Context window (3+1+3 sentences)              │       │
│  │  ├─ Date filtering (--from / --to)                │       │
│  │  └─ Status reporting                              │       │
│  └───────────────────────────────────────────────────┘       │
└──────────────────────────────────────────────────────────────┘
```

## Plugin API Integration

### Entry Point (`dist/index.js`)

The plugin uses the OpenClaw plugin API v2 with the `register(api)` pattern:

```javascript
module.exports = {
  id: 'openclaw-raw-memory-system',
  name: 'OpenClaw Raw Memory System',

  register(api) {
    api.registerHook('gateway:startup', async () => {
      // Spawns watcher.js as a detached background process
      backupProcess = spawn('node', [watcherScript], {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env },
      });
      backupProcess.unref();
    }, {
      name: 'raw-backup-start',
      description: 'Start the raw memory backup watcher on gateway startup',
    });

    api.registerHook('gateway:shutdown', async () => {
      // Kills the watcher process
      process.kill(backupProcess.pid);
    }, {
      name: 'raw-backup-stop',
      description: 'Stop the raw memory backup watcher on gateway shutdown',
    });
  },
};
```

### Manifest (`openclaw.plugin.json`)

The `openclaw.plugin.json` manifest declares the plugin's hooks, config schema, and skill metadata. This file is read by the OpenClaw plugin manager during discovery.

## Config Resolution

All configuration follows a 3-tier priority system:

```
ENV variable  ──►  openclaw.json  ──►  built-in fallback
     (highest)         (middle)            (lowest)
```

### Resolution Details

| Setting | ENV Variable | openclaw.json Path | Fallback |
|---------|-------------|-------------------|----------|
| Backup path | `RAW_MEMORY_BACKUP_PATH` | — | `~/.openclaw/raw-memory-backup` |
| Poll interval | `RAW_MEMORY_POLL_INTERVAL` | — | `600000` (10 min) |
| Timezone | `TZ` | — | System timezone via `Intl.DateTimeFormat` |
| User label | `RAW_MEMORY_USER_LABEL` | `user.name` | `"User"` |
| Agent label | `RAW_MEMORY_AGENT_<ID>` | `agents.<id>.identity.name` | Capitalized agent ID |

### Agent Auto-Detection

If no `RAW_MEMORY_AGENT_*` env vars are set, the watcher reads `~/.openclaw/openclaw.json` and extracts agent names from:

1. `agents.list` array (each item's `identity.name`)
2. `agents` object (each key's `identity.name`)

If neither exists, the agent ID is capitalized (e.g., `main` → `Main`).

## State Management

The watcher maintains a state file (`watcher-state-v2.json`) in the backup directory:

```json
{
  "main:session-abc123": {
    "lastSize": 45678,
    "lastCheck": 1720828800000
  }
}
```

This enables **incremental backup** — only files that have grown since the last check are processed. The watcher reads each JSONL file, parses new messages, and appends them to the corresponding daily Markdown file.

## Relationship to Other Systems

| System | Role | Relationship |
|--------|------|-------------|
| **OpenClaw Memory Sync** | Curated summaries (`MEMORY.md`) | Complementary — raw backup provides source data that Memory Sync distills |
| **LanceDB** | Vector-based semantic search | Independent — this system uses exact text match, no embeddings |
| **Memory Sync Cron** | Scheduled maintenance | Can invoke `cleanup.sh` to prune old backups |
| **Dreaming** | Off-hour agent processing | Can read raw backups for deeper analysis and pattern detection |
| **Built-in `memory_search`** | Agent memory recall | Use raw memory search as fallback when built-in memory is insufficient |

### Typical Memory Recovery Flow

```
Agent query
  → memory_search (LanceDB semantic)
  → MEMORY.md (curated)
  → Raw Memory search (this system, exact match)
  → Promote findings to MEMORY.md
```

## Performance Characteristics

| Metric | Value |
|--------|-------|
| Backup time per agent per poll | < 1s (typical) |
| Search time for 30 days of conversations | < 100ms |
| Disk usage per agent per day | ~50–100 KB |
| Memory usage for 100 files | ~10 MB |
| External dependencies | **Zero** (pure Node.js) |
| Token cost | **Zero** (no LLM calls) |
