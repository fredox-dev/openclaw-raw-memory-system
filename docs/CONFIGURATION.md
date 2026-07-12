# Configuration

## Overview

All configuration is optional. The plugin works out of the box with sensible defaults.

## Configuration Priority

All values follow the same 3-tier priority:

```
1. ENV variable        (highest priority)
2. openclaw.json       (middle)
3. Built-in fallback   (lowest)
```

## Environment Variables

### Backup Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `RAW_MEMORY_BACKUP_PATH` | Where to store backup files | `~/.openclaw/raw-memory-backup` |
| `RAW_MEMORY_POLL_INTERVAL` | How often to poll for changes (ms) | `600000` (10 min) |
| `RAW_MEMORY_TIMEZONE` | Timezone for date formatting | System timezone |

### Display Labels

| Variable | Description | Default |
|----------|-------------|---------|
| `RAW_MEMORY_USER_LABEL` | Label for user messages | `User` |
| `RAW_MEMORY_AGENT_MAIN` | Label for `main` agent | Auto-detected |
| `RAW_MEMORY_AGENT_PULSE` | Label for `pulse` agent | Auto-detected |
| `RAW_MEMORY_AGENT_ATLAS` | Label for `atlas` agent | Auto-detected |
| `RAW_MEMORY_AGENT_LUMINA` | Label for `lumina` agent | Auto-detected |
| `RAW_MEMORY_AGENT_LEXIS` | Label for `lexis` agent | Auto-detected |

Pattern: `RAW_MEMORY_AGENT_<AGENTID>` where `<AGENTID>` is the agent ID uppercased.

### Path Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENCLAW_AGENTS_DIR` | Directory containing agent sessions | `~/.openclaw/agents` |
| `OPENCLAW_WORKSPACE_BASE` | OpenClaw workspace root | `~/.openclaw` |

## openclaw.json Configuration

You can set configuration in `~/.openclaw/openclaw.json`:

```json
{
  "user": {
    "name": "Fredox"
  },
  "agents": {
    "main": {
      "identity": {
        "name": "Alix"
      }
    },
    "pulse": {
      "identity": {
        "name": "Pulse"
      }
    },
    "atlas": {
      "identity": {
        "name": "Atlas"
      }
    }
  },
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "raw-backup": {
          "enabled": true,
          "config": {
            "RAW_MEMORY_BACKUP_PATH": "/custom/path",
            "RAW_MEMORY_POLL_INTERVAL": 300000,
            "RAW_MEMORY_USER_LABEL": "Fredox"
          }
        }
      }
    }
  }
}
```

## Agent Label Auto-Detection

If no ENV var is set for an agent, the plugin reads `openclaw.json`:

```javascript
// Resolution order:
1. process.env.RAW_MEMORY_AGENT_MAIN     → "Alix"
2. openclawConfig.agents.main.identity.name → "Alix"
3. Fallback: capitalize("main")           → "Main"
```

## Timezone Configuration

The plugin uses timezone-aware date formatting:

```javascript
// Resolution order:
1. process.env.TZ                        → "Europe/Paris"
2. process.env.RAW_MEMORY_TIMEZONE        → "Europe/Paris"
3. Intl.DateTimeFormat().resolvedOptions().timeZone → system default
4. Fallback: "UTC"
```

This ensures daily files are split at midnight in the user's local timezone, not UTC.

## Examples

### Example 1: Default Setup (Zero Config)

```bash
# Just install and go — everything uses defaults
openclaw plugins install git:github.com/xylem-team/openclaw-raw-memory-system.git
openclaw plugins enable openclaw-memory-system
```

### Example 2: Custom Labels via ENV

```bash
export RAW_MEMORY_USER_LABEL="Fredox"
export RAW_MEMORY_AGENT_MAIN="Alix"
export RAW_MEMORY_AGENT_PULSE="Pulse"

openclaw gateway restart
```

### Example 3: Custom Backup Path

```bash
export RAW_MEMORY_BACKUP_PATH="/mnt/backup/openclaw-raw-memory"
openclaw gateway restart
```

### Example 4: Faster Polling

```bash
export RAW_MEMORY_POLL_INTERVAL=120000  # 2 minutes
openclaw gateway restart
```
