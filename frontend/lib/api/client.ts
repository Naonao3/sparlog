import { createClient } from '@/lib/supabase/client'
import type { ApiErrorBody, ApiErrorCode } from '@/types'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080/api/v1'

/** Hono API が返すエラーレスポンスを表す例外 */
export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number
  readonly details: unknown

  constructor(code: ApiErrorCode, message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.details = details
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null) return false
  const error = (value as { error?: unknown }).error
  if (typeof error !== 'object' || error === null) return false
  const { code, message } = error as { code?: unknown; message?: unknown }
  return typeof code === 'string' && typeof message === 'string'
}

async function getAccessToken(): Promise<string | null> {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  searchParams?: URLSearchParams
  signal?: AbortSignal
}

/**
 * Hono API への唯一の入口。
 * コンポーネントからは直接呼ばず、hooks/ のカスタムフック経由で使う。
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = await getAccessToken()
  const query = options.searchParams?.toString()
  const url = `${API_BASE_URL}${path}${query ? `?${query}` : ''}`

  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    ...(options.signal ? { signal: options.signal } : {}),
  })

  if (response.status === 204) {
    return undefined as T
  }

  const text = await response.text()
  let payload: unknown = null
  if (text.length > 0) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = null
    }
  }

  if (!response.ok) {
    if (isApiErrorBody(payload)) {
      throw new ApiError(
        payload.error.code,
        payload.error.message,
        response.status,
        payload.error.details,
      )
    }
    throw new ApiError(
      'INTERNAL_SERVER_ERROR',
      `リクエストに失敗しました (HTTP ${response.status})`,
      response.status,
    )
  }

  return payload as T
}

/**
 * R2 の Presigned URL へ直接 PUT する（Hono サーバーを経由しない）。
 * 進捗を取りたいので fetch ではなく XMLHttpRequest を使う。
 */
export function uploadToPresignedUrl(input: {
  url: string
  file: File
  headers: Record<string, string>
  onProgress?: (percent: number) => void
  signal?: AbortSignal
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', input.url)

    for (const [key, value] of Object.entries(input.headers)) {
      xhr.setRequestHeader(key, value)
    }

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && input.onProgress) {
        input.onProgress(Math.round((event.loaded / event.total) * 100))
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`アップロードに失敗しました (HTTP ${xhr.status})`))
    })

    xhr.addEventListener('error', () => reject(new Error('ネットワークエラーが発生しました')))
    xhr.addEventListener('abort', () => reject(new Error('アップロードを中断しました')))

    input.signal?.addEventListener('abort', () => xhr.abort())

    xhr.send(input.file)
  })
}
