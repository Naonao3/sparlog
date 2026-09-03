import type { Metadata } from 'next'
import { SignupForm } from '@/components/auth/SignupForm'

export const metadata: Metadata = { title: '新規登録' }

export default function SignupPage() {
  return <SignupForm />
}
