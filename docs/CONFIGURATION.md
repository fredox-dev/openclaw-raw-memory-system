# Configuration

## Overview

All configuration is resolved through the `getConfig()` function in `src/watcher.js` and `src/search.js`. Values are resolved in priority order:

```
Environment Variable  →  openclaw.json  →  Fallback
```

## Environment Variables

### Core Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `RAW_MEMORY_BACKUP_PATH` | Backup file storage path | `~/.openclaw/raw-memory-backup` |
| `RAW_MEMORY_POLL_INTERVAL` | Poll interval in milliseconds | `600000` (10 min) |
| `OPENCLAW_BASE` | OpenClaw base directory | `~/.openclaw` |
| `OPENCLAW_AGENTS_DIR` | Agents directory | `~/.openclaw/agents` |

### Timezone

| Variable | Description | Default |
|----------|-------------|---------|
| `TZ` | IANA timezone identifier | `Intl.DateTimeFormat().resolvedOptions().timeZone` |

The watcher uses `Intl.DateTimeFormat` with the resolved timezone to format dates and times. No manual UTC offset calculation is needed.

**Examples:**
```bash
TZ=Europe/Paris
TZ=America/New_York
TZ=Asia/Shanghai
TZ=UTC
```

### User Label

| Variable | Description | Default |
|----------|-------------|---------|
| `RAW_MEMORY_USER_LABEL` | Display name for user messages | Auto-detected or `"User"` |

If not set via environment variable, the system tries to read from `openclaw.json`:
- `config.user.name`
- `config.owner.name`
- `config.agents.defaults.userLabel`

If none found, falls back to `"User"`.

### Agent Mapping

Agent display names are resolved in this order:

1. **Environment variables** (highest priority):
   ```bash
   RAW_MEMORY_AGENT_MAIN="Alix"
   RAW_MEMORY_AGENT_PULSE="Pulse"
   RAW_MEMORY_AGENT_LUMINA="Lumina"
   RAW_MEMORY_AGENT_ATLAS="Atlas"
   RAW_MEMORY_AGENT_LEXIS="Lexis"
   ```

2. **openclaw.json auto-detection**:
   Reads `agents.list` array and extracts `identity.name` for each agent.
   ```json
   {
     "agents": {
       "list": [
         { "id": "main", "identity": { "name": "Alix" } },
         { "id": "pulse", "identity": { "name": "Pulse" } }
       ]
     }
   }
   ```

3. **Fallback**: Capitalized agent ID (e.g., `main` → `Main`, `pulse` → `Pulse`)

## Hook Configuration

Settings can be passed via the OpenClaw hook config in `openclaw.json`:

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "raw-backup": {
          "enabled": true,
          "config": {
            "RAW_MEMORY_BACKUP_PATH": "/custom/backup/path",
            "RAW_MEMORY_POLL_INTERVAL": 300000,
            "RAW_MEMORY_USER_LABEL": "Fredox",
            "RAW_MEMORY_AGENT_MAIN": "Alix",
            "RAW_MEMORY_AGENT_PULSE": "Pulse",
            "RAW_MEMORY_AGENT_LUMINA": "Lumina",
            "RAW_MEMORY_AGENT_ATLAS": "Atlas",
            "RAW_MEMORY_AGENT_LEXIS": "Lexis",
            "TZ": "Europe/Paris"
          }
        }
      }
    }
  }
}
```

Hook config values are injected as environment variables by OpenClaw before spawning the watcher process.

## Example Setups

### Minimal (zero config)

No configuration needed. The system will:
- Back up to `~/.openclaw/raw-memory-backup/`
- Use system timezone
- Label user as "User"
- Use capitalized agent IDs

### Personal setup

```json
{
  "hooks": {
    "internal": {
      "entries": {
        "raw-backup": {
          "enabled": true,
          "config": {
            "RAW_MEMORY_USER_LABEL": "Fredox",
            "TZ": "Europe/Paris"
          }
        }
      }
    }
  }
}
```

Agent names will be auto-detected from `openclaw.json`.

### Full custom setup

```json
{
  "hooks": {
    "internal": {
      "entries": {
        "raw-backup": {
          "enabled": true,
          "config": {
            "RAW_MEMORY_BACKUP_PATH": "/mnt/backup/openclaw-raw",
            "RAW_MEMORY_POLL_INTERVAL": 300000,
            "RAW_MEMORY_USER_LABEL": "Fredox",
            "RAW_MEMORY_AGENT_MAIN": "Alix",
            "RAW_MEMORY_AGENT_PULSE": "Pulse",
            "RAW_MEMORY_AGENT_LUMINA": "Lumina",
            "RAW_MEMORY_AGENT_ATLAS": "Atlas",
            "RAW_MEMORY_AGENT_LEXIS": "Lexis",
            "TZ": "Europe/Paris"
          }
        }
      }
    }
  }
}
```

## Cleanup Configuration

The cleanup script (`skill/scripts/cleanup.sh`) uses:

| Variable | Description | Default |
|----------|-------------|---------|
| `RAW_MEMORY_BACKUP_PATH` | Backup storage path | `~/.openclaw/raw-memory-backup` |

Usage:
```bash
# Keep last 90 days
./cleanup.sh --agent main --days 90

# Keep last 30 days
./cleanup.sh --agent pulse --days 30
```

### Cron example (weekly cleanup)

```cron
# Every Sunday at 3:00 AM, clean up backups older than 90 days
0 3 * * 0 /path/to/cleanup.sh --agent main --days 90
0 3 * * 0 /path/to/cleanup.sh --agent pulse --days 90
```

## Verification

Check that configuration is correctly loaded:

```bash
# Check backup directory
ls -la ~/.openclaw/raw-memory-backup/

# Check agent backups
ls -la ~/.openclaw/raw-memory-backup/main/

# Search with status
node skill/scripts/search.js --agent main --status

# Check watcher state
cat ~/.openclaw/raw-memory-backup/watcher-state-v2.json | head -20
```
