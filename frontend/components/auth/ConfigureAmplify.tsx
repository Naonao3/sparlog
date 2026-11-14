'use client'

import { Amplify } from 'aws-amplify'
// Google ログインから /auth/callback に戻ったとき、認可コードをトークンに交換させる
import 'aws-amplify/auth/enable-oauth-listener'
import { amplifyConfig } from '@/lib/amplify/config'

// ssr: true でトークンを Cookie に保存し、middleware / Server Component から読めるようにする
Amplify.configure(amplifyConfig, { ssr: true })

/** ブラウザ側で Amplify を初期化するためだけのコンポーネント（何も描画しない） */
export function ConfigureAmplify() {
  return null
}
