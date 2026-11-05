#!/bin/sh
set -eu
umask 077
[ "${ACCEPTANCE_ISOLATED:-}" = true ] && [ "${PGHOST:-}" = db ] && [ "${PGDATABASE:-}" = gobilan_acceptance ] || { echo 'Isolated acceptance database required' >&2; exit 1; }
case "${1:-backup}" in
 backup)
  mkdir -p /backups
  archive="/backups/gobilan-$(date -u +%Y%m%dT%H%M%SZ).dump"
  temp="$archive.partial"
  trap 'rm -f "$temp"' EXIT HUP INT TERM
  pg_dump --format=custom --no-owner --file="$temp"
  pg_restore --list "$temp" >/dev/null
  mv "$temp" "$archive"
  sha256sum "$archive" > "$archive.sha256"
  find /backups -type f -name 'gobilan-*.dump*' -mtime +7 -delete
  echo "Backup ready: $archive"
  ;;
 verify)
  archive="${2:?Archive required}"
  case "$archive" in /backups/gobilan-*.dump) ;; *) echo 'Invalid archive path' >&2; exit 1;; esac
  sha256sum -c "$archive.sha256"
  restored="gobilan_restore_check_$(date -u +%s)_$$"
  createdb "$restored"
  trap 'dropdb --if-exists "$restored" >/dev/null' EXIT HUP INT TERM
  pg_restore --no-owner --exit-on-error --dbname="$restored" "$archive"
  test "$(psql -d "$restored" -tAc 'select count(*) from schema_migrations')" -ge 5
  test "$(psql -d "$restored" -tAc 'select count(*) from pg_trigger where not tgisinternal')" -gt 0
  echo 'Restore verified in a separate temporary database'
  ;;
 loop)
  while true; do sh "$0" backup; sleep 86400; done
  ;;
 *) echo 'Usage: acceptance-backup.sh backup|verify ARCHIVE|loop' >&2; exit 1;;
esac
