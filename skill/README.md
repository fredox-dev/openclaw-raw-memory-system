# Raw Memory Search

Search through complete, uncurated conversation backups stored by `openclaw-raw-memory-system`.

## Purpose

When built-in memory (MEMORY.md, LanceDB) doesn't contain specific details, search raw conversation logs for exact quotes, forgotten promises, or audit trails.

## File Structure

```
skill/
├── SKILL.md                 # Core workflow (<500 lines)
├── README.md                # This file
├── references/
│   └── search-tool.md       # Detailed tool reference
└── scripts/
    ├── search.js            # Search implementation
    └── cleanup.sh           # Cleanup old backups
```

## Quick Start

```bash
# Search for "weather" mentions
cd ~/.openclaw/workspace/skills/raw-memory
node scripts/search.js --agent main --query "weather" --limit 5

# Search within date range
node scripts/search.js --agent main --query "database" --from 2026-07-01 --to 2026-07-10

# Check backup status
node scripts/search.js --agent main --status

# Clean up backups older than 90 days
./scripts/cleanup.sh --agent main --days 90
```

## Requirements

- `openclaw-raw-memory-system` plugin must be installed and running
- Backup location: `~/.openclaw/raw-memory-backup/<agent>/<date>.md`
- Node.js installed

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

- **SKILL.md**: ~500 tokens
- **References**: Loaded on-demand when needed
- **Scripts**: Pure file I/O, no LLM calls

## Security

- **Read-only**: Search only reads local files
- **No network**: Pure local file operations
- **No privileges**: No sudo, no root access required

## Maintenance

- **Daily backup**: Handled by `openclaw-raw-memory-system` plugin
- **Cleanup**: Run `cleanup.sh` weekly or monthly
- **Storage**: ~20-35 MB per year per agent

## Credits

Based on `openclaw-memory-system` by oceanwh (MIT License).
Refactored for OpenClaw plugin API v2 by Pulse (2026-07-12).
