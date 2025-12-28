FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.26.0 --activate

# Copy workspace files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.json tsup.config.ts ./
COPY packages/common-utils ./packages/common-utils
COPY services/indexer ./services/indexer
COPY aws-wrappers/indexer-container ./aws-wrappers/indexer-container

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build packages in dependency order (combined to avoid stale cache issues)
RUN pnpm --filter @local-packages/common-utils build && \
    pnpm --filter @local-service/indexer build && \
    pnpm --filter @local-wrapper/indexer-container build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Copy built files
COPY --from=builder /app/aws-wrappers/indexer-container/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

# Run the worker
CMD ["node", "dist/index.js"]
