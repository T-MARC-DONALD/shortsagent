# Dockerfile for ShortsAgent — optimized for faster builds
# Uses a multi-stage build to keep the final image small
FROM node:20-slim AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    curl \
    xz-utils \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files FIRST
COPY package.json bun.lock* ./

# Copy prisma schema BEFORE bun install (postinstall runs prisma generate)
COPY prisma ./prisma

# Install bun
RUN npm install -g bun

# Install dependencies (postinstall will run prisma generate — now it can find the schema)
RUN bun install --frozen-lockfile || bun install

# Copy the rest of the app
COPY . .

# Build the app
RUN bun run build

# --- Production stage ---
FROM node:20-slim AS runner

# Install ONLY the minimal ffmpeg (no GUI/video drivers) + fonts + curl
# This is much faster than installing full ffmpeg
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    fonts-dejavu-core \
    fonts-liberation \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Verify ffmpeg has the drawtext filter (critical for video generation)
RUN ffmpeg -filters 2>&1 | grep drawtext

WORKDIR /app

# Copy the standalone build from the builder stage
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/fonts ./fonts
COPY --from=builder /app/package.json ./

# Create necessary directories
RUN mkdir -p db public/clips

# Copy the init-db script
COPY scripts/init-db.js ./scripts/init-db.js

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL=file:./db/custom.db
ENV HOSTNAME=0.0.0.0

# Start command — init DB then run server
CMD ["sh", "-c", "node scripts/init-db.js && node server.js"]
