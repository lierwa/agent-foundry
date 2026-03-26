FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/workbench/package.json apps/workbench/package.json

RUN npm ci --workspace @agent-foundry/workbench --include-workspace-root

COPY apps/workbench apps/workbench

ENV NEXT_PUBLIC_API_BASE_URL=http://api:4000
EXPOSE 3000

CMD ["npm", "--workspace", "@agent-foundry/workbench", "run", "dev", "--", "-H", "0.0.0.0", "-p", "3000"]
