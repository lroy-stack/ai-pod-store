# POD AI Setup Wizard

Zero-dependency setup tool for the POD AI Store platform.

## Prerequisites

- **Node.js >= 20** - [Download](https://nodejs.org/)
- **Docker Desktop** - [Download](https://www.docker.com/products/docker-desktop/)
- **Git** - [Download](https://git-scm.com/)

## Quick Start

Run the setup wizard with a single command:

```bash
node setup/setup.mjs
```

The wizard will:
1. ✅ Check your system for required software
2. 🔑 Collect API credentials for essential services
3. 🤖 Configure optional AI integrations
4. 📧 Set up optional services (email, search, messaging)
5. 📝 Generate `.env.local` files for frontend and admin
6. 🚀 Deploy the platform with Docker Compose

The setup wizard automatically opens in your browser at `http://localhost:4321`.

## What It Does

### Step 1: Prerequisites Check
- Verifies Docker Desktop is installed
- Checks for Docker Compose v2
- Validates Node.js version (>= 20)
- Ensures Git is available
- Confirms required ports are available (3000, 3001, 6379, 8090, 8000, 8080)

### Step 2: Essential Services
- **Supabase** - Database and authentication
- **Stripe** - Payment processing
- **Printify** - Print-on-demand fulfillment

### Step 3: AI Services (Optional)
- **Anthropic Claude** - Powers the PodClaw autonomous agent
- **fal.ai** - AI-powered design generation
- **Google Gemini** - RAG embeddings for semantic search

### Step 4: Optional Services
- **Resend** - Transactional email
- **Jina** - Advanced search and reranking
- **Telegram Bot** - Customer messaging
- **WhatsApp Business** - Customer messaging

### Step 5: Review & Generate
- Preview your configuration
- Generate `.env.local` files:
  - `project/frontend/.env.local`
  - `project/admin/.env.local`
- Download backup copies

### Step 6: Deploy
- Runs Docker Compose to build and start all services
- Shows real-time deployment status
- Launches your store at `http://localhost:3000`

## Services Deployed

The wizard starts 6 Docker services:

| Service | Port | Description |
|---------|------|-------------|
| **frontend** | 3000 | Next.js storefront (customer-facing) |
| **admin** | 3001 | Next.js admin panel |
| **podclaw** | 8000 | Python autonomous agent (FastAPI bridge) |
| **rembg** | 8090 | Background removal service |
| **redis** | 6379 | Cache and session storage |
| **caddy** | 80/443 | Reverse proxy and HTTPS |

## Manual Alternative

If you prefer to configure manually:

1. Copy `.env.example` files:
   ```bash
   cp project/frontend/.env.example project/frontend/.env.local
   cp project/admin/.env.example project/admin/.env.local
   ```

2. Edit both `.env.local` files and fill in your API credentials

3. Start services manually:
   ```bash
   cd project/deploy
   docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
   ```

## Technology

This wizard uses **zero external dependencies** - only Node.js built-in modules:
- `http` - Web server
- `fs` - File system operations
- `path` - Path utilities
- `child_process` - Command execution
- `url` - URL parsing

The UI is served as inline HTML with:
- **Tailwind CSS** (CDN)
- **Alpine.js** (CDN)
- **Lucide Icons** (CDN)

No `npm install` required!

## Troubleshooting

### Port Already in Use
If a required port is in use, stop the conflicting service:
```bash
lsof -ti:3000 | xargs kill  # Example for port 3000
```

### Docker Not Found
Ensure Docker Desktop is running and `docker` command is available:
```bash
docker info
docker compose version
```

### Prerequisites Not Met
The wizard will show red ✗ marks for missing requirements and provide download links.

## Support

For issues or questions:
- Check `project/CLAUDE.md` for design standards
- Review `app_spec.txt` for architecture details
- Inspect Docker logs: `docker compose logs -f`

## License

This setup wizard is part of the POD AI Store platform.
