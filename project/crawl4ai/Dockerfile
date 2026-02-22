# ============================================
# Stage 1: Builder
# ============================================
FROM python:3.11-slim AS builder

# Set working directory
WORKDIR /build

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY requirements.txt .

# Install Python dependencies in a virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install crawl4ai and dependencies WITHOUT sentence-transformers and torch
# This keeps the image lightweight by avoiding ML model dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ============================================
# Stage 2: Runtime
# ============================================
FROM python:3.11-slim

# Install runtime dependencies for Playwright/Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    chromium-driver \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libglib2.0-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv

# Set environment variables
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PLAYWRIGHT_BROWSERS_PATH=/opt/playwright \
    CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium

# Create non-root user for security
RUN groupadd -r crawl4ai && useradd -r -g crawl4ai -u 1000 crawl4ai

# Create application directory and set ownership
WORKDIR /app
RUN chown -R crawl4ai:crawl4ai /app

# Copy application code
COPY --chown=crawl4ai:crawl4ai . .

# Switch to non-root user
USER crawl4ai

# Install Playwright browser (Chromium only, lightweight)
RUN python -m playwright install chromium --with-deps || echo "Playwright already installed"

# Expose port for API (if running a FastAPI/Flask service)
EXPOSE 8003

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import crawl4ai; print('OK')" || exit 1

# Default command (override in docker-compose.yml)
CMD ["python", "-m", "uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8003"]
