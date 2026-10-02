import { createMiddleware } from 'hono/factory'
import { verify, verifyWithJwks } from 'hono/jwt'
import type { VerifyOptions } from 'hono/utils/jwt/jwt'
import { decodeHeader } from 'hono/utils/jwt/jwt'
import { env } from '../config/env.js'
import { getSigningKeys } from '../lib/jwks.js'
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

/** 非対称鍵で署名されたトークンとして受け入れるアルゴリズム（Supabase の JWT Signing Keys） */
const ASYMMETRIC_ALGORITHMS = ['ES256', 'RS256'] as const

/**
 * exp / nbf は hono/jwt が検証する。aud と iss はここで固定する。
 * iat は許容誤差なしで「未来でないこと」を検証されるため、Supabase とこのサーバーの時計が
 * 数秒ずれているだけでログイン直後のトークンが弾かれる。有効期限は exp で担保されるので無効にする。
 */
const verification: VerifyOptions = {
  aud: 'authenticated',
  iss: `${env.SUPABASE_URL}/auth/v1`,
  iat: false,
}

function readHeader(token: string): { alg: string; kid?: string } {
  try {
    const header: unknown = decodeHeader(token)
    if (typeof header === 'object' && header !== null) {
      const { alg, kid } = header as Record<string, unknown>
      if (typeof alg === 'string') {
        return { alg, kid: typeof kid === 'string' ? kid : undefined }
      }
    }
  } catch {
    // 下で unauthorized を投げる
  }
  throw unauthorized('トークンの形式が不正です')
}

/** クライアントには理由を返さず、原因調査のためにサーバーログにだけ残す（トークン本体は出さない） */
function logVerifyFailure(error: unknown, token: string): void {
  const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  // hono/jwt のエラーメッセージにはトークン本体が含まれる場合があるため伏せる
  console.warn(`[auth] JWT の検証に失敗しました - ${reason.replaceAll(token, '<token>')}`)
}

async function verifyToken(token: string): Promise<unknown> {
  const { alg, kid } = readHeader(token)

  // alg はヘッダの値をそのまま信用せず、許可したものだけを鍵の種類と対応付けて検証する（alg 混同攻撃対策）
  if (alg === 'HS256') {
    if (!env.SUPABASE_JWT_SECRET) {
      throw unauthorized('HS256 のトークンは受け付けていません')
    }
    try {
      return await verify(token, env.SUPABASE_JWT_SECRET, { alg: 'HS256', ...verification })
    } catch (error) {
      logVerifyFailure(error, token)
      throw unauthorized('トークンが無効または期限切れです')
    }
  }

  if (!kid) {
    throw unauthorized('トークンの形式が不正です')
  }

  // JWKS の取得失敗はクライアントの問題ではないため、401 にせずエラーハンドラ（500）に任せる
  const keys = await getSigningKeys(kid)

  try {
    return await verifyWithJwks(token, {
      keys,
      allowedAlgorithms: ASYMMETRIC_ALGORITHMS,
      verification,
    })
  } catch (error) {
    logVerifyFailure(error, token)
    throw unauthorized('トークンが無効または期限切れです')
  }
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

  const payload = await verifyToken(token)
  if (!isSupabaseJwtPayload(payload)) {
    throw unauthorized('トークンのペイロードが不正です')
  }

  c.set('userId', payload.sub)
  c.set('userEmail', payload.email ?? null)

  await next()
})
