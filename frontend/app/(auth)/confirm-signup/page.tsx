import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ConfirmSignUpForm } from '@/components/auth/ConfirmSignUpForm'
import { Skeleton } from '@/components/ui/skeleton'

export const metadata: Metadata = { title: 'メールアドレスの確認' }

export default function ConfirmSignUpPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <ConfirmSignUpForm />
    </Suspense>
  )
}
