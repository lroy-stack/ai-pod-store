FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
    "rembg[cpu]>=2.0.57" \
    "fastapi>=0.115.0" \
    "uvicorn[standard]>=0.34.0" \
    "python-multipart>=0.0.9" \
    "httpx>=0.27.0" \
    "pillow>=10.0.0"

# Pre-download u2net model (176MB) at build time — deterministic, fast cold start
RUN python -c "from rembg import new_session; new_session('u2net')"

COPY server.py .

# Run as non-root user with writable home for model cache + numba
RUN addgroup --system rembg && adduser --system --home /app/home --ingroup rembg rembg \
    && mkdir -p /app/home/.u2net /app/home/.cache/numba \
    && cp -r /root/.u2net/* /app/home/.u2net/ 2>/dev/null || true \
    && chown -R rembg:rembg /app
USER rembg

ENV HOME=/app/home
ENV NUMBA_CACHE_DIR=/app/home/.cache/numba

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8080/health

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8080"]
