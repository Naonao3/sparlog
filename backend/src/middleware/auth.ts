import { createMiddleware } from 'hono/factory'
import { verifyWithJwks } from 'hono/jwt'
import type { VerifyOptions } from 'hono/utils/jwt/jwt'
import { decodeHeader } from 'hono/utils/jwt/jwt'
import { cognitoIssuer, env } from '../config/env.js'
import { parseCognitoIdToken } from '../lib/cognitoClaims.js'
import { unauthorized } from '../lib/errors.js'
import { getSigningKeys } from '../lib/jwks.js'
import * as userService from '../services/user.js'
import type { AppEnv } from '../types/index.js'

/** Cognito は RS256 で署名する。ヘッダの alg はこれ以外を受け付けない（alg 混同攻撃対策） */
const ALLOWED_ALGORITHMS = ['RS256'] as const

/**
 * exp / nbf は hono/jwt が検証する。iss と aud（ID トークンではアプリクライアントID）はここで固定する。
 * iat は許容誤差なしで「未来でないこと」を検証されるため、発行元とこのサーバーの時計が
 * 数秒ずれているだけでログイン直後のトークンが弾かれる。有効期限は exp で担保されるので無効にする。
 */
const verification: VerifyOptions = {
  iss: cognitoIssuer,
  aud: env.COGNITO_CLIENT_ID,
  iat: false,
}

function readKid(token: string): string {
  try {
    const header: unknown = decodeHeader(token)
    if (typeof header === 'object' && header !== null) {
      const { kid } = header as Record<string, unknown>
      if (typeof kid === 'string' && kid.length > 0) return kid
    }
  } catch {
    // 下で unauthorized を投げる
  }
  throw unauthorized('トークンの形式が不正です')
}

/** クライアントには理由を返さず、原因調査のためにサーバーログにだけ残す（トークン本体は出さない） */
function logVerifyFailure(reason: unknown, token: string): void {
  const message = reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason)
  // hono/jwt のエラーメッセージにはトークン本体が含まれる場合があるため伏せる
  console.warn(`[auth] JWT の検証に失敗しました - ${message.replaceAll(token, '<token>')}`)
}

/** 署名・exp・iss・aud を検証してペイロードを返す（テストのため export） */
export async function verifyToken(token: string): Promise<unknown> {
  const kid = readKid(token)

  // JWKS の取得失敗はクライアントの問題ではないため、401 にせずエラーハンドラ（500）に任せる
  const keys = await getSigningKeys(kid)

  try {
    return await verifyWithJwks(token, {
      keys,
      allowedAlgorithms: ALLOWED_ALGORITHMS,
      verification,
    })
  } catch (error) {
    logVerifyFailure(error, token)
    throw unauthorized('トークンが無効または期限切れです')
  }
}

/**
 * Cognito が発行した ID トークンの署名を検証し、ユーザー情報をコンテキストに載せる。
 * このサーバーは認証そのものを行わない（サインイン等はすべて Cognito に委譲）。
 * 初めて見るユーザーはここで users 行を作成する。
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
  const parsed = parseCognitoIdToken(payload)
  if (!parsed.ok) {
    logVerifyFailure(parsed.reason, token)
    throw unauthorized('トークンのペイロードが不正です')
  }

  await userService.ensureUser(parsed.identity)

  c.set('userId', parsed.identity.userId)
  c.set('identity', parsed.identity)

  await next()
})
