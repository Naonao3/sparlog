import { z } from 'zod'

/* ------------------------------------------------------------------ */
/* 共通                                                                */
/* ------------------------------------------------------------------ */

/** Hono の Context に載せる値。authMiddleware 通過後は userId が必ず入る。 */
export type AppEnv = {
  Variables: {
    userId: string
    userEmail: string | null
  }
}

export const uuidSchema = z.string().uuid()

export const idParamSchema = z.object({ id: uuidSchema })
export const videoCommentParamSchema = z.object({ id: uuidSchema, cid: uuidSchema })
export const videoTimestampParamSchema = z.object({ id: uuidSchema, tid: uuidSchema })

export const VIDEO_STATUSES = ['UPLOADING', 'PROCESSING', 'READY', 'ERROR'] as const
export const VISIBILITIES = ['PRIVATE', 'PUBLIC'] as const

export const videoStatusSchema = z.enum(VIDEO_STATUSES)
export const visibilitySchema = z.enum(VISIBILITIES)

/** アップロードを許可する MIME タイプ */
export const ALLOWED_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-matroska',
  'video/x-msvideo',
  'video/mpeg',
] as const

export const videoMimeTypeSchema = z.enum(ALLOWED_VIDEO_MIME_TYPES)

/** カンマ区切りのクエリ文字列を UUID 配列に変換する */
const commaSeparatedUuids = z
  .string()
  .optional()
  .transform((value) =>
    value === undefined
      ? undefined
      : value
          .split(',')
          .map((part) => part.trim())
          .filter((part) => part.length > 0),
  )
  .refine(
    (values) => values === undefined || values.every((value) => uuidSchema.safeParse(value).success),
    { message: 'tag_ids には UUID をカンマ区切りで指定してください' },
  )

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

export const updateUserSchema = z
  .object({
    displayName: z.string().trim().min(1).max(50).nullable().optional(),
    avatarUrl: z.string().url().max(2048).nullable().optional(),
    bio: z.string().trim().max(500).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: '更新するフィールドを1つ以上指定してください',
  })

export type UpdateUserInput = z.infer<typeof updateUserSchema>

/* ------------------------------------------------------------------ */
/* Videos                                                              */
/* ------------------------------------------------------------------ */

export const listVideosQuerySchema = z.object({
  tag_ids: commaSeparatedUuids,
  visibility: visibilitySchema.optional(),
  status: videoStatusSchema.optional(),
  q: z.string().trim().min(1).max(200).optional(),
  sort: z.enum(['recorded_at', 'created_at']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).optional(),
})

export type ListVideosQuery = z.infer<typeof listVideosQuerySchema>

export const createVideoSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  fileName: z.string().trim().min(1).max(255),
  mimeType: videoMimeTypeSchema,
  fileSize: z.number().int().positive(),
  recordedAt: z.string().datetime({ offset: true }).optional(),
  visibility: visibilitySchema.optional(),
  tagIds: z.array(uuidSchema).max(30).optional(),
})

export type CreateVideoInput = z.infer<typeof createVideoSchema>

export const updateVideoSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    visibility: visibilitySchema.optional(),
    recordedAt: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: '更新するフィールドを1つ以上指定してください',
  })

export type UpdateVideoInput = z.infer<typeof updateVideoSchema>

export const updateVideoTagsSchema = z.object({
  tagIds: z.array(uuidSchema).max(30),
})

export type UpdateVideoTagsInput = z.infer<typeof updateVideoTagsSchema>

/* ------------------------------------------------------------------ */
/* Comments                                                            */
/* ------------------------------------------------------------------ */

export const createCommentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
})

export const updateCommentSchema = createCommentSchema

export type CreateCommentInput = z.infer<typeof createCommentSchema>
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>

export const createTimestampCommentSchema = z.object({
  atSec: z.number().int().min(0).max(60 * 60 * 24),
  body: z.string().trim().min(1).max(2000),
})

export const updateTimestampCommentSchema = z
  .object({
    atSec: z.number().int().min(0).max(60 * 60 * 24).optional(),
    body: z.string().trim().min(1).max(2000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: '更新するフィールドを1つ以上指定してください',
  })

export type CreateTimestampCommentInput = z.infer<typeof createTimestampCommentSchema>
export type UpdateTimestampCommentInput = z.infer<typeof updateTimestampCommentSchema>

/* ------------------------------------------------------------------ */
/* Tags                                                                */
/* ------------------------------------------------------------------ */

const hexColorSchema = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'カラーコードは #RGB または #RRGGBB 形式で指定してください')

export const createTagSchema = z.object({
  name: z.string().trim().min(1).max(30),
  color: hexColorSchema.optional(),
  categoryId: uuidSchema.optional(),
})

export const updateTagSchema = z
  .object({
    name: z.string().trim().min(1).max(30).optional(),
    color: hexColorSchema.nullable().optional(),
    categoryId: uuidSchema.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: '更新するフィールドを1つ以上指定してください',
  })

export type CreateTagInput = z.infer<typeof createTagSchema>
export type UpdateTagInput = z.infer<typeof updateTagSchema>

/* ------------------------------------------------------------------ */
/* レスポンス DTO（フロントエンドの types/ と一致させること）           */
/* ------------------------------------------------------------------ */

export interface UserResponse {
  id: string
  email: string
  displayName: string | null
  avatarUrl: string | null
  bio: string | null
  authProvider: string
  createdAt: string
  updatedAt: string
}

export interface CategoryResponse {
  id: string
  slug: string
  name: string
  isSystem: boolean
  sortOrder: number
}

export interface TagResponse {
  id: string
  name: string
  color: string | null
  isSystem: boolean
  categoryId: string | null
  category: CategoryResponse | null
  createdAt: string
  updatedAt: string
}

export interface VideoResponse {
  id: string
  userId: string
  title: string
  description: string | null
  status: (typeof VIDEO_STATUSES)[number]
  visibility: (typeof VISIBILITIES)[number]
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
  tags: TagResponse[]
  commentCount?: number
  timestampCommentCount?: number
}

export interface CreateVideoResponse {
  video: VideoResponse
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
  /** 再生するファイルの MIME タイプ（再生用に変換済みなら video/mp4） */
  mimeType: string | null
}

export interface CommentAuthor {
  id: string
  displayName: string | null
  avatarUrl: string | null
}

export interface CommentResponse {
  id: string
  videoId: string
  body: string
  author: CommentAuthor
  createdAt: string
  updatedAt: string
}

export interface TimestampCommentResponse extends CommentResponse {
  atSec: number
}

export interface Paginated<T> {
  items: T[]
  nextCursor: string | null
}
