FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copy workspace files
COPY package.json bun.lock tsconfig.json tsup.config.ts ./
COPY packages/common-utils ./packages/common-utils
COPY services/indexer ./services/indexer
COPY aws-wrappers/indexer-container ./aws-wrappers/indexer-container

# Install dependencies
RUN bun install --frozen-lockfile

# Build packages (Turborepo handles order implicitly, but we can call bun run build on each)
RUN cd packages/common-utils && bun run build && \
    cd ../../services/indexer && bun run build && \
    cd ../../aws-wrappers/indexer-container && bun run build

# Production stage
FROM oven/bun:1-alpine

WORKDIR /app

# Copy package configurations
COPY --from=builder /app/package.json ./
COPY --from=builder /app/bun.lock ./

# Copy package.json files for all required packages
COPY --from=builder /app/aws-wrappers/indexer-container/package.json ./aws-wrappers/indexer-container/
COPY --from=builder /app/packages/common-utils/package.json ./packages/common-utils/
COPY --from=builder /app/services/indexer/package.json ./services/indexer/

# Copy built dist files
COPY --from=builder /app/aws-wrappers/indexer-container/dist ./aws-wrappers/indexer-container/dist
COPY --from=builder /app/packages/common-utils/dist ./packages/common-utils/dist
COPY --from=builder /app/services/indexer/dist ./services/indexer/dist

# Install production dependencies only
RUN bun install --frozen-lockfile --production

WORKDIR /app/aws-wrappers/indexer-container

# Run the worker using bun
CMD ["bun", "run", "dist/index.js"]
