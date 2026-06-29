# Dockerfile for ShortsAgent — installs ffmpeg + fonts, runs the Next.js app
FROM node:20-slim

# Install ffmpeg (with libfreetype/drawtext), fonts, and curl
RUN apt-get update && apt-get install -y \
    ffmpeg \
    fonts-dejavu-core \
    fonts-liberation \
    curl \
    xz-utils \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Verify ffmpeg has drawtext filter
RUN ffmpeg -filters 2>&1 | grep drawtext

WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./

# Install bun and dependencies
RUN npm install -g bun
RUN bun install --frozen-lockfile || bun install

# Copy prisma schema and generate client
COPY prisma ./prisma
RUN bun run db:generate

# Copy the rest of the app
COPY . .

# Build the app
RUN bun run build

# Create db directory
RUN mkdir -p db public/clips

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL=file:./db/custom.db

# Start command — init DB then run server
CMD ["sh", "-c", "bun run db:push && node .next/standalone/server.js"]
