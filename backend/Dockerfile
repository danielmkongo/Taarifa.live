FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache dumb-init

# ── Dependencies ───────────────────────────────────────────────────────────────
FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production

# ── Development ────────────────────────────────────────────────────────────────
FROM base AS development
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["dumb-init", "node", "--watch", "src/server.js"]

# ── Production ─────────────────────────────────────────────────────────────────
FROM base AS production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p /app/exports
EXPOSE 3000
USER node
CMD ["dumb-init", "node", "src/server.js"]
