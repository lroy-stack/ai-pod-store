# Quick Start Guide

Get the platform running locally in under 15 minutes.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Docker | 24+ | [docs.docker.com/get-docker](https://docs.docker.com/get-docker/) |
| Docker Compose | v2+ | Included with Docker Desktop |
| Git | any | [git-scm.com](https://git-scm.com) |

---

## Step 1 — Clone

```bash
git clone https://github.com/YOUR_USERNAME/pod-platform.git
cd pod-platform
```

---

## Step 2 — First Run (creates .env)

```bash
./start.sh --private
```

The script will:
1. Detect that `.env` doesn't exist
2. Copy `.env.example` to `.env`
3. Stop and ask you to fill in your API keys

---

## Step 3 — Fill in Required Variables

Open `.env` and set these **required** variables:

```bash
# Database (Supabase Cloud — free tier at supabase.com)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Payments (Stripe — test mode at stripe.com)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Print fulfillment (printful.com/api)
PRINTFUL_API_TOKEN=your-token
PRINTFUL_STORE_ID=your-store-id

# Email (Resend — free tier at resend.com)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@yourdomain.com

# AI (Google AI Studio — free tier at aistudio.google.com)
GEMINI_API_KEY=your-gemini-key

# AI image generation (fal.ai — pay per use)
FAL_KEY=your-fal-key

# Internal secrets (generate with: openssl rand -hex 32)
REDIS_PASSWORD=your-redis-password
PODCLAW_BRIDGE_AUTH_TOKEN=your-bridge-token
SESSION_SECRET=your-session-secret
MCP_JWT_SECRET=your-jwt-secret
MCP_APPROVE_SECRET=your-approve-secret
CRON_SECRET=your-cron-secret
REVALIDATION_SECRET=your-revalidation-secret
```

---

## Step 4 — Set Up Claude Auth (for PodClaw agents)

PodClaw uses the Claude Agent SDK with your Claude Max subscription:

```bash
# Install Claude Code CLI if not already installed
npm install -g @anthropic-ai/claude-code

# Authenticate (one-time)
claude auth login
```

> **Claude Max Plan required.** The agents use session-based auth — no `ANTHROPIC_API_KEY` needed.

---

## Step 5 — Set Up Database

```bash
# Install Supabase CLI
brew install supabase/tap/supabase  # macOS
# or: npm install -g supabase

# Link to your project
supabase link --project-ref <your-project-ref>

# Push all migrations
supabase db push
```

---

## Step 6 — Configure Your Brand

In `.env`, set your store identity:

```bash
NEXT_PUBLIC_SITE_NAME=My Store Name
NEXT_PUBLIC_SITE_TAGLINE=Custom products, made for you
NEXT_PUBLIC_BASE_URL=http://localhost:3000   # Update for production
STORE_CONTACT_EMAIL=hello@yourdomain.com
STORE_COMPANY_NAME=Your Company Name
STORE_DOMAIN=yourdomain.com
```

---

## Step 7 — Start

```bash
./start.sh --private
```

Open http://localhost:3000 — your store is running.

---

## Verifying Everything Works

```bash
# Check all services are healthy
./start.sh --status

# Or manually
curl http://localhost:3000/api/health    # Frontend: {"status":"ok"}
curl http://localhost:8100/health        # PodClaw: {"status":"ok"}  (host port 8100 in --private mode)
curl http://localhost:8002/health        # MCP: {"status":"ok"}
```

---

## Common Issues

**`./start.sh: Permission denied`**
```bash
chmod +x start.sh
```

**Port 3000 already in use:**
```bash
lsof -i :3000 && kill -9 <PID>
```

**PodClaw fails to start:**
```bash
docker compose logs podclaw
# Most likely: claude auth login not run, or missing SUPABASE vars
```

**`supabase db push` fails:**
- Ensure your Supabase project ref is correct
- Check that your `SUPABASE_SERVICE_KEY` has the right permissions

---

## Next Steps

- [02-env-reference.md](02-env-reference.md) — All environment variables explained
- [03-deployment.md](03-deployment.md) — Deploy to a VPS with a real domain
- [04-white-label.md](04-white-label.md) — Full branding customization
