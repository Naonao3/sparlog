import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { createClient } from '@/lib/supabase/server'

/**
 * 認証が必要な画面の共通レイアウト。
 * middleware でも弾いているが、Server Component 側でも必ず確認する。
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-dvh bg-background">
      <Sidebar />
      <div className="lg:pl-60">
        <Header email={user.email ?? ''} />
        <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  )
}
