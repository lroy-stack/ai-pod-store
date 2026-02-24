# ADR-0006: Docker Compose Orchestration with Caddy Reverse Proxy

## Status

Accepted

## Context

POD AI is a distributed application consisting of 8 services:
1. **Frontend** (Next.js, port 3000) - Customer-facing storefront
2. **Admin** (Next.js, port 3001) - Internal management panel
3. **PodClaw** (FastAPI, port 8000) - Agent system Bridge API
4. **MCP Server** (TypeScript, port 8002) - Model Context Protocol server for Claude Desktop
5. **Rembg** (Python, port 7000) - Background removal service for product images
6. **Redis** (port 6379) - Session persistence, rate limiting, caching
7. **Crawl4AI** (Python, port 11235) - Web scraping service for agent research
8. **Caddy** (port 80/443) - Reverse proxy, TLS termination, on-demand certificates

We evaluated three orchestration options:
- **Docker Compose**: YAML-based, simple, good for development and single-server production
- **Kubernetes**: Full-featured orchestration but massive operational overhead for 8 services
- **Nomad**: Simpler than K8s but still requires separate Consul, Vault for production

For a **single-server deployment** with 2-4 CPU cores and 8-16GB RAM, Kubernetes is overkill. Docker Compose provides enough orchestration for:
- Service discovery (via network aliases)
- Health checks and restart policies
- Volume management
- Resource limits
- Multi-stage startup (databases before apps)

## Decision

We will use **Docker Compose with Caddy as the reverse proxy**.

**Architecture**:
```
         ┌─────────────────────────────────────┐
         │        Caddy (ports 80/443)         │
         │  - TLS termination                  │
         │  - Reverse proxy                    │
         │  - On-demand certificates           │
         └─────────────┬───────────────────────┘
                       │
       ┌───────────────┼───────────────┬───────────────┐
       ▼               ▼               ▼               ▼
  Frontend:3000   Admin:3001     PodClaw:8000    MCP:8002
       │               │               │               │
       └───────────────┴───────────────┴───────────────┘
                       │
                       ▼
                  Redis:6379
       ┌───────────────┴───────────────┐
       ▼               ▼               ▼
  Rembg:7000    Crawl4AI:11235    Supabase Cloud
```

**Networks**:
- `proxy`: Caddy, frontend, admin, podclaw, mcp-server (public-facing)
- `data`: Frontend, admin, podclaw, mcp-server, Redis (internal data services)
- `ai-services`: PodClaw, rembg, crawl4ai (AI microservices)

**Startup sequence** (`start.sh`):
1. **Phase 1**: Redis, rembg, crawl4ai (data and AI services)
2. **Phase 2**: Frontend, admin, podclaw, mcp-server (application layer)
3. **Phase 3**: Caddy (reverse proxy after apps are healthy)

## Consequences

**Positive**:
- ✅ **Simple deployment**: `docker-compose up -d` on any server with Docker
- ✅ **Service discovery**: Services can reference each other by name (e.g., `http://redis:6379`)
- ✅ **Automatic TLS**: Caddy provisions Let's Encrypt certificates automatically
- ✅ **Health checks**: Docker restarts unhealthy containers automatically
- ✅ **Resource limits**: Memory/CPU limits prevent runaway processes (e.g., `mem_limit: 2G`)
- ✅ **Zero-config HTTPS**: Caddy handles TLS without manual cert management

**Negative**:
- ❌ **Single-server limitation**: No horizontal scaling (cannot run frontend on multiple servers)
- ❌ **No rolling deployments**: `docker-compose up` causes brief downtime during restart
- ❌ **No load balancing**: If a service crashes, Caddy returns 502 until restart
- ❌ **Manual scaling**: Cannot auto-scale based on CPU/memory metrics
- ❌ **Shared resources**: All services compete for the same CPU/RAM on one server

**Mitigations**:
- **Future migration path**: Docker Compose config can be converted to Kubernetes manifests with Kompose
- **Blue-green deployments**: Use two servers + DNS failover for zero-downtime deploys
- **Health-based routing**: Caddy's `health_path` directive prevents routing to unhealthy backends
- **Resource monitoring**: Prometheus + Grafana track resource usage to predict when to scale

## Implementation Notes

**docker-compose.yml**:
```yaml
version: '3.9'

services:
  frontend:
    build: ./frontend
    restart: unless-stopped
    environment:
      - NODE_ENV=production
    networks:
      - proxy
      - data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  caddy:
    image: caddy:2.7
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./deploy/Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    networks:
      - proxy
    depends_on:
      - frontend
      - admin
      - podclaw
      - mcp-server

networks:
  proxy:
    driver: bridge
  data:
    driver: bridge
  ai-services:
    driver: bridge

volumes:
  caddy_data:
  caddy_config:
  redis_data:
```

**Caddyfile** (reverse proxy config):
```caddyfile
# Frontend storefront
example.com {
  reverse_proxy frontend:3000
  encode gzip
  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains"
  }
}

# Admin panel
example.com/panel/* {
  reverse_proxy admin:3001
}

# PodClaw Bridge API
api.example.com {
  reverse_proxy podclaw:8000
}
```

**On-demand TLS** (for multi-tenant custom domains):
```caddyfile
*.pod-ai.app {
  tls {
    on_demand
  }
  reverse_proxy frontend:3000
}
```

**Startup script** (`start.sh`):
```bash
#!/bin/bash
set -e

echo "Phase 1: Starting data services..."
docker-compose up -d redis rembg crawl4ai
sleep 5

echo "Phase 2: Starting application layer..."
docker-compose up -d frontend admin podclaw mcp-server
sleep 10

echo "Phase 3: Starting reverse proxy..."
docker-compose up -d caddy

echo "All services started. Checking health..."
docker-compose ps
```

## References

- Docker Compose file: `project/docker-compose.yml`
- Caddyfile: `project/deploy/Caddyfile`
- Startup script: `project/start.sh`
- Caddy docs: https://caddyserver.com/docs/
