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
Agent talks → Gateway writes JSONL → This hook reads JSONL → Daily .md files
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

---

## Quick Start

### 1. Install the Hook (Auto Backup)

```bash
openclaw plugins install https://github.com/oceanwh/openclaw-memory-system
```

### 2. Install the Skill (Search Tool)

```bash
openclaw skills install https://github.com/oceanwh/openclaw-memory-system/skill
```

### 3. Done

Gateway restarts → backup starts automatically → your agents' conversations are being saved.

---

## How It Works

### Backup Structure

```
~/.openclaw/raw-memory-backup/
├── main/
│   ├── 2026-07-06.md
│   ├── 2026-07-07.md
│   └── 2026-07-08.md
├── loli/
│   └── 2026-07-08.md
├── miya/
│   └── 2026-07-08.md
└── yuki/
    └── 2026-07-08.md
```

### What a Backup File Looks Like

```markdown
# Agent: main — 2026-07-08

## Session: 09:15:32
User: 帮我查一下最近的天气
Assistant: 好的，让我查一下~ [calls weather tool]

## Session: 14:20:00
User: 帮我写一封邮件给客户
Assistant: 好的，我来起草~ [calls write tool]
```

Every message, every tool call, every timestamp — preserved exactly as it happened.

### Search Tool

When an agent discovers missing memory, it can search raw conversations:

```bash
node raw-tools.js search --agent main --query "keyword" --limit 3
```

**How it works:**
- **Keyword matching**: All keywords must appear (AND logic)
- **Context window**: 3 sentences before + target + 3 sentences after = 7 sentences of full context
- **Date filtering**: Use `--from` and `--to` to filter by date range
- **Sort order**: Results sorted by timestamp, newest first

**Output format:**
```json
{
  "results": [
    {
      "timestamp": "2026-07-08T09:15:32Z",
      "date": "2026-07-08",
      "snippet": "context before...\n\n**User:** help me check...\n\n**Assistant:** sure...\n\ncontext after...",
      "source": "2026-07-08.md",
      "contextRange": "7 sentences"
    }
  ],
  "total": 3
}
```

**All commands:**
```bash
# Incremental save current session
node raw-tools.js save --agent main

# Extract all historical sessions
node raw-tools.js save --agent main --all

# Search
node raw-tools.js search --agent main --query "keyword" --limit 3
node raw-tools.js search --agent main --query "keyword" --from 2026-07-01 --to 2026-07-08

# Check status
node raw-tools.js status --agent main
```

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

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `RAW_MEMORY_BACKUP_PATH` | Backup storage path | `~/.openclaw/raw-memory-backup` |
| `RAW_MEMORY_POLL_INTERVAL` | Poll interval (ms) | `600000` (10 min) |
| `OPENCLAW_WORKSPACE_BASE` | Workspace root | `~/.openclaw` |
| `OPENCLAW_AGENTS_DIR` | Agents directory | `~/.openclaw/agents` |

### openclaw.json Config

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "raw-backup": {
          "enabled": true,
          "config": {
            "RAW_MEMORY_BACKUP_PATH": "/custom/path",
            "RAW_MEMORY_POLL_INTERVAL": 600000
          }
        }
      }
    }
  }
}
```

---

## Use Cases

### 🔍 Debugging Agent Behavior
> "Why did my agent say that?" — Search the raw conversation to find the exact moment.

### 📜 Compliance & Audit
> "What did my agent promise to that client?" — Every word is preserved.

### 🧩 Memory Recovery
> "My agent forgot something important." — Search raw logs, find it, add it back to MEMORY.md.

### 📊 Analytics
> "How much does my agent actually talk?" — Count messages, track usage patterns.

---

## FAQ

**Q: Does this slow down my Gateway?**
A: No. The hook runs a lightweight file poll every 10 minutes. Zero impact on Gateway performance.

**Q: How much disk space does it use?**
A: A busy agent produces ~50-100KB per day. A year of conversations ≈ 20-35MB.

**Q: Can agents access each other's backups?**
A: Each agent can only search its own backup files by default.

**Q: What if I already have the built-in memory system?**
A: They work together perfectly. This system is a safety net, not a replacement.

---

## License

MIT License
MIT License
