#!/bin/bash
#
# Docker Volume Restore Script
# =============================
#
# Restores Docker volumes from a backup created by backup.sh
#
# Usage:
#   ./restore.sh <backup-timestamp>
#
# Example:
#   ./restore.sh 2026-02-22_03-30-00
#
# WARNING: This will overwrite existing volume data!
#

set -e

# Configuration
BACKUP_DIR="$(cd "$(dirname "$0")" && pwd)/backups"
COMPOSE_PROJECT="${COMPOSE_PROJECT:-deploy}"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check arguments
if [ $# -ne 1 ]; then
  echo -e "${RED}Error: Missing backup timestamp${NC}"
  echo "Usage: $0 <backup-timestamp>"
  echo ""
  echo "Available backups:"
  ls -1 "$BACKUP_DIR" 2>/dev/null || echo "  (no backups found)"
  exit 1
fi

TIMESTAMP="$1"
BACKUP_PATH="$BACKUP_DIR/$TIMESTAMP"

# Check if backup exists
if [ ! -d "$BACKUP_PATH" ]; then
  echo -e "${RED}Error: Backup not found: $BACKUP_PATH${NC}"
  echo ""
  echo "Available backups:"
  ls -1 "$BACKUP_DIR" 2>/dev/null || echo "  (no backups found)"
  exit 1
fi

echo -e "${YELLOW}=== Docker Volume Restore ===${NC}"
echo "Timestamp: $TIMESTAMP"
echo "Backup directory: $BACKUP_PATH"
echo ""

# Read metadata
if [ ! -f "$BACKUP_PATH/metadata.json" ]; then
  echo -e "${RED}Error: Backup metadata not found${NC}"
  exit 1
fi

# Confirm restore
echo -e "${RED}WARNING: This will overwrite existing volume data!${NC}"
read -p "Continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo -e "${YELLOW}Restore cancelled${NC}"
  exit 0
fi

echo ""

# Restore each volume
for ARCHIVE in "$BACKUP_PATH"/*.tar.gz; do
  if [ ! -f "$ARCHIVE" ]; then
    continue
  fi

  VOLUME=$(basename "$ARCHIVE" .tar.gz)
  FULL_VOLUME_NAME="${COMPOSE_PROJECT}_${VOLUME}"

  echo -e "${YELLOW}Restoring volume: $VOLUME${NC}"

  # Check if volume exists
  if ! docker volume inspect "$FULL_VOLUME_NAME" > /dev/null 2>&1; then
    echo -e "${YELLOW}Creating volume: $FULL_VOLUME_NAME${NC}"
    docker volume create "$FULL_VOLUME_NAME"
  fi

  # Restore volume from tar archive
  docker run --rm \
    -v "$FULL_VOLUME_NAME:/volume" \
    -v "$BACKUP_PATH:/backup:ro" \
    alpine:latest \
    sh -c "rm -rf /volume/* /volume/..?* /volume/.[!.]* 2>/dev/null || true; tar -xzf /backup/${VOLUME}.tar.gz -C /volume"

  echo -e "${GREEN}✓ Restored $VOLUME${NC}"
done

echo ""
echo -e "${GREEN}✓ Restore complete!${NC}"
echo "Restored from: $TIMESTAMP"
echo ""
echo -e "${YELLOW}Note: Restart Docker Compose services to apply changes:${NC}"
echo "  docker compose -f deploy/docker-compose.yml restart"
echo ""
