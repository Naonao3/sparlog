import { z } from 'zod'

export const environmentNames = ['dev', 'prod'] as const
export type EnvironmentName = (typeof environmentNames)[number]

/**
 * cdk.json の context.sparlog.<env> に置く環境ごとの設定。
 * secret（Google のクライアントシークレット等）はここに書かず Secrets Manager で管理する。
 */
const environmentConfigSchema = z.object({
  /** デプロイ先のアカウント。未指定なら CLI のプロファイルのアカウントを使う */
  account: z
    .string()
    .regex(/^\d{12}$/)
    .optional(),
  region: z.string().min(1),
  /**
   * フロントエンドのオリジン（末尾スラッシュなし）。
   * S3 の CORS と、Cognito のコールバック / ログアウト URL の生成に使う。
   */
  frontendOrigins: z
    .array(
      z
        .string()
        .url()
        .refine((value) => !value.endsWith('/'), '末尾のスラッシュは付けないでください'),
    )
    .min(1, 'frontendOrigins を1つ以上設定してください'),
  /** Cognito ドメインのプレフィックス（リージョン内で一意である必要がある） */
  cognitoDomainPrefix: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/),
  /**
   * Google OAuth のクライアントID。設定した場合のみ Google ログインを有効にする。
   * クライアントシークレットは Secrets Manager の `sparlog/<env>/google-oauth-client-secret` に置く。
   */
  googleClientId: z.string().min(1).optional(),
  database: z.object({
    instanceType: z.string().min(1),
    allocatedStorageGiB: z.number().int().min(20),
    backupRetentionDays: z.number().int().min(1).max(35),
  }),
})

export type EnvironmentConfig = z.infer<typeof environmentConfigSchema> & {
  envName: EnvironmentName
  isProduction: boolean
}

export function parseEnvironmentName(value: unknown): EnvironmentName {
  const parsed = z.enum(environmentNames).safeParse(value ?? 'dev')
  if (!parsed.success) {
    throw new Error(`-c env=<${environmentNames.join('|')}> を指定してください（受け取った値: ${String(value)}）`)
  }
  return parsed.data
}

/** cdk.json の context をバリデーションし、不正な場合は synth の時点で失敗させる */
export function loadEnvironmentConfig(envName: EnvironmentName, context: unknown): EnvironmentConfig {
  const contextSchema = z.object({ [envName]: environmentConfigSchema })
  const parsed = contextSchema.safeParse(context)

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - sparlog.${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    throw new Error(`[config] cdk.json の設定が不正です:\n${details}`)
  }

  const config = parsed.data[envName]
  if (config === undefined) {
    throw new Error(`[config] cdk.json に sparlog.${envName} がありません`)
  }

  return { ...config, envName, isProduction: envName === 'prod' }
}
