# Deployment Guide

Deploy the platform to a VPS with a real domain and automatic HTTPS.

---

## Recommended VPS Specs

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 4 cores | 8 cores |
| RAM | 16 GB | 32 GB |
| Storage | 80 GB SSD | 200+ GB SSD |
| OS | Ubuntu 22.04 | Ubuntu 24.04 LTS |

> **Memory note:** The full stack with monitoring uses ~8-12 GB RAM at idle.
> Without monitoring, ~4-6 GB is sufficient.

---

## 1. Server Setup

```bash
# On your VPS (as root)
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker && systemctl start docker

# Install Docker Compose (if not included)
apt install docker-compose-plugin -y

# Firewall (only open what's needed)
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (Caddy redirect to HTTPS)
ufw allow 443/tcp   # HTTPS
ufw enable
```

---

## 2. DNS Configuration

Point these DNS records to your VPS IP:

| Record | Type | Value |
|--------|------|-------|
| `yourdomain.com` | A | `<VPS IP>` |
| `admin.yourdomain.com` | A | `<VPS IP>` |
| `mcp.yourdomain.com` | A | `<VPS IP>` |
| `api.yourdomain.com` | A | `<VPS IP>` (only if self-hosting Supabase) |

Wait for DNS propagation (5-30 minutes) before running Caddy.

---

## 3. Deploy the Stack

```bash
# On your VPS
git clone https://github.com/YOUR_USERNAME/pod-platform.git /opt/pod-platform
cd /opt/pod-platform

# Configure
cp .env.example .env
nano .env  # Fill in all required variables

# Set production domain
DOMAIN=yourdomain.com
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
# ... (all other required vars)

# Start production stack (Supabase Cloud — most common)
./start.sh --public

# OR: with self-hosted Supabase (requires ENABLE_SUPABASE=true + extra vars in .env)
./start.sh --public  # reads ENABLE_SUPABASE from .env
```

Caddy automatically obtains TLS certificates from Let's Encrypt on first request.

> **Supabase Cloud vs Self-Hosted:** By default the stack uses Supabase Cloud (`ENABLE_SUPABASE=false`). Set `ENABLE_SUPABASE=true` in `.env` to spin up the full self-hosted Supabase stack (13 additional services). Self-hosted requires additional variables — see the `[SUPABASE SELF-HOSTED]` section in `.env.example`.

---

## 4. Verify Deployment

```bash
# Check all services are healthy
./start.sh --status

# Test endpoints
curl https://yourdomain.com/api/health
curl https://admin.yourdomain.com/panel/api/health
curl https://mcp.yourdomain.com/health
```

---

## 5. Claude Auth on Server

PodClaw agents require Claude authentication:

```bash
# Option A: Copy your local credentials to the server
scp ~/.claude/credentials.json user@yourserver:/root/.claude/

# Option B: Authenticate on the server directly
# (requires interactive terminal)
claude auth login
```

---

## 6. Stripe Webhooks

Register your webhook endpoint in Stripe:

1. Go to Stripe Dashboard → Webhooks → Add endpoint
2. Endpoint URL: `https://yourdomain.com/api/webhooks/stripe`
3. Events to send:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `checkout.session.completed`
   - `charge.refunded`
4. Copy the signing secret → set `STRIPE_WEBHOOK_SECRET` in `.env`
5. Rebuild and restart: `./start.sh --build && ./start.sh --public`

---

## 7. Cloudflare (Recommended)

Using Cloudflare in front of your VPS adds:
- DDoS protection
- CDN caching for static assets
- Bot management
- Web Application Firewall

**Setup:**
1. Add your domain to Cloudflare (free plan)
2. Update nameservers at your registrar
3. In Cloudflare → SSL/TLS → set to "Full (strict)"
4. Your Caddy auto-HTTPS still works — Cloudflare passes traffic through

---

## 8. Updates

```bash
cd /opt/pod-platform

# Pull latest changes
git pull

# Rebuild and restart changed services
docker compose build --no-cache frontend admin podclaw
./start.sh --public
```

---

## Service Management

```bash
# Logs
docker compose logs -f              # All services
docker compose logs -f frontend     # Specific service

# Restart one service
docker compose restart podclaw

# Stop all
./start.sh --down

# Free disk space after builds
docker builder prune -f
```

---

## Monitoring (Optional)

Enable Prometheus + Grafana + Loki:

```bash
# In .env:
ENABLE_MONITORING=true
GRAFANA_ADMIN_PASSWORD=your-secure-password

# Restart
./start.sh --public --with-monitoring
```

Grafana will be available at `https://grafana.yourdomain.com` (add DNS record).

---

## Backup

```bash
# Supabase: use their built-in backup (Dashboard → Settings → Backups)
# Or export manually:
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Redis: data is ephemeral (sessions, cache) — no critical data
```
