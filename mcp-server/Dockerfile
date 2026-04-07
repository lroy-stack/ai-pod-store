FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN NODE_ENV=development npm ci
COPY tsconfig.json vite.config.ts ./
COPY src/ ./src/
COPY uis/ ./uis/
RUN WIDGET=product-grid npx vite build
RUN WIDGET=product-detail npx vite build
RUN WIDGET=cart-view npx vite build
RUN ls -R dist/uis/
RUN npx tsc

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache curl && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 mcp
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm prune --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 8002

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8002/health

USER mcp
CMD ["node", "dist/index.js"]
