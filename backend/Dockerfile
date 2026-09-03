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
RUN npm ci --omit=dev && npm cache clean --force

# 生成済み Prisma Client をビルドステージから持ち込む（prisma CLI は devDependency のため）
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist

# ffmpeg / ffprobe は ffmpeg-static・ffprobe-static のバイナリを使う
USER node
EXPOSE 8080

CMD ["node", "dist/index.js"]
