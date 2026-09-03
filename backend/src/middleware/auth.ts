import { createMiddleware } from 'hono/factory'
import { verify } from 'hono/jwt'
import { env } from '../config/env.js'
import { unauthorized } from '../lib/errors.js'
import type { AppEnv } from '../types/index.js'

/** Supabase が発行する JWT のうち、本アプリが利用するクレームだけを型で表現する */
interface SupabaseJwtPayload {
  sub: string
  email?: string
  aud?: string | string[]
  exp?: number
  role?: string
}

function isSupabaseJwtPayload(value: unknown): value is SupabaseJwtPayload {
  if (typeof value !== 'object' || value === null) return false
  const sub = (value as Record<string, unknown>).sub
  return typeof sub === 'string' && sub.length > 0
}

/**
 * Supabase Auth が発行した JWT の署名を検証し、userId をコンテキストに載せる。
 * このサーバーは認証そのものを行わない（サインイン等はすべて Supabase Auth に委譲）。
 */
export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header('Authorization')
  if (!header?.startsWith('Bearer ')) {
    throw unauthorized('Authorization ヘッダがありません')
  }

  const token = header.slice('Bearer '.length).trim()
  if (token.length === 0) {
    throw unauthorized('トークンが空です')
  }

  // alg を明示して alg 混同攻撃を防ぐ。exp / nbf は hono/jwt が検証する。
  let payload: unknown
  try {
    payload = await verify(token, env.SUPABASE_JWT_SECRET, {
      alg: 'HS256',
      aud: 'authenticated',
    })
  } catch {
    throw unauthorized('トークンが無効または期限切れです')
  }

  if (!isSupabaseJwtPayload(payload)) {
    throw unauthorized('トークンのペイロードが不正です')
  }

  c.set('userId', payload.sub)
  c.set('userEmail', payload.email ?? null)

  await next()
})
