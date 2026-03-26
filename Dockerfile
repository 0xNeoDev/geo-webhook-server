FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies (cached layer)
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

# Copy source
COPY src/ src/

# Run as non-root
USER bun
EXPOSE 3000

CMD ["bun", "run", "src/index.ts"]
