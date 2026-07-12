#!/usr/bin/env bash
#
# cleanup.sh — Raw Memory Backup Cleanup
#
# Removes backup files older than N days.
#
# Usage:
#   ./cleanup.sh --agent <id> [--days <N>] [--dry-run]
#
# Examples:
#   ./cleanup.sh --agent main --days 90          # Delete files older than 90 days
#   ./cleanup.sh --agent main --days 90 --dry-run # Preview what would be deleted
#   ./cleanup.sh --agent main --days 30 --path /custom/backup/path

set -euo pipefail

# Defaults
AGENT_ID=""
DAYS=90
BACKUP_PATH="${RAW_MEMORY_BACKUP_PATH:-$HOME/.openclaw/raw-memory-backup}"
DRY_RUN=false

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --agent|-a)
      AGENT_ID="$2"; shift 2 ;;
    --days|-d)
      DAYS="$2"; shift 2 ;;
    --path|-p)
      BACKUP_PATH="$2"; shift 2 ;;
    --dry-run|-n)
      DRY_RUN=true; shift ;;
    --help|-h)
      echo "Usage: $0 --agent <id> [--days <N>] [--path <path>] [--dry-run]"
      echo "  --agent    Agent ID to clean (required)"
      echo "  --days     Delete files older than N days (default: 90)"
      echo "  --path     Custom backup path (default: \$RAW_MEMORY_BACKUP_PATH or ~/.openclaw/raw-memory-backup)"
      echo "  --dry-run  Preview without deleting"
      exit 0 ;;
    *)
      echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [[ -z "$AGENT_ID" ]]; then
  echo "Error: --agent is required"
  exit 1
fi

AGENT_BACKUP_DIR="${BACKUP_PATH}/${AGENT_ID}"

if [[ ! -d "$AGENT_BACKUP_DIR" ]]; then
  echo "Backup directory not found: $AGENT_BACKUP_DIR"
  exit 0
fi

echo "[cleanup] Agent: $AGENT_ID"
echo "[cleanup] Backup dir: $AGENT_BACKUP_DIR"
echo "[cleanup] Deleting files older than $DAYS days"
if $DRY_RUN; then
  echo "[cleanup] DRY RUN — no files will be deleted"
fi
echo ""

# Find and delete old files
CUTOFF_DATE=$(date -d "-${DAYS} days" +%Y-%m-%d 2>/dev/null || date -v-${DAYS}d +%Y-%m-%d 2>/dev/null)
DELETED=0
KEPT=0

for md_file in "$AGENT_BACKUP_DIR"/*.md; do
  [[ -f "$md_file" ]] || continue
  filename=$(basename "$md_file" .md)

  # Compare date strings (YYYY-MM-DD format sorts lexicographically)
  if [[ "$filename" < "$CUTOFF_DATE" ]]; then
    size=$(stat -f%z "$md_file" 2>/dev/null || stat -c%s "$md_file" 2>/dev/null || echo "?")
    if $DRY_RUN; then
      echo "  Would delete: $filename.md (${size} bytes)"
    else
      rm "$md_file"
      echo "  Deleted: $filename.md (${size} bytes)"
    fi
    DELETED=$((DELETED + 1))
  else
    KEPT=$((KEPT + 1))
  fi
done

echo ""
echo "[cleanup] Done: $DELETED files ${DRY_RUN:+would be }deleted, $KEPT files kept"
