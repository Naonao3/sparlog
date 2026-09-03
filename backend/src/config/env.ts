import { z } from 'zod'

/**
 * 環境変数は起動時に必ずここでバリデーションする。
 * 欠落・不正がある場合は即座にプロセスを終了させ、実行時の undefined 参照を防ぐ。
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),

  DATABASE_URL: z.string().url(),
  SUPABASE_JWT_SECRET: z.string().min(1),

  /**
   * アカウント削除時に auth.users も消すために使う（任意）。
   * 未設定の場合はアプリ側のデータのみ削除する。
   */
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z.string().min(1),
  R2_PUBLIC_DOMAIN: z.string().url().optional(),

  /** 動画アップロード用 Presigned URL の有効期限（秒） */
  UPLOAD_URL_EXPIRES_IN: z.coerce.number().int().positive().default(60 * 15),
  /** 再生用 Presigned URL の有効期限（秒） */
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
