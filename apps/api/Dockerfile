FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/core/package.json packages/core/package.json
COPY apps/api/package.json apps/api/package.json

RUN npm ci

COPY packages/shared packages/shared
COPY packages/core packages/core
COPY apps/api apps/api

ENV PORT=4000
EXPOSE 4000

CMD ["npm", "--workspace", "@agent-foundry/api", "run", "dev"]
