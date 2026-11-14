import { fetchAuthSession } from 'aws-amplify/auth/server'
import { NextResponse, type NextRequest } from 'next/server'
import { runWithAmplifyServerContext } from '@/lib/amplify/server'

/** 認証が不要なパス */
const PUBLIC_PATHS = ['/login', '/signup', '/confirm-signup', '/reset-password', '/auth/callback']

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

/**
 * リクエストごとに Cognito のセッションを確認し、未認証ならログインへ飛ばす。
 * ID トークンが期限切れならリフレッシュトークンで更新し、新しいトークンを Cookie に書き戻す
 * （書き戻しは response に対して行われるため、必ずこの response を返すこと）。
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const response = NextResponse.next()

  let authenticated = false
  try {
    authenticated = await runWithAmplifyServerContext({
      nextServerContext: { request, response },
      operation: async (contextSpec) => {
        const session = await fetchAuthSession(contextSpec)
        return session.tokens?.idToken !== undefined
      },
    })
  } catch {
    // Cognito に到達できない場合でもアプリ全体を 500 にしない（未認証として扱う）
    authenticated = false
  }

  const { pathname } = request.nextUrl

  if (!authenticated && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.search = ''
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // ログイン済みのユーザーを認証画面に留まらせない
  if (authenticated && (pathname === '/login' || pathname === '/signup')) {
    const videosUrl = request.nextUrl.clone()
    videosUrl.pathname = '/videos'
    videosUrl.search = ''
    return NextResponse.redirect(videosUrl)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * 静的アセットと画像最適化のリクエストを除く全てのパスに適用する
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
