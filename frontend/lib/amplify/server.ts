import { createServerRunner } from '@aws-amplify/adapter-nextjs'
import { fetchAuthSession } from 'aws-amplify/auth/server'
import { cookies } from 'next/headers'
import { amplifyConfig } from './config'

/**
 * Server Component / Route Handler / middleware で Amplify を使うためのランナー。
 * ブラウザ側は Amplify.configure(..., { ssr: true }) によりトークンを Cookie に保存するので、
 * サーバー側はその Cookie からセッションを読む。
 */
export const { runWithAmplifyServerContext } = createServerRunner({ config: amplifyConfig })

export interface ServerUser {
  userId: string
  email: string
}

/**
 * Server Component でログイン中のユーザーを取得する。未ログインなら null。
 * Server Component では Cookie を書き換えられないため、トークンの更新は middleware に任せる。
 */
export async function getServerUser(): Promise<ServerUser | null> {
  try {
    const session = await runWithAmplifyServerContext({
      nextServerContext: { cookies },
      operation: (contextSpec) => fetchAuthSession(contextSpec),
    })
    const payload = session.tokens?.idToken?.payload
    if (!payload || typeof payload.sub !== 'string') return null
    return {
      userId: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : '',
    }
  } catch {
    // Cognito に到達できない等。画面全体を 500 にせず未ログインとして扱う
    return null
  }
}
