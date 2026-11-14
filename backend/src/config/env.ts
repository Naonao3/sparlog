import { z } from 'zod'

/**
 * PEM 形式の鍵。.env では改行を書けないことがあるため、`\n` のエスケープも受け付ける。
 * （ECS では Secrets Manager の値が改行込みでそのまま渡る）
 */
const pemSchema = z
  .string()
  .transform((value) => value.replaceAll('\\n', '\n').trim())
  .refine((value) => /^-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(value), {
    message: 'PEM 形式の秘密鍵を指定してください',
  })

/**
 * 環境変数は起動時に必ずここでバリデーションする。
 * 欠落・不正がある場合は即座にプロセスを終了させ、実行時の undefined 参照を防ぐ。
 *
 * AWS の認証情報（アクセスキー）はここでは扱わない。SDK の既定の解決順
 * （ECS ではタスクロール、ローカルでは AWS_PROFILE 等）に任せる。
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),

  DATABASE_URL: z.string().url(),

  AWS_REGION: z.string().min(1).default('ap-northeast-1'),

  /** Cognito ユーザープールID（例: ap-northeast-1_AbCdEfGhI）。JWT の iss と JWKS の取得に使う */
  COGNITO_USER_POOL_ID: z.string().regex(/^[a-z]{2}-[a-z]+-\d_[A-Za-z0-9]+$/, {
    message: 'Cognito のユーザープールID（<region>_<id>）を指定してください',
  }),
  /** Cognito アプリクライアントID。ID トークンの aud と照合する */
  COGNITO_CLIENT_ID: z.string().min(1),

  /** 動画・サムネイルを置く S3 バケット */
  S3_BUCKET_NAME: z.string().min(1),

  /** 再生・サムネイル配信用 CloudFront のドメイン（例: dxxxx.cloudfront.net） */
  CLOUDFRONT_DOMAIN: z
    .string()
    .min(1)
    .transform((value) => value.replace(/^https?:\/\//, '').replace(/\/+$/, '')),
  /** CloudFront に登録した公開鍵のID（CDK の Outputs: CloudFrontKeyPairId） */
  CLOUDFRONT_KEY_PAIR_ID: z.string().min(1),
  /** 署名付きURL用の秘密鍵（Secrets Manager: sparlog/<env>/cloudfront-private-key） */
  CLOUDFRONT_PRIVATE_KEY: pemSchema,

  /** 動画アップロード用 Presigned URL の有効期限（秒） */
  UPLOAD_URL_EXPIRES_IN: z.coerce.number().int().positive().default(60 * 15),
  /** 再生用署名付き URL の有効期限（秒） */
  PLAYBACK_URL_EXPIRES_IN: z.coerce.number().int().positive().default(60 * 60),
  /** 1ファイルあたりの最大アップロードサイズ（バイト） */
  MAX_UPLOAD_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(2 * 1024 * 1024 * 1024),

  /** CORS 許可オリジン（カンマ区切り） */
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    ),
})

export type Env = z.infer<typeof envSchema>

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env)

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    console.error(`[env] 環境変数の検証に失敗しました:\n${details}`)
    process.exit(1)
  }

  return parsed.data
}

export const env = loadEnv()
export const isProduction = env.NODE_ENV === 'production'

/** Cognito が発行する JWT の iss（JWKS もこの配下にある） */
export const cognitoIssuer = `https://cognito-idp.${env.COGNITO_USER_POOL_ID.split('_')[0]}.amazonaws.com/${env.COGNITO_USER_POOL_ID}`
