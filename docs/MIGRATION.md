# Migration Guide

<div align="center">

English | <a href="README_fr.md">Français</a>

</div>

## Migrating from v1 (`openclaw-raw-memory`) to v2 (`openclaw-raw-memory-system`)

### What Changed

| Aspect | v1 | v2 |
|--------|----|----|
| Plugin name | `openclaw-raw-memory` | `openclaw-raw-memory-system` |
| Plugin API | Old hook format | New `register(api)` with `api.registerHook()` |
| Plugin manifest | — | `openclaw.plugin.json` added |
| Timezone | Hardcoded UTC+8 | System timezone (auto-detected, configurable) |
| User label | Hardcoded Chinese (`主人`) | Configurable via ENV or `openclaw.json` (default: `User`) |
| Agent mapping | Hardcoded (`loli`, `main`) | Auto-detected from `openclaw.json` or ENV vars |
| Structure | `hook/`, `skill/raw-tools.js` | `dist/`, `src/`, `skill/scripts/` |
| SKILL.md language | Chinese | English |
| Documentation | Minimal | Full docs in `docs/` |

### Step-by-Step Migration

#### 1. Disable the Old Plugin

```bash
openclaw plugins disable openclaw-raw-memory
```

#### 2. Install the New Plugin

```bash
openclaw plugins install git:github.com/fredox-dev/openclaw-raw-memory-system
openclaw plugins enable openclaw-raw-memory-system
```

#### 3. Restart Gateway

```bash
openclaw gateway restart
```

#### 4. Verify

```bash
# Check plugin is loaded and hooks are active
openclaw plugins inspect openclaw-raw-memory-system --runtime --json

# Check backups are being created (wait a few minutes after restart)
ls ~/.openclaw/raw-memory-backup/

# Test search
node ~/.openclaw/plugins/openclaw-raw-memory-system/skill/scripts/search.js status --agent main
```

### Existing Backups

**Your existing backup files are preserved.** The v2 watcher reads and writes to the same default path (`~/.openclaw/raw-memory-backup/`). Existing `.md` files remain valid and searchable.

If you were using a custom backup path, set `RAW_MEMORY_BACKUP_PATH` to match your previous location:

```bash
export RAW_MEMORY_BACKUP_PATH="/your/existing/backup/path"
openclaw gateway restart
```

### Optional: Configure Labels

If you want custom labels instead of auto-detected defaults:

```bash
# Set via environment variables
export RAW_MEMORY_USER_LABEL="Fredox"
export RAW_MEMORY_AGENT_MAIN="Alix"
export RAW_MEMORY_AGENT_PULSE="Pulse"

openclaw gateway restart
```

Or configure in `openclaw.json` (see [CONFIGURATION.md](CONFIGURATION.md) for details).

### Optional: Remove Old Plugin

```bash
openclaw plugins uninstall openclaw-raw-memory
```

### Breaking Changes

- **Plugin name changed**: `openclaw-raw-memory` → `openclaw-raw-memory-system`
- **Search script renamed and moved**: `skill/raw-tools.js` → `skill/scripts/search.js`
- **Search CLI syntax changed**: A `search` or `status` subcommand is now required as the first argument
- **`save` command removed**: The watcher handles all backups automatically. Manual `save` is no longer needed.
- **Labels changed**: `主人` → configurable (default: `User`). Chinese labels are no longer hardcoded.
- **Timezone changed**: UTC+8 hardcoded → system timezone (auto-detected). Daily file boundaries now follow your local timezone.

### Updating Agent Skills

If your agents reference the old script path or syntax:

```bash
# Old (v1)
node skill/raw-tools.js search --agent main --query "keyword"

# New (v2) — note the `search` subcommand
node skill/scripts/search.js search --agent main --query "keyword"
```

Also update any skill `SKILL.md` files that reference the old paths to point to `skill/scripts/search.js`.
