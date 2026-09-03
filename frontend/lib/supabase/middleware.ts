import { createServerClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

/** 認証が不要なパス */
const PUBLIC_PATHS = ['/login', '/signup', '/reset-password', '/update-password', '/auth/callback']

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

/**
 * リクエストごとに Supabase セッションを更新し、未認証ならログインへ飛ばす。
 * Cookie の更新を反映させるため、必ずこの関数が返した response を使うこと。
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  // Supabase に到達できない場合でもアプリ全体を 500 にしない（未認証として扱う）
  let user: User | null = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    user = null
  }

  const { pathname } = request.nextUrl

  if (!user && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // ログイン済みのユーザーを認証画面に留まらせない
  if (user && (pathname === '/login' || pathname === '/signup')) {
    const videosUrl = request.nextUrl.clone()
    videosUrl.pathname = '/videos'
    videosUrl.search = ''
    return NextResponse.redirect(videosUrl)
  }

  return response
}
