import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Supabase Auth のリダイレクト先。
 * OAuth・メール確認・パスワード再設定のいずれも、ここで code をセッションに交換する。
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/videos'
  // オープンリダイレクトを防ぐため、同一オリジン内のパスのみ許可する
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/videos'

  if (!code) {
    const errorDescription = searchParams.get('error_description') ?? 'authentication_failed'
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorDescription)}`,
    )
  }

  const supabase = createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`)
  }

  return NextResponse.redirect(`${origin}${safeNext}`)
}
