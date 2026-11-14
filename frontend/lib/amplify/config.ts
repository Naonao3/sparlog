import type { ResourcesConfig } from 'aws-amplify'
import { z } from 'zod'

/**
 * Cognito の設定。値は infra/ の `cdk deploy` の Outputs から設定する。
 * NEXT_PUBLIC_* はビルド時に埋め込まれるため、process.env.XXX を1つずつ直接参照すること。
 */
const envSchema = z.object({
  userPoolId: z.string().min(1, 'NEXT_PUBLIC_COGNITO_USER_POOL_ID が未設定です'),
  userPoolClientId: z.string().min(1, 'NEXT_PUBLIC_COGNITO_CLIENT_ID が未設定です'),
  /** OAuth（Google ログイン）用ドメイン。https:// の有無どちらでもよい */
  domain: z
    .string()
    .min(1, 'NEXT_PUBLIC_COGNITO_DOMAIN が未設定です')
    .transform((value) => value.replace(/^https?:\/\//, '').replace(/\/+$/, '')),
  /** このフロントエンドのオリジン。Cognito のコールバック / ログアウト URL と一致させる */
  appUrl: z
    .string()
    .url('NEXT_PUBLIC_APP_URL は URL で指定してください')
    .transform((value) => value.replace(/\/+$/, '')),
})

const env = envSchema.parse({
  userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
  userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID,
  domain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN,
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
})

export const amplifyConfig: ResourcesConfig = {
  Auth: {
    Cognito: {
      userPoolId: env.userPoolId,
      userPoolClientId: env.userPoolClientId,
      loginWith: {
        email: true,
        oauth: {
          domain: env.domain,
          scopes: ['openid', 'email', 'profile'],
          redirectSignIn: [`${env.appUrl}/auth/callback`],
          redirectSignOut: [`${env.appUrl}/login`],
          responseType: 'code',
        },
      },
    },
  },
}
