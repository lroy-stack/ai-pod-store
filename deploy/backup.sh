#!/bin/bash
#
# Docker Volume Backup Script
# ============================
#
# Creates timestamped snapshots of critical Docker volumes:
# - Redis data (session cache, rate limiting)
# - PodClaw data (agent brain state, SQLite DB)
# - PodClaw memory (agent context and logs)
# - Caddy data (TLS certificates)
# - Caddy config (Caddy runtime config)
#
# Usage:
#   ./backup.sh
#
# Backups are stored in: ./backups/YYYY-MM-DD_HH-MM-SS/
# Retention policy: Keeps last 7 backups (older backups are deleted)
#

set -e

# Configuration
BACKUP_DIR="$(cd "$(dirname "$0")" && pwd)/backups"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_PATH="$BACKUP_DIR/$TIMESTAMP"
COMPOSE_PROJECT="${COMPOSE_PROJECT:-deploy}"

# Volumes to backup
VOLUMES=(
  "redis-data"
  "podclaw-data"
  "podclaw-memory"
  "caddy-data"
  "caddy-config"
)

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Docker Volume Backup ===${NC}"
echo "Timestamp: $TIMESTAMP"
echo "Backup directory: $BACKUP_PATH"
echo ""

# Create backup directory
mkdir -p "$BACKUP_PATH"

# Backup each volume
for VOLUME in "${VOLUMES[@]}"; do
  FULL_VOLUME_NAME="${COMPOSE_PROJECT}_${VOLUME}"

  echo -e "${YELLOW}Backing up volume: $VOLUME${NC}"

  # Check if volume exists
  if ! docker volume inspect "$FULL_VOLUME_NAME" > /dev/null 2>&1; then
    echo -e "${RED}Warning: Volume $FULL_VOLUME_NAME not found, skipping${NC}"
    continue
  fi

  # Create tar archive of volume contents
  # We run a temporary container that mounts the volume and creates a tar archive
  docker run --rm \
    -v "$FULL_VOLUME_NAME:/volume:ro" \
    -v "$BACKUP_PATH:/backup" \
    alpine:latest \
    tar -czf "/backup/${VOLUME}.tar.gz" -C /volume .

  # Get size of backup
  SIZE=$(du -h "$BACKUP_PATH/${VOLUME}.tar.gz" | cut -f1)
  echo -e "${GREEN}✓ Backed up $VOLUME ($SIZE)${NC}"
done

# Create metadata file
cat > "$BACKUP_PATH/metadata.json" << EOF
{
  "timestamp": "$TIMESTAMP",
  "volumes": [
$(for VOLUME in "${VOLUMES[@]}"; do
  if [ -f "$BACKUP_PATH/${VOLUME}.tar.gz" ]; then
    SIZE=$(stat -f%z "$BACKUP_PATH/${VOLUME}.tar.gz" 2>/dev/null || stat -c%s "$BACKUP_PATH/${VOLUME}.tar.gz" 2>/dev/null)
    echo "    {\"name\": \"$VOLUME\", \"size\": $SIZE},"
  fi
done | sed '$ s/,$//')
  ],
  "compose_project": "$COMPOSE_PROJECT"
}
EOF

echo ""
echo -e "${GREEN}✓ Backup complete!${NC}"
echo "Location: $BACKUP_PATH"

# Retention policy: Keep last 7 backups, delete older ones
echo ""
echo -e "${YELLOW}Applying retention policy (keep last 7 backups)...${NC}"

# List all backup directories sorted by timestamp
BACKUP_DIRS=($(ls -1d "$BACKUP_DIR"/*/ 2>/dev/null | sort -r || true))
BACKUP_COUNT=${#BACKUP_DIRS[@]}

if [ "$BACKUP_COUNT" -gt 7 ]; then
  # Delete backups older than the 7th most recent
  for ((i=7; i<$BACKUP_COUNT; i++)); do
    OLD_BACKUP="${BACKUP_DIRS[$i]}"
    echo -e "${YELLOW}Deleting old backup: $(basename "$OLD_BACKUP")${NC}"
    rm -rf "$OLD_BACKUP"
  done

  DELETED=$((BACKUP_COUNT - 7))
  echo -e "${GREEN}✓ Deleted $DELETED old backup(s)${NC}"
else
  echo -e "${GREEN}✓ Retention policy satisfied (${BACKUP_COUNT}/7 backups)${NC}"
fi

echo ""
echo -e "${GREEN}=== Backup Summary ===${NC}"
echo "Total backups: $(ls -1d "$BACKUP_DIR"/*/ 2>/dev/null | wc -l | xargs)"
echo "Latest: $TIMESTAMP"
echo "Total size: $(du -sh "$BACKUP_DIR" | cut -f1)"
echo ""
echo -e "${GREEN}Done!${NC}"
