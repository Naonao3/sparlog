import { zValidator } from '@hono/zod-validator'
import type { ValidationTargets } from 'hono'
import type { ZodSchema } from 'zod'
import { AppError } from '../lib/errors.js'

/**
 * zValidator の薄いラッパー。
 * 検証エラーを AppError に変換し、エラー整形を app.onError に一本化する。
 */
export function validate<T extends ZodSchema, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) {
  return zValidator(target, schema, (result) => {
    if (!result.success) {
      throw new AppError(
        'VALIDATION_ERROR',
        'リクエストの内容が正しくありません',
        400,
        result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      )
    }
  })
}
