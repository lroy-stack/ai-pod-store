# Docker Volume Backup & Restore

This directory contains scripts for backing up and restoring critical Docker volumes.

## Volumes Backed Up

- **redis-data** — Session cache, rate limiting, queues
- **podclaw-data** — PodClaw brain state (SQLite DB)
- **podclaw-memory** — PodClaw context and logs
- **caddy-data** — TLS certificates
- **caddy-config** — Caddy runtime configuration

## Usage

### Create a Backup

```bash
cd project/deploy
./backup.sh
```

**Output:**
- Backups are stored in `./backups/YYYY-MM-DD_HH-MM-SS/`
- Each volume is saved as a `.tar.gz` archive
- Metadata is stored in `metadata.json`
- **Retention policy:** Automatically keeps last 7 backups, deletes older ones

### Restore from Backup

```bash
cd project/deploy
./restore.sh <backup-timestamp>
```

**Example:**
```bash
./restore.sh 2026-02-22_03-30-00
```

**List available backups:**
```bash
ls -1 backups/
```

**WARNING:** Restore will overwrite existing volume data. The script will prompt for confirmation.

After restore, restart Docker Compose services:
```bash
docker compose -f deploy/docker-compose.yml restart
```

## Backup Schedule

For production deployments, set up a cron job to run backups automatically:

```bash
# Daily backup at 3 AM
0 3 * * * cd /path/to/project/deploy && ./backup.sh >> /var/log/pod-backup.log 2>&1
```

## Storage Requirements

Typical backup sizes:
- Redis data: ~10-50 MB
- PodClaw data: ~100-500 MB (depends on agent activity)
- PodClaw memory: ~50-200 MB
- Caddy data: ~1-5 MB (TLS certificates)
- Caddy config: <1 MB

**Total per backup:** ~200-750 MB
**7 backups (retention):** ~1.5-5 GB

## Disaster Recovery

### Full System Restore

1. Restore Docker volumes:
   ```bash
   ./restore.sh <backup-timestamp>
   ```

2. Verify environment variables are configured (`.env.local` files)

3. Rebuild and start Docker Compose:
   ```bash
   docker compose -f deploy/docker-compose.yml up -d --build
   ```

4. Verify all services are healthy:
   ```bash
   docker compose -f deploy/docker-compose.yml ps
   ```

5. Check frontend health:
   ```bash
   curl http://localhost:3000/api/health
   ```

### Partial Restore (Single Volume)

To restore a single volume from a backup:

```bash
TIMESTAMP="2026-02-22_03-30-00"
VOLUME="redis-data"

# Extract the specific archive
docker run --rm \
  -v "deploy_${VOLUME}:/volume" \
  -v "$(pwd)/backups/$TIMESTAMP:/backup:ro" \
  alpine:latest \
  sh -c "rm -rf /volume/* && tar -xzf /backup/${VOLUME}.tar.gz -C /volume"

# Restart the service
docker compose -f deploy/docker-compose.yml restart redis
```

## Offsite Backups

For production, copy backups to offsite storage:

```bash
# Example: S3
aws s3 sync backups/ s3://your-bucket/pod-backups/ --delete

# Example: Rsync to remote server
rsync -avz --delete backups/ user@backup-server:/backups/pod/
```

## Troubleshooting

### Backup fails with "volume not found"

The volume doesn't exist yet (services haven't been started). This is normal for fresh installations.

### Restore fails with permission errors

Ensure you have Docker permissions:
```bash
sudo usermod -aG docker $USER
# Log out and back in
```

### Backups are very large

Check if PodClaw memory contains large temporary files:
```bash
docker run --rm -v deploy_podclaw-memory:/volume alpine du -sh /volume/*
```

Clean up old memory files before backing up.
