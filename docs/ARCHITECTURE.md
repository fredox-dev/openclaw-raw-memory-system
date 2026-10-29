# Architecture

<div align="center">

English | <a href="ARCHITECTURE_fr.md">Français</a>

</div>

## Overview

The Raw Memory System is a two-component plugin for OpenClaw:

1. **Backup Daemon** (`src/watcher.js`) — runs as a background process, polls agent session storage (SQLite or legacy JSONL, detected per agent at runtime), and writes daily Markdown backups.
2. **Search Tool** (`src/search.js` and `skill/scripts/search.js`) — CLI tool for searching backup files by keyword with context window.

The plugin entry point (`dist/index.js`) uses the OpenClaw plugin API (`register(api)` with `api.registerHook()`) to start and stop the watcher alongside the Gateway lifecycle.

## System Flow

```
┌──────────────────────────────────────────────────────────────┐
│                       OpenClaw Gateway                       │
│                                                              │
│  ┌─────────────┐ SQLite/JSONL ┌─────────────────────┐        │
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
│  │  ├─ Detects storage per agent (SQLite or JSONL)   │       │
│  │  ├─ Polls every 10 min (configurable)             │       │
│  │  ├─ SQLite: reads transcript_events (read-only)   │       │
│  │  ├─ JSONL: reads session files incrementally      │       │
│  │  ├─ Decompresses zstd events (native node:zlib)   │       │
│  │  ├─ Parses messages (user/assistant only)         │       │
│  │  ├─ Groups by date (local timezone)               │       │
│  │  ├─ Appends to daily .md files (no overwrite)     │       │
│  │  └─ Tracks state for incremental backup (v3)      │       │
│  └──────────────────────┬────────────────────────────┘       │
│                         │                                    │
│                         ▼                                    │
│  ┌───────────────────────────────────────────────────┐       │
│  │ ~/.openclaw/raw-memory-backup/                    │       │
│  │  ├─ main/2026-07-08.md                            │       │
│  │  ├─ pulse/2026-07-08.md                           │       │
│  │  ├─ atlas/2026-07-08.md                           │       │
│  │  └─ watcher-state-v3.json                         │       │
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

## Storage Backends

The watcher supports both OpenClaw session storage formats. The mode is detected **per agent at runtime** — by the presence of files, never by OpenClaw version number:

| Mode | Source | Used when |
|------|--------|-----------|
| **SQLite** (priority) | `agents/<id>/agent/openclaw-agent.sqlite` — table `transcript_events` | OpenClaw >= 2026.8.1 |
| **Legacy JSONL** | `agents/<id>/sessions/*.jsonl` | Older OpenClaw versions |

If the SQLite database exists for an agent, SQLite mode wins; otherwise the agent falls back to JSONL. This makes upgrades transparent: as soon as OpenClaw migrates an agent to SQLite, the watcher follows along.

### SQLite Mode

- **Read-only guarantee** — the database is opened with `node:sqlite`'s `DatabaseSync` in `readOnly: true` mode. The plugin never writes to gateway databases.
- **Compression** — events may be stored zstd-compressed (`event_zstd` column). They are decompressed with Node's native `zlib.zstdDecompressSync`, which is why Node >= 24 is required.
- **Incremental tracking** — state keys are prefixed `sqlite:<agentId>:<sessionId>` and store the last processed `seq` per session; only newer events are read.
- **Batched reads** — events are read in batches of 2000 rows to bound memory usage on large sessions.
- **Session resets** — if a session's `MAX(seq)` regresses below the stored offset (session reset), the watcher re-reads it from 0 and logs a warning; duplicate entries in that day's file are possible.

### First-Run Backfill (SQLite Mode)

When an agent has no SQLite state yet, the watcher determines where to start collecting events:

1. `RAW_MEMORY_BACKFILL_FROM` (ISO date) — highest priority
2. `RAW_MEMORY_BACKFILL_DAYS` (days back from now)
3. Midnight of the **last existing daily `.md`** for that agent — with a 1-day overlap by design, so the tail of the last backed-up day is never lost (duplicate entries on the overlap day are possible and harmless)
4. Otherwise: **full history** (first run on a fresh install may take a while)

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
| Backfill start | `RAW_MEMORY_BACKFILL_FROM` / `RAW_MEMORY_BACKFILL_DAYS` | — | Last daily `.md` (midnight, +1 day overlap) |

### Agent Auto-Detection

If no `RAW_MEMORY_AGENT_*` env vars are set, the watcher reads `~/.openclaw/openclaw.json` and extracts agent names from:

1. `agents.list` array (each item's `identity.name`)
2. `agents` object (each key's `identity.name`)

If neither exists, the agent ID is capitalized (e.g., `main` → `Main`).

## State Management

The watcher maintains a state file (`watcher-state-v3.json`) in the backup directory:

```json
{
  "main:session-abc123": {
    "lastSize": 45678,
    "lastCheck": 1720828800000
  },
  "sqlite:main:session-xyz789": {
    "lastSeq": 1234,
    "lastCheck": 1720915200000
  }
}
```

- **Legacy JSONL keys** (`<agentId>:<sessionId>`) track the last file size processed (`lastSize`).
- **SQLite keys** (prefixed `sqlite:`) track the last event sequence number processed per session (`lastSeq`).

This enables **incremental backup** — only data that changed since the last check is processed. The state file is migrated automatically from `watcher-state-v2.json` on first start (same format, legacy offsets preserved — the file is simply renamed).

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
| First run (full history) | Depends on history size (batched reads of 2000 events) |
| External dependencies | **Zero** — Node >= 24 built-ins only (`node:sqlite`, `node:zlib`) |
| Token cost | **Zero** (no LLM calls) |
