#!/bin/sh
# Noční záloha DB a soukromých fotek. Cron na VPS (crontab -e):
#   15 3 * * * cd /opt/zapadgo && ./scripts/backup.sh >> backups/backup.log 2>&1
# Obnova:  gunzip -c backups/db-XXXX.sql.gz | docker compose exec -T db psql -U $POSTGRES_USER $POSTGRES_DB
#          docker compose exec -T backend tar xzf - -C /code < backups/photos-XXXX.tar.gz
set -eu
cd "$(dirname "$0")/.."
. ./.env
mkdir -p backups
STAMP=$(date +%Y%m%d-%H%M)
docker compose exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "backups/db-$STAMP.sql.gz"
docker compose exec -T backend tar czf - -C /code private_media > "backups/photos-$STAMP.tar.gz"
find backups -name '*.gz' -mtime +7 -delete   # držet 7 dní
echo "$(date) záloha OK: $STAMP"
