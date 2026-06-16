# syntax=docker/dockerfile:1

# This network sits behind a Netskope TLS-inspecting proxy that presents a
# self-signed CA. Containers must trust it or all HTTPS (npm registry at build
# time; OpenAI/Google/Facebook APIs at runtime) fails with SELF_SIGNED_CERT_IN_CHAIN.
# netskope-ca.crt holds the corporate CA chain (captured from the proxy).

# ---- Build stage: install deps (compiles native better-sqlite3 if no prebuilt) ----
FROM node:20-bookworm-slim AS deps
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY netskope-ca.crt /usr/local/share/ca-certificates/netskope-ca.crt
RUN update-ca-certificates
ENV NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/netskope-ca.crt
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- Runtime stage: lean image with just the app + node_modules ----
FROM node:20-bookworm-slim AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY netskope-ca.crt /usr/local/share/ca-certificates/netskope-ca.crt
RUN update-ca-certificates
ENV NODE_ENV=production
ENV PORT=3000
# So the app's runtime HTTPS calls (OpenAI / Google Ads / GA / Facebook) trust the proxy CA
ENV NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/netskope-ca.crt
WORKDIR /app

# Copy installed dependencies from the build stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY . .

# data/ holds runtime-written JSON; ensure it exists and is owned by the app user
RUN mkdir -p /app/data && chown -R node:node /app

USER node
EXPOSE 3000
CMD ["node", "server.js"]
