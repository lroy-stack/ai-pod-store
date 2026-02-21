# PodClaw — Autonomous POD Store Manager
# Build context: project/ (one level above deploy/)
#
# Build:  docker build -f deploy/Dockerfile -t podclaw .
# Run:    docker run --env-file frontend/.env.local -p 8000:8000 podclaw

FROM python:3.12-slim

# Install curl for healthchecks
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY deploy/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt && rm /tmp/requirements.txt

# Copy application code
COPY podclaw/ /app/podclaw/

# Create persistent data, memory, and workspace directories
RUN mkdir -p /app/podclaw/data /app/podclaw/memory /app/pod_workspace

# Non-root user (security hardening)
RUN addgroup --system --gid 1001 podclaw && \
    adduser --system --uid 1001 --ingroup podclaw podclaw && \
    chown -R podclaw:podclaw /app

USER podclaw

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["python", "-m", "podclaw.main"]
