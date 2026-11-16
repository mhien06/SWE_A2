# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim AS base

RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global pnpm@11.25.0
WORKDIR /workspace

FROM base AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter api... --store-dir=/pnpm/store

FROM dependencies AS build

COPY apps/api apps/api
RUN pnpm --filter api build
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --store-dir=/pnpm/store --filter api deploy --prod --legacy /opt/brewlite-api

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 brewlite \
    && useradd --system --uid 1001 --gid brewlite brewlite

COPY --from=build --chown=brewlite:brewlite /opt/brewlite-api ./

USER brewlite
EXPOSE 3001

# Render Free does not provide pre-deploy commands. Migrate is idempotent and
# must succeed before the API starts; production seed is intentionally omitted.
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy --config prisma7.config.ts && node dist/main.js"]
