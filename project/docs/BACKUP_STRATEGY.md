# Backup Strategy

This document outlines backup procedures for all persistent Docker volumes and
the Supabase Cloud database used by POD AI (Skapara).

---

## Volume Inventory

| Volume          | Service    | Contents                        | Priority |
|-----------------|------------|---------------------------------|----------|
| `redis-data`    | Redis      | Session cache, rate-limit state | Medium   |
| `podclaw-data`  | PodClaw    | Agent memory, context files     | High     |
| `caddy-data`    | Caddy      | TLS certificates (ACME)        | Low      |
| `caddy-config`  | Caddy      | Caddy runtime config            | Low      |
| `prometheus-data`| Prometheus | TSDB metrics (15d retention)   | Low      |
| `grafana-data`  | Grafana    | Dashboards, settings            | Medium   |
| `loki-data`     | Loki       | Log storage                     | Low      |

**Supabase Cloud database** (PostgreSQL 16) is managed by Supabase — see Supabase section below.

---

## Backup Commands

### Redis (`redis-data`)

```bash
# Create a timestamped backup tarball
docker run --rm \
  -v podai_redis-data:/data:ro \
  -v "$(pwd)/backups":/backup \
  alpine \
  tar czf /backup/redis-data-$(date +%Y%m%d-%H%M%S).tar.gz -C /data .

# Restore
docker run --rm \
  -v podai_redis-data:/data \
  -v "$(pwd)/backups":/backup \
  alpine \
  tar xzf /backup/<backup-file>.tar.gz -C /data
```

### PodClaw Memory (`podclaw-data`)

This is the most critical volume — contains agent memory, SOUL.md, and context files.

```bash
# Create a timestamped backup
docker run --rm \
  -v podai_podclaw-data:/data:ro \
  -v "$(pwd)/backups":/backup \
  alpine \
  tar czf /backup/podclaw-data-$(date +%Y%m%d-%H%M%S).tar.gz -C /data .

# Restore (stop podclaw first)
docker compose -p podai stop podclaw
docker run --rm \
  -v podai_podclaw-data:/data \
  -v "$(pwd)/backups":/backup \
  alpine \
  sh -c "rm -rf /data/* && tar xzf /backup/<backup-file>.tar.gz -C /data"
docker compose -p podai start podclaw
```

### Caddy TLS Certificates (`caddy-data`, `caddy-config`)

TLS certs auto-renew via ACME — backups are optional but useful to avoid rate limits.

```bash
# Backup both caddy volumes
for vol in caddy-data caddy-config; do
  docker run --rm \
    -v "podai_${vol}":/data:ro \
    -v "$(pwd)/backups":/backup \
    alpine \
    tar czf "/backup/${vol}-$(date +%Y%m%d-%H%M%S).tar.gz" -C /data .
done
```

### Grafana Dashboards (`grafana-data`)

```bash
docker run --rm \
  -v podai_grafana-data:/data:ro \
  -v "$(pwd)/backups":/backup \
  alpine \
  tar czf /backup/grafana-data-$(date +%Y%m%d-%H%M%S).tar.gz -C /data .
```

---

## Supabase Cloud Database

Supabase handles automated daily backups for paid plans. For additional control:

```bash
# Export schema + data using Supabase CLI (run from project root)
supabase db dump --data-only -f backups/supabase-data-$(date +%Y%m%d).sql
supabase db dump --schema-only -f backups/supabase-schema-$(date +%Y%m%d).sql

# Point-in-time recovery: use Supabase Dashboard → Settings → Backups
# URL: https://supabase.com/dashboard/project/yehvotdnhcwxjjpcznrf/settings/backups
```

---

## Daily Cron Backup Script

Save as `/opt/podai-backup.sh` and schedule via cron:

```bash
#!/usr/bin/env bash
# POD AI — Daily volume backup script
# Cron: 0 2 * * * /opt/podai-backup.sh

set -euo pipefail

BACKUP_DIR="/opt/backups/podai/$(date +%Y%m%d)"
COMPOSE_PROJECT="podai"
RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR"

# Backup high-priority volumes
for vol in podclaw-data redis-data grafana-data; do
  docker run --rm \
    -v "${COMPOSE_PROJECT}_${vol}":/data:ro \
    -v "$BACKUP_DIR":/backup \
    alpine \
    tar czf "/backup/${vol}.tar.gz" -C /data . \
    && echo "[OK] ${vol} backed up" \
    || echo "[WARN] ${vol} backup failed"
done

# Prune backups older than RETENTION_DAYS
find /opt/backups/podai -maxdepth 1 -type d -mtime +${RETENTION_DAYS} -exec rm -rf {} + 2>/dev/null || true

echo "[OK] Backup complete: $BACKUP_DIR"
```

Install the cron job:
```bash
chmod +x /opt/podai-backup.sh
echo "0 2 * * * root /opt/podai-backup.sh >> /var/log/podai-backup.log 2>&1" \
  | sudo tee /etc/cron.d/podai-backup
```

---

## Rotation Schedule

| Volume         | Frequency | Retention |
|----------------|-----------|-----------|
| `podclaw-data` | Daily     | 30 days   |
| `redis-data`   | Daily     | 7 days    |
| `grafana-data` | Weekly    | 4 weeks   |
| Caddy certs    | Weekly    | 2 weeks   |
| Supabase DB    | Daily     | Per plan  |

---

## Recovery Testing

Run a recovery test quarterly:

```bash
# Spin up test environment and restore podclaw-data backup
docker compose -p podai-test up -d podclaw
docker run --rm \
  -v podai-test_podclaw-data:/data \
  -v "$(pwd)/backups":/backup \
  alpine \
  sh -c "tar xzf /backup/<latest>.tar.gz -C /data"
# Verify memory files are intact
docker exec -it podai-test_podclaw_1 ls /workspace/memory/
```
