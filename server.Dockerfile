# Backend API image: Node + tsx runtime, plus the language formatters that the
# /api/format endpoint shells out to. (Prettier for JS/TS arrives via pnpm.)
FROM node:24-bookworm-slim

# --- System formatters -------------------------------------------------------
# clang-format (C/C++), a headless JRE + the google-java-format jar (Java),
# and black (Python). ca-certificates is kept for outbound HTTPS to LeetCode.
ARG GJF_VERSION=1.22.0
ENV GOOGLE_JAVA_FORMAT_JAR=/opt/google-java-format.jar
RUN apt-get update \
	&& apt-get install -y --no-install-recommends \
		clang-format \
		default-jre-headless \
		black \
		curl \
		ca-certificates \
	&& curl -fsSL -o "${GOOGLE_JAVA_FORMAT_JAR}" \
		"https://github.com/google/google-java-format/releases/download/v${GJF_VERSION}/google-java-format-${GJF_VERSION}-all-deps.jar" \
	&& apt-get purge -y curl \
	&& apt-get autoremove -y \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV CI=1
RUN corepack enable

# --- Dependencies (cached separately from source) ---------------------------
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# --- Application source ------------------------------------------------------
COPY tsconfig.json ./
COPY server ./server
COPY shared ./shared

EXPOSE 3001
CMD ["pnpm", "run", "server"]
