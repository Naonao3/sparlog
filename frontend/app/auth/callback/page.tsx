import type { Metadata } from 'next'
import { Suspense } from 'react'
import { OAuthCallback } from '@/components/auth/OAuthCallback'

export const metadata: Metadata = { title: 'ログイン中' }

/** Google ログイン（Cognito の OAuth）のリダイレクト先 */
export default function AuthCallbackPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <Suspense fallback={null}>
        <OAuthCallback />
      </Suspense>
    </div>
  )
}
