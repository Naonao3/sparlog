/**
 * API レスポンス型。backend/src/types/index.ts の DTO と一致させること。
 */

export const VIDEO_STATUSES = ['UPLOADING', 'PROCESSING', 'READY', 'ERROR'] as const
export const VISIBILITIES = ['PRIVATE', 'PUBLIC'] as const

export type VideoStatus = (typeof VIDEO_STATUSES)[number]
export type Visibility = (typeof VISIBILITIES)[number]

export interface UserProfile {
  id: string
  email: string
  displayName: string | null
  avatarUrl: string | null
  bio: string | null
  authProvider: string
  createdAt: string
  updatedAt: string
}

export interface Category {
  id: string
  slug: string
  name: string
  isSystem: boolean
  sortOrder: number
}

export interface Tag {
  id: string
  name: string
  color: string | null
  isSystem: boolean
  categoryId: string | null
  category: Category | null
  createdAt: string
  updatedAt: string
}

export interface Video {
  id: string
  userId: string
  title: string
  description: string | null
  status: VideoStatus
  visibility: Visibility
  thumbnailUrl: string | null
  durationSec: number | null
  fileSize: number | null
  mimeType: string | null
  width: number | null
  height: number | null
  errorMessage: string | null
  recordedAt: string | null
  createdAt: string
  updatedAt: string
  tags: Tag[]
  commentCount?: number
  timestampCommentCount?: number
}

export interface CreateVideoResponse {
  video: Video
  upload: {
    url: string
    method: 'PUT'
    headers: Record<string, string>
    expiresIn: number
  }
}

export interface StreamResponse {
  url: string
  expiresIn: number
}

export interface CommentAuthor {
  id: string
  displayName: string | null
  avatarUrl: string | null
}

export interface Comment {
  id: string
  videoId: string
  body: string
  author: CommentAuthor
  createdAt: string
  updatedAt: string
}

export interface TimestampComment extends Comment {
  atSec: number
}

export interface Paginated<T> {
  items: T[]
  nextCursor: string | null
}

export interface ItemsResponse<T> {
  items: T[]
}

/* ------------------------------ リクエスト ------------------------------ */

export interface ListVideosParams {
  tagIds?: string[]
  visibility?: Visibility
  status?: VideoStatus
  q?: string
  sort?: 'recorded_at' | 'created_at'
  order?: 'asc' | 'desc'
  limit?: number
  cursor?: string
}

export interface CreateVideoInput {
  title: string
  description?: string
  fileName: string
  mimeType: string
  fileSize: number
  recordedAt?: string
  visibility?: Visibility
  tagIds?: string[]
}

export interface UpdateVideoInput {
  title?: string
  description?: string | null
  visibility?: Visibility
  recordedAt?: string | null
}

export interface UpdateUserInput {
  displayName?: string | null
  avatarUrl?: string | null
  bio?: string | null
}

export interface CreateTagInput {
  name: string
  color?: string
  categoryId?: string
}

export interface UpdateTagInput {
  name?: string
  color?: string | null
  categoryId?: string | null
}

export interface CreateCommentInput {
  body: string
}

export interface CreateTimestampCommentInput {
  atSec: number
  body: string
}

export interface UpdateTimestampCommentInput {
  atSec?: number
  body?: string
}

/* -------------------------------- エラー -------------------------------- */

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNPROCESSABLE_ENTITY'
  | 'INTERNAL_SERVER_ERROR'

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode
    message: string
    details?: unknown
  }
}
