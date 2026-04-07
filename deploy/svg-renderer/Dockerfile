FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:22-alpine
RUN addgroup -S renderer && adduser -S renderer -G renderer
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY server.js ./
USER renderer
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3002/health || exit 1
CMD ["node", "server.js"]
