# Raw Memory Search

Search through complete, uncurated conversation backups stored by the `openclaw-memory-system` plugin.

## Purpose

When built-in memory (`MEMORY.md`, LanceDB) doesn't contain specific details, search raw conversation logs for exact quotes, forgotten promises, or audit trails.

## File Structure

```
skill/
├── SKILL.md                 # Core workflow (<500 lines)
├── README.md                # This file
├── references/
│   └── search-tool.md       # Detailed tool reference
└── scripts/
    ├── search.js            # Search and status tool
    └── cleanup.sh           # Cleanup old backups
```

## Quick Start

```bash
# Search for "weather" mentions in main agent's conversations
node scripts/search.js search --agent main --query "weather" --limit 5

# Search within a date range
node scripts/search.js search --agent main --query "database" --from 2026-07-01 --to 2026-07-10

# Check backup status for an agent
node scripts/search.js status --agent main

# Clean up backups older than 90 days
./scripts/cleanup.sh --agent main --days 90
```

> **Note:** The `search` or `status` subcommand is required as the first argument.

## Requirements

- `openclaw-memory-system` plugin must be installed and running
- Backup location: `~/.openclaw/raw-memory-backup/<agent>/<date>.md`
- Node.js installed

## How It Works

1. The `openclaw-memory-system` plugin runs a background watcher that backs up agent conversations to daily Markdown files
2. This skill's `search.js` reads those files and performs keyword matching with a context window
3. Results include surrounding context (3 messages before + match + 3 after = 7 total)

## Integration

This skill is designed as a fallback when:

1. **LanceDB** (semantic search) doesn't return relevant results
2. **MEMORY.md** (curated memory) doesn't contain the information
3. Agent needs exact quotes or precise wording

The typical flow:
```
Agent query → LanceDB → MEMORY.md → Raw Memory (this skill) → Promote to MEMORY.md
```

## Token Efficiency

- **SKILL.md**: ~500 tokens (loaded by agent on demand)
- **References**: Loaded on-demand when needed
- **Scripts**: Pure file I/O, no LLM calls

## Security

- **Read-only**: Search only reads local files
- **No network**: Pure local file operations
- **No privileges**: No sudo, no root access required

## Maintenance

- **Daily backup**: Handled automatically by the `openclaw-memory-system` plugin
- **Cleanup**: Run `cleanup.sh` weekly or monthly to prune old files
- **Storage**: ~20–35 MB per year per agent (typical usage)

## Credits

Based on [openclaw-memory-system](https://github.com/oceanwh/openclaw-memory-system) by [oceanwh](https://github.com/oceanwh) (MIT License).
Refactored for OpenClaw plugin API v2 by the [Xylem Team](https://github.com/xylem-team) (2026-07-12).

## License

MIT — see [LICENSE](../../LICENSE)
