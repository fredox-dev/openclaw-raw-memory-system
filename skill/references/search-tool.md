# Search Tool Reference

## Overview

The search tool (`search.js`) provides keyword-based search over raw conversation backups. It is a zero-dependency Node.js script that reads Markdown backup files and returns matching snippets with context.

## Architecture

```
JSONL sessions → watcher.js → daily .md files → search.js → keyword results
```

The watcher daemon reads agent session JSONL files and writes daily Markdown backups.
The search tool reads those Markdown files and returns matching snippets with context.

## CLI Usage

### Search Command

```bash
node search.js search --agent <id> --query "<keywords>" [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--limit N]
```

### Status Command

```bash
node search.js status --agent <id>
```

### Parameters

| Parameter | Aliases | Description | Default |
|-----------|---------|-------------|---------|
| `--agent` | `-a` | Agent ID to search (e.g., `main`, `pulse`) | Required |
| `--query` | `-q` | Search keywords (space-separated, AND logic) | Required for `search` |
| `--limit` | `-l` | Maximum number of results | `3` |
| `--from` | `-f` | Start date filter (YYYY-MM-DD) | None |
| `--to` | `-t` | End date filter (YYYY-MM-DD) | None |

## Search Algorithm

1. **Tokenization**: Query is split by whitespace into keywords
2. **Matching**: All keywords must appear in a block (AND logic)
3. **Context window**: N blocks before + target + N after (default: 3)
4. **Sorting**: Results sorted by timestamp, newest first
5. **Truncation**: Snippets longer than 1500 chars are truncated with `...`

## Block Format

Each conversation entry in a backup file is a block delimited by `--- `:

```
--- 2026-07-08T14:23:05 | source:gateway ---
**User:** What did we discuss about the database?
```

Blocks are split by the `--- ` delimiter at line start. The timestamp includes the full date and time in ISO-like format (YYYY-MM-DDTHH:MM:SS).

## Date Filtering

- `--from YYYY-MM-DD`: Only search files from this date onwards
- `--to YYYY-MM-DD`: Only search files up to this date
- Dates are compared lexicographically (ISO YYYY-MM-DD format sorts naturally)
- Date filtering applies to the **file name** (one file per day), not individual messages

## Search Result Format

```json
{
  "results": [
    {
      "timestamp": "2026-07-08T14:23:05",
      "date": "2026-07-08",
      "snippet": "--- 2026-07-08T14:20:00 | source:gateway ---\n**User:** Let's talk about...\n\n--- 2026-07-08T14:23:05 | source:gateway ---\n**Agent:** The database schema...\n\n--- 2026-07-08T14:25:00 | source:gateway ---\n**User:** Good point...",
      "source": "2026-07-08.md",
      "contextRange": "7 sentences"
    }
  ],
  "total": 3
}
```

- **timestamp**: Full timestamp from the matched block
- **date**: Date extracted from the source filename
- **snippet**: Concatenated context blocks (3 before + match + 3 after)
- **source**: Source filename
- **contextRange**: Human-readable description of context size
- **total**: Total matches found (before limit applied)

## Status Output

```bash
node search.js status --agent main
```

```json
{
  "agent": "main",
  "rawDir": "/home/user/.openclaw/raw-memory-backup/main",
  "exists": true,
  "fileCount": 42,
  "totalBytes": 512000,
  "totalKB": 500,
  "earliestDate": "2026-01-15",
  "latestDate": "2026-07-12"
}
```

## Exit Codes

- `0`: Success (results found or not)
- `1`: Error (missing args, unknown command, agent not found)

## Performance

| Metric | Value |
|--------|-------|
| External dependencies | Zero (pure Node.js) |
| Typical search (30 days) | < 100ms |
| Memory usage (100 files) | ~10 MB |
| Index required | None — reads files directly |

## Path Resolution

The search tool resolves the backup directory for an agent in this order:

1. `~/.openclaw/raw-memory-backup/<agentId>/` (primary — watcher output)
2. Workspace-based legacy path (for backward compatibility with v1)
3. Returns the primary path even if it doesn't exist (for error reporting)

The backup path can be overridden with `RAW_MEMORY_BACKUP_PATH` environment variable.
