# -------------------------------
# Base image
# -------------------------------
FROM node:20-slim AS base

RUN apt-get update && apt-get install -y openssl

# -------------------------------
# Dependencies
# -------------------------------
FROM base AS deps
WORKDIR /app

COPY package*.json ./
RUN npm install --prefer-offline --no-audit --progress=false

# -------------------------------
# Builder
# -------------------------------
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma
RUN npx prisma generate

# Dummy env for build
ENV RAZORPAY_KEY_ID=dummy
ENV RAZORPAY_KEY_SECRET=dummy
ENV DATABASE_URL=file:/app/data/dev.db

# Build app
RUN npm run build

# -------------------------------
# Runner
# -------------------------------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Create user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# ✅ Copy ONLY standalone output (CRITICAL FIX)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
# Create SQLite folder
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

# Start standalone server
CMD ["node", "server.js"]