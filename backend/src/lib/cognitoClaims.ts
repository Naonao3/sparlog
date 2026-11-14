/**
 * Cognito の ID トークンから、このアプリが使う情報だけを取り出す。
 * 署名・exp・iss・aud の検証は middleware/auth.ts で済ませた後に呼ぶこと。
 */
export interface AuthIdentity {
  /** Cognito の sub（UUID）。users.id として使う */
  userId: string
  /** Cognito の username。Google ユーザーは `google_xxx` になる（Admin API で使う） */
  username: string
  email: string
  /** `email` または IdP 名を小文字にしたもの（`google` など） */
  authProvider: string
  name: string | null
  picture: string | null
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

/**
 * `identities` クレームはフェデレーションユーザーにだけ付く。
 * ID トークンでは配列だが、JSON 文字列で入っている実装もあるため両方を受け付ける。
 */
function readProviderName(record: Record<string, unknown>): string | null {
  let identities: unknown = record.identities
  if (typeof identities === 'string') {
    try {
      identities = JSON.parse(identities)
    } catch {
      return null
    }
  }
  if (!Array.isArray(identities)) return null

  const first: unknown = identities[0]
  if (typeof first !== 'object' || first === null) return null
  const providerName = (first as Record<string, unknown>).providerName
  return typeof providerName === 'string' && providerName.length > 0 ? providerName : null
}

export type ParseResult =
  | { ok: true; identity: AuthIdentity }
  | { ok: false; reason: string }

export function parseCognitoIdToken(payload: unknown): ParseResult {
  if (typeof payload !== 'object' || payload === null) {
    return { ok: false, reason: 'ペイロードがオブジェクトではありません' }
  }
  const record = payload as Record<string, unknown>

  // アクセストークンにはメールアドレスが入らないため、API には ID トークンを送ってもらう
  if (record.token_use !== 'id') {
    return { ok: false, reason: 'ID トークンではありません' }
  }

  const userId = readString(record, 'sub')
  const username = readString(record, 'cognito:username')
  const email = readString(record, 'email')
  if (userId === null || username === null || email === null) {
    return { ok: false, reason: 'sub / cognito:username / email のいずれかがありません' }
  }

  // 未確認のメールアドレスは他人のものかもしれないので受け付けない
  const emailVerified = record.email_verified
  if (emailVerified !== true && emailVerified !== 'true') {
    return { ok: false, reason: 'メールアドレスが確認されていません' }
  }

  const providerName = readProviderName(record)

  return {
    ok: true,
    identity: {
      userId,
      username,
      email: email.toLowerCase(),
      authProvider: providerName === null ? 'email' : providerName.toLowerCase(),
      name: readString(record, 'name'),
      picture: readString(record, 'picture'),
    },
  }
}
