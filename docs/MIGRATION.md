# Migration Guide

## Migrating from v1 (openclaw-raw-memory) to v2 (openclaw-memory-system)

### What Changed

| Aspect | v1 | v2 |
|--------|----|----|
| Plugin name | `openclaw-raw-memory` | `openclaw-memory-system` |
| Plugin API | Old hook format | New `openclaw.extensions` + `api.on()` |
| Timezone | Hardcoded UTC+8 | System timezone (configurable) |
| Labels | Hardcoded Chinese (`主人`) | Configurable (ENV/openclaw.json) |
| Agent mapping | Hardcoded (`loli`, `main`) | Auto-detected from openclaw.json |
| Structure | `hook/`, `skill/raw-tools.js` | `dist/`, `src/`, `skill/scripts/` |
| Language | Chinese SKILL.md | English SKILL.md |

### Step-by-Step Migration

#### 1. Disable the Old Plugin

```bash
openclaw plugins disable openclaw-raw-memory
```

#### 2. Install the New Plugin

```bash
openclaw plugins install git:github.com/xylem-team/openclaw-raw-memory-system.git
openclaw plugins enable openclaw-memory-system
```

#### 3. Restart Gateway

```bash
openclaw gateway restart
```

#### 4. Verify

```bash
# Check plugin is loaded
openclaw plugins inspect openclaw-memory-system --runtime --json

# Check backups are being created
ls ~/.openclaw/raw-memory-backup/

# Test search
node ~/.openclaw/plugins/openclaw-memory-system/skill/scripts/search.js status --agent main
```

### Existing Backups

**Your existing backup files are preserved.** The v2 watcher reads and writes to the same default path (`~/.openclaw/raw-memory-backup/`). Existing `.md` files remain valid and searchable.

### Optional: Configure Labels

If you want custom labels instead of defaults:

```bash
# In your environment or openclaw.json hooks config
export RAW_MEMORY_USER_LABEL="Fredox"
export RAW_MEMORY_AGENT_MAIN="Alix"
export RAW_MEMORY_AGENT_PULSE="Pulse"
```

### Optional: Remove Old Plugin

```bash
openclaw plugins uninstall openclaw-raw-memory
```

### Breaking Changes

- **Plugin name changed**: `openclaw-raw-memory` → `openclaw-memory-system`
- **Search script renamed**: `raw-tools.js` → `search.js`
- **Search script location**: `skill/raw-tools.js` → `skill/scripts/search.js`
- **`save` command removed**: The watcher now handles all backups automatically. Manual `save` is no longer needed.
- **Labels changed**: `主人` → configurable (default: `User`)

### Updating Agent Skills

If your agents reference the old script path:

```bash
# Old
node skill/raw-tools.js search --agent main --query "keyword"

# New
node skill/scripts/search.js search --agent main --query "keyword"
```
