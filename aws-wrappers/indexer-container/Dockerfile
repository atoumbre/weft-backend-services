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

# Install pnpm for deploy command
RUN corepack enable && corepack prepare pnpm@10.26.0 --activate

# Copy workspace structure for pnpm install
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./

# Copy package.json files for all required packages
COPY --from=builder /app/aws-wrappers/indexer-container/package.json ./aws-wrappers/indexer-container/
COPY --from=builder /app/packages/common-utils/package.json ./packages/common-utils/
COPY --from=builder /app/services/indexer/package.json ./services/indexer/

# Copy built dist files
COPY --from=builder /app/aws-wrappers/indexer-container/dist ./aws-wrappers/indexer-container/dist
COPY --from=builder /app/packages/common-utils/dist ./packages/common-utils/dist
COPY --from=builder /app/services/indexer/dist ./services/indexer/dist

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

WORKDIR /app/aws-wrappers/indexer-container

# Run the worker
CMD ["node", "dist/index.js"]
