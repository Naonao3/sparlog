import type { HonoJsonWebKey } from 'hono/utils/jwt/jws'
import { env } from '../config/env.js'

/**
 * Supabase Auth の署名鍵（JWKS）をメモリにキャッシュする。
 * リクエストごとに取得するとレイテンシと Supabase 側の負荷が増えるため、
 * TTL 切れか、未知の kid（鍵ローテーション直後）を受け取ったときだけ取り直す。
 */
const JWKS_URL = `${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`
const CACHE_TTL_MS = 10 * 60 * 1000
/** 不正な kid を大量に送られても JWKS を叩き続けないための下限間隔 */
const MIN_REFRESH_INTERVAL_MS = 30 * 1000

let cachedKeys: HonoJsonWebKey[] = []
let fetchedAt = 0
let inflight: Promise<HonoJsonWebKey[]> | null = null

function isJwks(value: unknown): value is { keys: HonoJsonWebKey[] } {
  if (typeof value !== 'object' || value === null) return false
  const keys = (value as Record<string, unknown>).keys
  return Array.isArray(keys) && keys.every((key) => typeof key === 'object' && key !== null)
}

async function fetchKeys(): Promise<HonoJsonWebKey[]> {
  const response = await fetch(JWKS_URL)
  if (!response.ok) {
    throw new Error(`JWKS の取得に失敗しました (status: ${response.status})`)
  }

  const body: unknown = await response.json()
  if (!isJwks(body)) {
    throw new Error('JWKS のレスポンス形式が不正です')
  }

  cachedKeys = body.keys
  fetchedAt = Date.now()
  return cachedKeys
}

/** 同時に複数リクエストが来ても取得は 1 回にまとめる */
async function refreshKeys(): Promise<HonoJsonWebKey[]> {
  if (!inflight) {
    inflight = (async () => {
      try {
        return await fetchKeys()
      } finally {
        inflight = null
      }
    })()
  }
  return await inflight
}

/** kid に対応する鍵を含む（はずの）鍵一覧を返す */
export async function getSigningKeys(kid: string): Promise<HonoJsonWebKey[]> {
  const elapsed = Date.now() - fetchedAt
  const hasKid = cachedKeys.some((key) => key.kid === kid)

  if (!hasKid && elapsed > MIN_REFRESH_INTERVAL_MS) {
    return await refreshKeys()
  }

  if (elapsed > CACHE_TTL_MS) {
    try {
      return await refreshKeys()
    } catch (error) {
      // 鍵を持っていれば、Supabase の一時的な障害で全リクエストを落とさないよう古い鍵で続行する
      console.error('[jwks] 鍵の再取得に失敗したためキャッシュを使用します', error)
      return cachedKeys
    }
  }

  return cachedKeys
}
