import type { ContentfulStatusCode } from 'hono/utils/http-status'

export const ERROR_CODES = [
  'BAD_REQUEST',
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'PAYLOAD_TOO_LARGE',
  'UNPROCESSABLE_ENTITY',
  'INTERNAL_SERVER_ERROR',
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

export interface ErrorBody {
  error: {
    code: ErrorCode
    message: string
    details?: unknown
  }
}

/**
 * アプリケーション内で意図的に投げる例外。
 * ルート・サービス・リポジトリのどこから投げても app.onError が拾って整形する。
 */
export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: ContentfulStatusCode
  readonly details?: unknown

  constructor(
    code: ErrorCode,
    message: string,
    status: ContentfulStatusCode,
    details?: unknown,
  ) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.status = status
    this.details = details
  }

  toBody(): ErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details === undefined ? {} : { details: this.details }),
      },
    }
  }
}

export const badRequest = (message = 'Bad request', details?: unknown): AppError =>
  new AppError('BAD_REQUEST', message, 400, details)

export const unauthorized = (message = 'Authentication required'): AppError =>
  new AppError('UNAUTHORIZED', message, 401)

export const forbidden = (message = 'You do not have access to this resource'): AppError =>
  new AppError('FORBIDDEN', message, 403)

export const notFound = (message = 'Resource not found'): AppError =>
  new AppError('NOT_FOUND', message, 404)

export const conflict = (message = 'Resource already exists'): AppError =>
  new AppError('CONFLICT', message, 409)

export const payloadTooLarge = (message = 'Payload too large'): AppError =>
  new AppError('PAYLOAD_TOO_LARGE', message, 413)

export const unprocessable = (message = 'Unprocessable entity', details?: unknown): AppError =>
  new AppError('UNPROCESSABLE_ENTITY', message, 422, details)

export const internalError = (message = 'Internal server error'): AppError =>
  new AppError('INTERNAL_SERVER_ERROR', message, 500)
