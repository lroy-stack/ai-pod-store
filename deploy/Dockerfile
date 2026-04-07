# PodClaw — Autonomous POD Store Manager
# Build context: project/ (one level above deploy/)
#
# Build:  docker build -f deploy/Dockerfile -t podclaw .
# Run:    docker run --env-file frontend/.env.local -p 8000:8000 podclaw

FROM python:3.12-slim

# Install curl for healthchecks + Node.js for Claude Agent SDK CLI + create non-root user
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && addgroup --system --gid 1001 podclaw \
    && adduser --system --uid 1001 --ingroup podclaw --home /home/podclaw podclaw

# Install Claude Code CLI globally (required by claude-agent-sdk Python package)
RUN npm install -g @anthropic-ai/claude-code@latest --ignore-scripts 2>/dev/null \
    && claude --version || echo "Claude CLI installed"

WORKDIR /app

# Install Python dependencies
COPY podclaw/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt && rm /tmp/requirements.txt

# Create persistent data, memory, and workspace directories (owned by podclaw)
# CRITICAL: /home/podclaw must be writable — Claude CLI writes config/state there
RUN mkdir -p /app/podclaw/data /app/podclaw/memory /app/pod_workspace \
    /home/podclaw/.claude /home/podclaw/.claude/data \
    && chown -R podclaw:podclaw /home/podclaw \
    /app/podclaw/data /app/podclaw/memory /app/pod_workspace

# Copy application code with correct ownership
COPY --chown=podclaw:podclaw podclaw/ /app/podclaw/

# Create .claude.json so SDK doesn't loop looking for it on first boot
RUN echo '{}' > /home/podclaw/.claude.json \
    && chown podclaw:podclaw /home/podclaw/.claude.json

USER podclaw
ENV HOME=/home/podclaw

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["python", "-m", "podclaw.main"]
