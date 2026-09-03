import { serve } from '@hono/node-server'
import { Prisma } from '@prisma/client'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import { ZodError } from 'zod'
import { env, isProduction } from './config/env.js'
import { AppError, internalError, notFound } from './lib/errors.js'
import { authMiddleware } from './middleware/auth.js'
import { categoriesRoute } from './routes/categories.js'
import { commentsRoute } from './routes/comments.js'
import { tagsRoute } from './routes/tags.js'
import { timestampCommentsRoute } from './routes/timestampComments.js'
import { usersRoute } from './routes/users.js'
import { videosRoute } from './routes/videos.js'
import { assertFfmpegAvailable } from './services/ffmpeg.js'
import type { AppEnv } from './types/index.js'

assertFfmpegAvailable()

const app = new Hono<AppEnv>()

app.use('*', logger())
app.use('*', secureHeaders())
app.use(
  '/api/*',
  cors({
    origin: env.CORS_ORIGINS,
    allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type'],
    maxAge: 86400,
  }),
)

app.get('/health', (c) => c.json({ status: 'ok', uptime: process.uptime() }))

// ここから下はすべて認証が必要
const api = new Hono<AppEnv>()
api.use('*', authMiddleware)

api.route('/users', usersRoute)
api.route('/videos', videosRoute)
api.route('/videos', commentsRoute)
api.route('/videos', timestampCommentsRoute)
api.route('/tags', tagsRoute)
api.route('/categories', categoriesRoute)

app.route('/api/v1', api)

app.notFound(() => {
  throw notFound('エンドポイントが見つかりません')
})

/**
 * エラー整形はここに集約する。各ルートで try/catch を書かないこと。
 */
app.onError((err, c) => {
  if (err instanceof AppError) {
    if (err.status >= 500) console.error('[error]', err)
    return c.json(err.toBody(), err.status)
  }

  if (err instanceof ZodError) {
    return c.json(
      new AppError('VALIDATION_ERROR', 'リクエストの内容が正しくありません', 400, err.issues).toBody(),
      400,
    )
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2025') {
      return c.json(new AppError('NOT_FOUND', 'リソースが見つかりません', 404).toBody(), 404)
    }
    if (err.code === 'P2002') {
      return c.json(new AppError('CONFLICT', 'すでに存在するデータです', 409).toBody(), 409)
    }
    if (err.code === 'P2003') {
      return c.json(
        new AppError('BAD_REQUEST', '関連するデータが存在しません', 400).toBody(),
        400,
      )
    }
  }

  console.error('[error]', err)
  const fallback = internalError(
    isProduction ? 'サーバー内部でエラーが発生しました' : (err.message ?? 'Unknown error'),
  )
  return c.json(fallback.toBody(), fallback.status)
})

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`[sparlog] API server listening on http://localhost:${info.port}`)
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0))
  })
}

export { app }
