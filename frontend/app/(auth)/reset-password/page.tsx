import type { Metadata } from 'next'
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm'

export const metadata: Metadata = { title: 'パスワード再設定' }

export default function ResetPasswordPage() {
  return <ResetPasswordForm />
}
