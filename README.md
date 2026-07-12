# 🧠 OpenClaw Raw Memory System

> **Your agent said it. Now you can prove it.**

Zero-cost, full-fidelity backup of every conversation your OpenClaw agents ever had. Searchable, human-readable, and it never calls an LLM.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## The Problem

OpenClaw's built-in memory system is great — it compresses conversations into curated `MEMORY.md` files. But what happens to the **raw conversations**?

- Agent said something important 3 days ago? **Gone after compaction.**
- Need to audit what your agent actually said? **No record exists.**
- Want to search for a specific quote across all sessions? **Impossible.**
- Agent's memory feels "off" and you can't figure out why? **No trail to follow.**

**The built-in system remembers the highlights. This system remembers everything.**

---

## The Solution

OpenClaw Raw Memory System hooks into the Gateway and automatically backs up every agent conversation to human-readable Markdown files — **with zero token cost**.

```
Agent talks → Gateway writes JSONL → This plugin reads JSONL → Daily .md files
                                                                    ↓
                                                            Searchable by agents
```

### What You Get

| Feature | Description |
|---------|-------------|
| 🔄 **Auto Backup** | Starts with Gateway, runs in background, stops automatically |
| 📅 **Daily Files** | One clean `.md` file per agent per day |
| 🔍 **Agent Search** | Agents can query raw conversations when memory is missing |
| 💰 **Zero Token Cost** | Backup process never calls an LLM — pure file I/O |
| 🌍 **Cross-Platform** | Windows, macOS, Linux |
| 📖 **Human-Readable** | Open any file in any text editor — no binary databases |
| ⚙️ **Zero Config** | Auto-detects timezone, agent names from `openclaw.json` |

---

## Quick Start

### 1. Install the Plugin

```bash
openclaw plugins install git:github.com/xylem-team/openclaw-raw-memory-system
```

### 2. Enable and Restart

```bash
openclaw plugins enable openclaw-memory-system
openclaw gateway restart
```

### 3. Verify It's Running

```bash
# Check plugin status
openclaw plugins inspect openclaw-memory-system --runtime --json

# Backups appear here after a few minutes
ls ~/.openclaw/raw-memory-backup/
```

### 4. (Optional) Install the Search Skill

Copy the bundled skill to your workspace so agents can search raw conversations:

```bash
cp -r ~/.openclaw/plugins/openclaw-memory-system/skill ~/.openclaw/workspace/skills/raw-memory
```

Agents can now search:
```bash
node ~/.openclaw/workspace/skills/raw-memory/scripts/search.js search --agent main --query "keyword"
```

That's it. The watcher starts automatically with the Gateway and backs up conversations every 10 minutes. No further configuration needed.

---

## How It Works

### Backup Structure

```
~/.openclaw/raw-memory-backup/
├── main/
│   ├── 2026-07-08.md
│   ├── 2026-07-09.md
│   └── 2026-07-10.md
├── pulse/
│   └── 2026-07-10.md
├── lumina/
│   └── 2026-07-10.md
└── ...
```

### What a Backup File Looks Like

```markdown
# RAW: 2026-07-08

--- 2026-07-08T09:15:32 | source:gateway ---
**User:** Help me check the weather

--- 2026-07-08T09:15:35 | source:gateway ---
**Alix:** Sure, let me check that for you

--- 2026-07-08T14:20:00 | source:gateway ---
**User:** Write an email to the client
```

Every message, every timestamp — preserved exactly as it happened.

### Search Tool

When an agent discovers missing memory, it can search raw conversations:

```bash
# Search for keywords
node scripts/search.js search --agent main --query "keyword" --limit 3

# Search within date range
node scripts/search.js search --agent main --query "database" --from 2026-07-01 --to 2026-07-10

# Check backup status
node scripts/search.js status --agent main
```

**Search features:**
- **Keyword matching**: All keywords must appear (AND logic)
- **Context window**: 3 sentences before + target + 3 after = 7 sentences of context
- **Date filtering**: `--from` and `--to` for date ranges
- **Sort order**: Results sorted by timestamp, newest first

---

## Configuration

All configuration is **optional**. The system auto-detects everything by default.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `RAW_MEMORY_BACKUP_PATH` | Backup storage path | `~/.openclaw/raw-memory-backup` |
| `RAW_MEMORY_POLL_INTERVAL` | Poll interval in milliseconds | `600000` (10 min) |
| `TZ` | IANA timezone for date formatting | System timezone |
| `RAW_MEMORY_USER_LABEL` | Display name for user messages | Auto-detected or `"User"` |
| `RAW_MEMORY_AGENT_MAIN` | Display name for `main` agent | Auto-detected |
| `RAW_MEMORY_AGENT_PULSE` | Display name for `pulse` agent | Auto-detected |
| `RAW_MEMORY_AGENT_LUMINA` | Display name for `lumina` agent | Auto-detected |
| `RAW_MEMORY_AGENT_ATLAS` | Display name for `atlas` agent | Auto-detected |
| `RAW_MEMORY_AGENT_LEXIS` | Display name for `lexis` agent | Auto-detected |

**Agent label pattern**: `RAW_MEMORY_AGENT_<AGENTID>` where `<AGENTID>` is the agent ID uppercased. Works for any agent, not just the ones listed above.

See [docs/CONFIGURATION.md](docs/CONFIGURATION.md) for the full configuration guide.

---

## Comparison

| | OpenClaw Built-in | This System |
|---|---|---|
| **What's saved** | Curated summaries | Raw conversations |
| **Token cost** | Uses tokens for memory flush | Zero tokens |
| **Search** | Semantic (vector-based) | Exact text match |
| **Human readable** | Yes (Markdown) | Yes (Markdown) |
| **Audit trail** | ❌ No | ✅ Yes |
| **Agent self-recovery** | Partial | Full (can re-read exact conversations) |
| **Storage** | Workspace files | Separate backup directory |

**They complement each other:** Built-in memory for daily use, raw backup for when you need the full picture.

---

## Use Cases

- **🔍 Debugging Agent Behavior** — "Why did my agent say that?"
- **📜 Compliance & Audit** — "What did my agent promise to that client?"
- **🧩 Memory Recovery** — "My agent forgot something important."
- **📊 Analytics** — "How much does my agent actually talk?"

---

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — System design and data flow
- [Configuration](docs/CONFIGURATION.md) — Full configuration reference
- [Migration Guide](docs/MIGRATION.md) — Migrating from v1.x

---

## Credits

This project is a fork of [openclaw-memory-system](https://github.com/oceanwh/openclaw-memory-system) by **[oceanwh](https://github.com/oceanwh)**, originally created under the MIT License.

The v2.0 refactor was done by the [Xylem Team](https://github.com/xylem-team) to support the new OpenClaw plugin API (`register(api)` with `registerHook()`), remove all hardcoded values, and add full documentation.

All credit for the original concept and implementation goes to oceanwh. 🙏

---

## License

MIT License — see [LICENSE](LICENSE). Both the original work and this fork are released under MIT.
