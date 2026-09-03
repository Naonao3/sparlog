import type { Metadata } from 'next'
import { ProfileForm } from '@/components/settings/ProfileForm'

export const metadata: Metadata = { title: '設定' }

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">設定</h1>
        <p className="text-sm text-muted-foreground">プロフィールとアカウントを管理します。</p>
      </div>
      <ProfileForm />
    </div>
  )
}
