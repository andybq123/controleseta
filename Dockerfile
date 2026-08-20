# Build stage: installs deps and runs the Vite/Nitro build (targets the
# "node-server" preset — a self-contained Node app in .output/).
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# Runtime stage: only needs Node + the self-contained .output/ tree
# (it bundles its own node_modules, no need to reinstall anything).
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /app/.output ./.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
