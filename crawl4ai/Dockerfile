# ============================================
# Crawl4AI — Self-hosted web crawler
# Based on official image, port 11235
# ============================================
FROM unclecode/crawl4ai:latest

# Override resource defaults via environment
ENV MAX_CONCURRENT_TASKS=1 \
    CRAWL4AI_API_TOKEN="" \
    PYTHONUNBUFFERED=1

# Crawl4AI built-in server port
EXPOSE 11235

# HTTP healthcheck against the real API
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -sf http://localhost:11235/monitor/health || exit 1
