FROM node:20-alpine AS build
WORKDIR /workspace

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/server/package.json apps/server/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

COPY apps/server apps/server
COPY packages/shared packages/shared
RUN npm run build --workspace @space-shmup/server

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --omit=dev --workspace @space-shmup/server

COPY --from=build /workspace/apps/server/dist ./apps/server/dist

EXPOSE 3001
CMD ["node", "apps/server/dist/index.js"]
