#!/usr/bin/env bash
# Back up the JobCraft database (a single SQLite file) to a local folder.
#
#   ./backup.sh                       # -> ~/jobcraft-backups/jobcraft-<timestamp>.db
#   BACKUP_DIR=/mnt/usb ./backup.sh   # somewhere else (e.g. a mounted USB drive)
#
# Keeps the latest 14 backups. Run by hand, or daily via cron:
#   crontab -e
#   0 3 * * *  /home/jishnu/jobcraft/backup.sh >> /home/jishnu/jobcraft-backups/backup.log 2>&1
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB="$ROOT/backend/jobcraft.db"
DEST="${BACKUP_DIR:-$HOME/jobcraft-backups}"
KEEP=14

[[ -f "$DB" ]] || { echo "No database at $DB yet — nothing to back up."; exit 0; }
mkdir -p "$DEST"
stamp="$(date +%Y%m%d-%H%M%S)"
out="$DEST/jobcraft-$stamp.db"

# Prefer a consistent snapshot (safe even while the app is running); fall back to copy.
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB" ".backup '$out'"
else
  cp "$DB" "$out"
fi
echo "Backed up -> $out"

# Prune old backups, keep the newest $KEEP.
ls -1t "$DEST"/jobcraft-*.db 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm --
