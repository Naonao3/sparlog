/** オープンリダイレクトを防ぐため、同一オリジン内のパスだけを許可する */
export function toSafeRedirectPath(value: string | null | undefined, fallback = '/videos'): string {
  if (!value) return fallback
  return value.startsWith('/') && !value.startsWith('//') ? value : fallback
}

const REDIRECT_KEY = 'sparlog:auth:redirectTo'
const MESSAGE_KEY = 'sparlog:auth:message'

/**
 * Google ログインは Cognito を経由してページごと遷移するため、
 * 戻ってきた後の遷移先やエラーメッセージを sessionStorage で受け渡す。
 * （プライベートブラウズ等で使えない場合は無視する）
 */
function write(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value)
  } catch {
    // 使えなければ既定の遷移先 / メッセージなしで続行する
  }
}

function take(key: string): string | null {
  try {
    const value = window.sessionStorage.getItem(key)
    window.sessionStorage.removeItem(key)
    return value
  } catch {
    return null
  }
}

export function saveRedirectPath(path: string): void {
  write(REDIRECT_KEY, toSafeRedirectPath(path))
}

export function takeRedirectPath(): string {
  return toSafeRedirectPath(take(REDIRECT_KEY))
}

/** ログイン画面で表示するメッセージ（ログアウトでページ遷移しても残す） */
export function saveLoginMessage(message: string): void {
  write(MESSAGE_KEY, message)
}

export function takeLoginMessage(): string | null {
  return take(MESSAGE_KEY)
}
