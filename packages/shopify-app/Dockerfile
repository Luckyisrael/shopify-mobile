# Production Dockerfile - Multi-stage build for optimization
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl curl

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --only=production && npm cache clean --force

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production image, copy all the files and run the app
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 shopify

# Copy built application
COPY --from=builder --chown=shopify:nodejs /app/build ./build
COPY --from=builder --chown=shopify:nodejs /app/package*.json ./
COPY --from=builder --chown=shopify:nodejs /app/prisma ./prisma
COPY --from=deps --chown=shopify:nodejs /app/node_modules ./node_modules

# Generate Prisma client
RUN npx prisma generate

USER shopify

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["npm", "run", "docker-start"]
