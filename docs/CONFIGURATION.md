# Configuration

<div align="center">

English | <a href="CONFIGURATION_fr.md">Français</a>

</div>

## Overview

All configuration is **optional**. The plugin works out of the box with sensible defaults and auto-detects as much as possible.

## Configuration Priority

All values follow the same 3-tier priority:

```
1. Environment variable    (highest priority)
2. openclaw.json           (middle)
3. Built-in fallback       (lowest)
```

## Environment Variables

### Backup Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `RAW_MEMORY_BACKUP_PATH` | Where to store backup files | `~/.openclaw/raw-memory-backup` |
| `RAW_MEMORY_POLL_INTERVAL` | How often to poll for changes, in milliseconds | `600000` (10 min) |
| `TZ` | IANA timezone for date formatting | System timezone |

### Display Labels

| Variable | Description | Default |
|----------|-------------|---------|
| `RAW_MEMORY_USER_LABEL` | Label for user messages in backups | Auto-detected from `openclaw.json`, or `"User"` |
| `RAW_MEMORY_AGENT_MAIN` | Label for `main` agent | Auto-detected |
| `RAW_MEMORY_AGENT_PULSE` | Label for `pulse` agent | Auto-detected |
| `RAW_MEMORY_AGENT_LUMINA` | Label for `lumina` agent | Auto-detected |
| `RAW_MEMORY_AGENT_ATLAS` | Label for `atlas` agent | Auto-detected |
| `RAW_MEMORY_AGENT_LEXIS` | Label for `lexis` agent | Auto-detected |

**Pattern**: `RAW_MEMORY_AGENT_<AGENTID>` where `<AGENTID>` is the agent ID in uppercase. This works for **any** agent ID, not just the ones listed above. For example, if you have an agent named `nova`, use `RAW_MEMORY_AGENT_NOVA`.

### Path Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENCLAW_BASE` | OpenClaw base directory | `~/.openclaw` |
| `OPENCLAW_AGENTS_DIR` | Directory containing agent sessions | `~/.openclaw/agents` |
| `OPENCLAW_WORKSPACE_BASE` | OpenClaw workspace root (used by search tool) | `~/.openclaw` |

## openclaw.json Configuration

You can set configuration in `~/.openclaw/openclaw.json`. The plugin reads agent names and user name from this file automatically — no special plugin section needed.

### Agent Label Auto-Detection

The watcher looks for agent names in `openclaw.json` using these paths:

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
  }
}
```

### Resolution Order

For each agent label:

```
1. ENV var: RAW_MEMORY_AGENT_<ID>          → e.g. "Alix"
2. openclaw.json: agents.<id>.identity.name → e.g. "Alix"
3. Fallback: capitalize(agentId)            → e.g. "Main"
```

For the user label:

```
1. ENV var: RAW_MEMORY_USER_LABEL   → e.g. "Fredox"
2. openclaw.json: user.name          → e.g. "Fredox"
3. Fallback: "User"
```

### Hook Config in openclaw.json

You can also pass configuration through the hooks section:

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
            "RAW_MEMORY_POLL_INTERVAL": 300000,
            "RAW_MEMORY_USER_LABEL": "Fredox"
          }
        }
      }
    }
  }
}
```

## Timezone Configuration

The plugin uses timezone-aware date formatting to ensure daily files are split at midnight in the user's local timezone, not UTC.

### Resolution Order

```
1. process.env.TZ                              → e.g. "Europe/Paris"
2. Intl.DateTimeFormat().resolvedOptions().timeZone → system default
3. Fallback: "UTC"
```

Set the `TZ` environment variable if your system timezone detection doesn't work as expected:

```bash
export TZ="Europe/Paris"
openclaw gateway restart
```

## Examples

### Example 1: Default Setup (Zero Config)

```bash
# Just install and go — everything uses defaults
openclaw plugins install git:github.com/fredox-dev/openclaw-raw-memory-system
openclaw plugins enable openclaw-raw-memory-system
openclaw gateway restart
```

No environment variables, no config file changes. The plugin auto-detects timezone and agent names.

### Example 2: Custom Labels via ENV

```bash
export RAW_MEMORY_USER_LABEL="Fredox"
export RAW_MEMORY_AGENT_MAIN="Alix"
export RAW_MEMORY_AGENT_PULSE="Pulse"

openclaw gateway restart
```

### Example 3: Custom Backup Path

```bash
# Store backups on a separate disk
export RAW_MEMORY_BACKUP_PATH="/mnt/backup/openclaw-raw-memory"
openclaw gateway restart
```

### Example 4: Faster Polling

```bash
# Poll every 2 minutes instead of 10
export RAW_MEMORY_POLL_INTERVAL=120000
openclaw gateway restart
```

### Example 5: Full Configuration via openclaw.json

```json
{
  "user": {
    "name": "Fredox"
  },
  "agents": {
    "main": { "identity": { "name": "Alix" } },
    "pulse": { "identity": { "name": "Pulse" } },
    "lumina": { "identity": { "name": "Lumina" } },
    "atlas": { "identity": { "name": "Atlas" } },
    "lexis": { "identity": { "name": "Lexis" } }
  },
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "raw-backup": {
          "enabled": true,
          "config": {
            "RAW_MEMORY_BACKUP_PATH": "/mnt/backup/openclaw-raw-memory",
            "RAW_MEMORY_POLL_INTERVAL": 300000
          }
        }
      }
    }
  }
}
```

## Verifying Configuration

After changing configuration, verify the watcher picked up your settings:

```bash
# Check plugin runtime
openclaw plugins inspect openclaw-raw-memory-system --runtime --json

# Check watcher logs (visible in gateway logs)
openclaw gateway logs | grep "raw-backup"

# Verify backup directory
ls -la ~/.openclaw/raw-memory-backup/

# Check search status
node ~/.openclaw/plugins/openclaw-raw-memory-system/skill/scripts/search.js status --agent main
```

The watcher logs its configuration on startup, including the resolved timezone, user label, and agent mapping.
