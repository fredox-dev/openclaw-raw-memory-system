# Migration Guide

## From v1.x (oceanwh/openclaw-memory-system) to v2.0

This guide covers migrating from the original plugin format to the new OpenClaw plugin API v2.

## What Changed

### Plugin Format

| Aspect | v1.x (old) | v2.0 (new) |
|--------|-----------|------------|
| Plugin entry | `hook/handler.ts` (TypeScript) | `dist/index.js` (JavaScript) |
| Package config | `openclaw.hooks` only | `openclaw.extensions` + `openclaw.hooks` |
| Watcher location | `hook/watcher.js` | `src/watcher.js` |
| Search tool | `skill/raw-tools.js` | `skill/scripts/search.js` + `src/search.js` |
| TypeScript | Required handler.ts | Not required (pure JS) |

### Hardcoded Values Removed

| Setting | v1.x (hardcoded) | v2.0 (configurable) |
|---------|-----------------|---------------------|
| Timezone | UTC+8 manual offset | `process.env.TZ` or `Intl.DateTimeFormat` |
| User label | `主人` (Chinese) | `RAW_MEMORY_USER_LABEL` env var or auto-detect |
| Agent names | Capitalized agentId | `RAW_MEMORY_AGENT_*` env vars or `openclaw.json` |

## Migration Steps

### 1. Uninstall the old plugin

```bash
openclaw plugins uninstall openclaw-memory-system
```

### 2. Install the new plugin

```bash
openclaw plugins install git:github.com/xylem-team/openclaw-raw-memory-system
```

### 3. Enable the plugin

```bash
openclaw plugins enable openclaw-raw-memory-system
```

### 4. Restart gateway

```bash
openclaw gateway restart
```

### 5. Verify the plugin is running

```bash
openclaw plugins inspect openclaw-raw-memory-system --runtime --json
```

### 6. Verify backups are being created

```bash
ls -la ~/.openclaw/raw-memory-backup/
```

You should see directories for each agent with `.md` files.

### 7. Install the search skill

If you had the old skill installed, remove it and install the new one:

```bash
# Remove old skill if present
rm -rf ~/.openclaw/workspace/skills/raw-memory-old

# The new skill is included in the plugin under skill/
# Copy it to your skills directory
cp -r ~/.openclaw/plugins/openclaw-raw-memory-system/skill ~/.openclaw/workspace/skills/raw-memory
```

### 8. Update search command (if used in scripts)

Old command:
```bash
node raw-tools.js search --agent loli --query "keyword"
```

New command:
```bash
node search.js --agent main --query "keyword"
```

Key differences:
- Script name: `raw-tools.js` → `search.js`
- No `save` or `save --all` commands (handled by plugin automatically)
- `--status` flag instead of `status` command

## Configuration Migration

### Old config (v1.x)

No environment variables were documented. Values were hardcoded:
- Timezone: UTC+8
- User label: `主人`
- Agent names: capitalized agentId

### New config (v2.0)

Add to your `openclaw.json` hook config:

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "raw-backup": {
          "enabled": true,
          "config": {
            "RAW_MEMORY_BACKUP_PATH": "~/.openclaw/raw-memory-backup",
            "RAW_MEMORY_POLL_INTERVAL": 600000,
            "RAW_MEMORY_USER_LABEL": "User",
            "RAW_MEMORY_AGENT_MAIN": "Alix",
            "RAW_MEMORY_AGENT_PULSE": "Pulse"
          }
        }
      }
    }
  }
}
```

Or use environment variables directly.

## Existing Backups

Existing backup files in `~/.openclaw/raw-memory-backup/` are fully compatible. The v2.0 watcher:

- Uses the same output directory structure
- Uses the same Markdown format
- Reads the same JSONL session files

You do NOT need to delete or migrate existing backups.

## Troubleshooting

### Plugin doesn't start

Check that `openclaw.extensions` is in package.json:
```bash
cat node_modules/openclaw-raw-memory-system/package.json | grep extensions
```

### Timezone is wrong

Set the `TZ` environment variable:
```bash
TZ=Europe/Paris
```

Or set it in hook config.

### Agent names are wrong

Set `RAW_MEMORY_AGENT_<ID>` environment variables, or ensure your `openclaw.json` has the correct `agents.list` entries with `identity.name`.

### State file location

The state file moved from `hook/watcher-state-v2.json` to `~/.openclaw/raw-memory-backup/watcher-state-v2.json`. The watcher will start fresh, reprocessing all JSONL files on first run. This is expected and safe (appends are idempotent within the same file).
