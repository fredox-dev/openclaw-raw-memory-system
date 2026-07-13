# Raw Memory Search Skill

## Purpose

Search raw conversation backups when agent memory is incomplete or missing.

When an agent discovers gaps in its memory, this tool searches the raw conversation archive — every word, every timestamp, preserved exactly as it happened.

## Installation

This skill is bundled with the `openclaw-raw-memory-system` plugin. No separate installation needed.

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `RAW_MEMORY_BACKUP_PATH` | Backup storage path | `~/.openclaw/raw-memory-backup` |
| `RAW_MEMORY_USER_LABEL` | Display label for user messages | `User` |
| `RAW_MEMORY_AGENT_<ID>` | Display label for a specific agent | Auto-detected |
| `RAW_MEMORY_POLL_INTERVAL` | Poll interval in ms | `600000` (10 min) |
| `OPENCLAW_WORKSPACE_BASE` | OpenClaw workspace root | `~/.openclaw` |
| `OPENCLAW_AGENTS_DIR` | Agents directory | `~/.openclaw/agents` |

### Agent Label Auto-Detection

Agent labels are resolved in this order:

1. **ENV var**: `RAW_MEMORY_AGENT_MAIN`, `RAW_MEMORY_AGENT_PULSE`, etc.
2. **openclaw.json**: `agents.<id>.identity.name`
3. **Fallback**: Capitalized agentId (e.g., `main` → `Main`)

## Usage

### Search Raw Conversations

```bash
node <skill-dir>/scripts/search.js search --agent <agentId> --query "keyword" --limit 3
```

### Check Backup Status

```bash
node <skill-dir>/scripts/search.js status --agent <agentId>
```

### Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `--agent` | Agent ID to search | Required |
| `--query` | Search keywords (AND logic) | Required for search |
| `--limit` | Max results | 3 |
| `--from` | Start date (YYYY-MM-DD) | None |
| `--to` | End date (YYYY-MM-DD) | None |

### Examples

```bash
# Search for a keyword
node scripts/search.js search --agent main --query "project" --limit 5

# Date range search
node scripts/search.js search --agent main --query "deadline" --from 2026-07-01 --to 2026-07-10

# Multiple keywords (AND)
node scripts/search.js search --agent atlas --query "memory system refactor" --limit 3

# Check status
node scripts/search.js status --agent main
```

### Search Result Format

```json
{
  "results": [
    {
      "timestamp": "2026-07-08T14:23:05",
      "date": "2026-07-08",
      "snippet": "--- 2026-07-08T14:20:00 | source:gateway ---\n**User:** context before...\n\n--- 2026-07-08T14:23:05 | source:gateway ---\n**Agent:** matched message...\n\n--- 2026-07-08T14:25:00 | source:gateway ---\n**User:** context after...",
      "source": "2026-07-08.md",
      "contextRange": "7 sentences"
    }
  ],
  "total": 3
}
```

Context window: 3 blocks before + target + 3 after = 7 blocks of full context. Snippets longer than 1500 chars are truncated.

## Memory Recovery Protocol

When you discover memory gaps:

1. **Search built-in memory first:**
   ```
   memory_search(query="keyword")
   ```

2. **If insufficient, search raw conversations:**
   ```bash
   node <skill-dir>/scripts/search.js search --agent <yourId> --query "keyword" --limit 3
   ```

3. **Use results to continue working.** Don't announce memory loss — just recover and proceed.

## Backup Structure

```
~/.openclaw/raw-memory-backup/
├── main/
│   ├── 2026-07-06.md
│   ├── 2026-07-07.md
│   └── 2026-07-08.md
├── pulse/
│   └── 2026-07-08.md
└── atlas/
    └── 2026-07-08.md
```

One Markdown file per agent per day. Human-readable. No binary databases.

## Related Files

- `scripts/search.js` — Search and status tool
- `src/watcher.js` — Backup daemon (runs via plugin hooks)
- `references/search-tool.md` — Detailed search reference
