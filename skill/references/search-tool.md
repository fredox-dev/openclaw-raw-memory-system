# Search Tool Reference

## Overview

The search tool (`search.js`) provides keyword-based search over raw conversation backups.

## Architecture

```
JSONL sessions → watcher.js → daily .md files → search.js → keyword results
```

The watcher daemon reads agent session JSONL files and writes daily Markdown backups.
The search tool reads those Markdown files and returns matching snippets with context.

## Search Algorithm

1. **Tokenization**: Query is split by whitespace into keywords
2. **Matching**: All keywords must appear in a block (AND logic)
3. **Context window**: N sentences before + target + N after (default: 3)
4. **Sorting**: Results sorted by timestamp, newest first
5. **Truncation**: Snippets longer than 1500 chars are truncated

## Block Format

Each conversation entry is a block:

```
--- HH:MM:SS | source:gateway ---
**Label:** message text
```

Blocks are split by the `--- ` delimiter at line start.

## Date Filtering

- `--from YYYY-MM-DD`: Only search files from this date onwards
- `--to YYYY-MM-DD`: Only search files up to this date
- Dates are compared lexicographically (ISO format works naturally)

## Status Output

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
- `1`: Error (missing args, unknown command)

## Performance

- **Zero external dependencies** — pure Node.js
- **File I/O only** — no database, no index
- **Typical search**: < 100ms for 30 days of conversations
- **Memory usage**: ~10MB for 100 files
