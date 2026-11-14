'use client'

import { fetchAuthSession } from 'aws-amplify/auth'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { useVerifyAccount } from '@/hooks/useAuth'
import { saveLoginMessage, takeRedirectPath } from '@/lib/auth/redirect'

/**
 * Cognito から認可コード付きで戻ってきたときの処理。
 * コードとトークンの交換は Amplify（enable-oauth-listener）が行い、
 * fetchAuthSession はその完了を待ってからセッションを返す。
 */
export function OAuthCallback() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const verifyAccount = useVerifyAccount()
  const startedRef = useRef(false)

  useEffect(() => {
    // StrictMode の二重実行で処理が重複しないようにする
    if (startedRef.current) return
    startedRef.current = true

    async function complete(): Promise<void> {
      const redirectTo = takeRedirectPath()

      // ユーザーが Google の画面でキャンセルした場合など
      if (searchParams.get('error')) {
        saveLoginMessage('Googleログインを完了できませんでした')
        router.replace('/login')
        return
      }

      let signedIn = false
      try {
        const session = await fetchAuthSession()
        signedIn = session.tokens?.idToken !== undefined
      } catch {
        signedIn = false
      }

      if (!signedIn) {
        saveLoginMessage('Googleログインを完了できませんでした')
        router.replace('/login')
        return
      }

      if (!(await verifyAccount())) return

      router.replace(redirectTo)
      router.refresh()
    }

    void complete()
  }, [router, searchParams, verifyAccount])

  return <p className="text-sm text-muted-foreground">ログインしています…</p>
}
