'use client'

import { useQueryClient } from '@tanstack/react-query'
import { signOut as amplifySignOut } from 'aws-amplify/auth'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { ApiError } from '@/lib/api/client'
import { queryKeys } from '@/lib/api/queryKeys'
import * as usersApi from '@/lib/api/users'
import { saveLoginMessage } from '@/lib/auth/redirect'

/**
 * Cognito でのログイン直後に API 側のアカウントを確認する。
 * API は初回リクエストで users 行を作るが、同じメールアドレスが別のログイン方法
 * （メール＋パスワード / Google）で登録済みだと 409 を返すので、その場合はログアウトさせる。
 *
 * 成功したら true。409 のときはメッセージをログイン画面に引き継いでログアウトし、false を返す。
 */
export function useVerifyAccount(): () => Promise<boolean> {
  const queryClient = useQueryClient()

  return useCallback(async () => {
    try {
      await queryClient.fetchQuery({
        queryKey: queryKeys.profile,
        queryFn: usersApi.getMyProfile,
      })
      return true
    } catch (error: unknown) {
      if (error instanceof ApiError && error.code === 'CONFLICT') {
        saveLoginMessage(error.message)
        queryClient.clear()
        // Google ログインの場合は Cognito のログアウト画面を経由して /login に戻る
        await amplifySignOut()
        return false
      }
      // それ以外（API の一時的な障害など）はログイン自体は成功しているので先へ進める
      return true
    }
  }, [queryClient])
}

/** ログアウトしてログイン画面へ戻る */
export function useSignOut(): () => Promise<void> {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useCallback(async () => {
    await amplifySignOut()
    queryClient.clear()
    router.push('/login')
    router.refresh()
  }, [queryClient, router])
}
