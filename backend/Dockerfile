# syntax=docker/dockerfile:1

# ---------- build ----------
FROM node:22-slim AS builder

WORKDIR /app

# Prisma と ffmpeg-static のインストールに必要
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npx prisma generate && npm run build

# ---------- runtime ----------
FROM node:22-slim AS runner

ENV NODE_ENV=production
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
# prisma CLI は dependencies に含めている（migrate deploy をリリース時に実行するため）
RUN npm ci --omit=dev && npx prisma generate && npm cache clean --force

COPY --from=builder /app/dist ./dist

# ffmpeg / ffprobe は ffmpeg-static・ffprobe-static のバイナリを使う
USER node
EXPOSE 8080

CMD ["node", "dist/index.js"]
