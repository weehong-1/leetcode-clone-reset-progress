# Frontend image: build the static Vite app, then serve it with nginx, which
# also reverse-proxies /api to the backend container.

# --- Build stage -------------------------------------------------------------
FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV CI=1
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# --- Serve stage -------------------------------------------------------------
FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
