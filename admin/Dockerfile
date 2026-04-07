# syntax=docker/dockerfile:1

# =============================================================================
# Multi-stage Dockerfile for POD AI Admin Panel (Next.js standalone)
# Base: node:22-alpine
# Stages: deps -> builder -> runner
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Install dependencies
# ---------------------------------------------------------------------------
FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install --ignore-scripts=false

# ---------------------------------------------------------------------------
# Stage 2: Build the application
# ---------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

# basePath is resolved at build time — must be an ARG so `next build`
# bakes /panel into all route prefixes and asset paths.
ARG ADMIN_BASE_PATH="/panel"
ENV ADMIN_BASE_PATH=$ADMIN_BASE_PATH

# Server-side vars needed at build time — Supabase client may be
# created at module scope during `next build`.
# SUPABASE_SERVICE_KEY is injected via BuildKit secret mount (never stored
# in image layers or docker history). Fallback to placeholder for local builds.
ARG SUPABASE_URL=https://placeholder.supabase.co
ENV SUPABASE_URL=$SUPABASE_URL

COPY --from=deps /app/node_modules ./node_modules

COPY . .

# Copy frontend translation files (injected via additional_contexts)
COPY --from=frontend-messages . ./frontend-messages/

# Ensure public/ exists (admin has no static assets yet)
RUN mkdir -p public

# Build the Next.js application.
# --mount=type=secret keeps SUPABASE_SERVICE_KEY out of image layers/history.
RUN --mount=type=secret,id=supabase_service_key \
    SUPABASE_SERVICE_KEY=$(cat /run/secrets/supabase_service_key 2>/dev/null || echo 'placeholder') \
    npm run build

# ---------------------------------------------------------------------------
# Stage 3: Production runner
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME="0.0.0.0"
ENV PORT=3001

RUN apk add --no-cache curl

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Frontend translations for the translations management API
COPY --from=builder /app/frontend-messages ./frontend-messages/

USER nextjs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3001/panel/api/health || exit 1

CMD ["node", "server.js"]
