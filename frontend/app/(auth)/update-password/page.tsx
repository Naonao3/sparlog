import type { Metadata } from 'next'
import { UpdatePasswordForm } from '@/components/auth/UpdatePasswordForm'

export const metadata: Metadata = { title: '新しいパスワードの設定' }

export default function UpdatePasswordPage() {
  return <UpdatePasswordForm />
}
