/**
 * Cognito（Amplify Auth）のエラーを、画面に出せる日本語のメッセージに変換する。
 * Amplify のエラーは name に Cognito の例外名が入る。
 */
const MESSAGES: Record<string, string> = {
  NotAuthorizedException: 'メールアドレスまたはパスワードが正しくありません',
  UserNotFoundException: 'メールアドレスまたはパスワードが正しくありません',
  UsernameExistsException: 'このメールアドレスはすでに登録されています',
  InvalidPasswordException: 'パスワードが条件を満たしていません（8文字以上）',
  CodeMismatchException: '確認コードが正しくありません',
  ExpiredCodeException: '確認コードの有効期限が切れています。コードを再送してください',
  LimitExceededException: '試行回数の上限に達しました。しばらく待ってから再度お試しください',
  TooManyRequestsException: 'リクエストが多すぎます。しばらく待ってから再度お試しください',
  TooManyFailedAttemptsException: '失敗回数が多すぎます。しばらく待ってから再度お試しください',
  CodeDeliveryFailureException: '確認コードのメールを送信できませんでした',
  UserAlreadyAuthenticatedException: 'すでにログインしています',
  NetworkError: 'ネットワークに接続できませんでした',
}

export function toAuthErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return MESSAGES[error.name] ?? error.message
  }
  return '不明なエラーが発生しました'
}
