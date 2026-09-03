import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

/**
 * Server Component / Route Handler 用の Supabase クライアント。
 * Server Component では Cookie を書き込めないため、set/remove の失敗は無視する
 * （セッションの更新は middleware.ts が担当する）。
 */
export function createClient(): SupabaseClient {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Server Component からの呼び出し。middleware がセッションを更新するため無視してよい
          }
        },
      },
    },
  )
}
