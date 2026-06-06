FROM node:22-bookworm-slim AS deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner

ENV DEBIAN_FRONTEND=noninteractive
ENV HOME=/opt/ceur
ENV PATH=/opt/ceur/bin:/usr/local/bin:/usr/local/sbin:/usr/sbin:/usr/bin:/sbin:/bin
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV CEUR_MAX_CONCURRENT_CHECKS=2
ENV CEUR_MAX_QUEUED_CHECKS=8
ENV CEUR_QUEUE_TIMEOUT_MS=15000

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bash \
        binutils \
        ca-certificates \
        coreutils \
        curl \
        findutils \
        gawk \
        grep \
        perl \
        poppler-utils \
        python3 \
        python3-pdfminer \
        qpdf \
        sed \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /opt/ceur/bin \
    && curl -fsSL https://ceur-ws.org/ceurtools/check-pdf-errors \
        -o /opt/ceur/bin/check-pdf-errors \
    && curl -fsSL https://ceur-ws.org/ceurtools/check-libbyhead.py \
        -o /opt/ceur/bin/check-libbyhead.py \
    && chmod +x /opt/ceur/bin/check-pdf-errors /opt/ceur/bin/check-libbyhead.py

COPY bin/ceur-pdf-check /usr/local/bin/ceur-pdf-check
RUN chmod +x /usr/local/bin/ceur-pdf-check

WORKDIR /app
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
