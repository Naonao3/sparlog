import type { Prisma, VideoStatus, Visibility } from '@prisma/client'
import { prisma } from '../lib/prisma.js'

export const videoInclude = {
  videoTags: {
    include: { tag: { include: { category: true } } },
    orderBy: { createdAt: 'asc' },
  },
  _count: { select: { comments: true, timestampComments: true } },
} as const satisfies Prisma.VideoInclude

export type VideoWithRelations = Prisma.VideoGetPayload<{ include: typeof videoInclude }>

export interface ListVideosParams {
  userId: string
  tagIds?: string[]
  visibility?: Visibility
  status?: VideoStatus
  q?: string
  sort: 'recorded_at' | 'created_at'
  order: 'asc' | 'desc'
  limit: number
  cursor?: string
}

function buildWhere(params: ListVideosParams): Prisma.VideoWhereInput {
  const and: Prisma.VideoWhereInput[] = [{ userId: params.userId }]

  if (params.visibility) and.push({ visibility: params.visibility })
  if (params.status) and.push({ status: params.status })

  if (params.q) {
    and.push({
      OR: [
        { title: { contains: params.q, mode: 'insensitive' } },
        { description: { contains: params.q, mode: 'insensitive' } },
      ],
    })
  }

  // 指定タグを「すべて」持つ動画に絞り込む
  for (const tagId of params.tagIds ?? []) {
    and.push({ videoTags: { some: { tagId } } })
  }

  return { AND: and }
}

function buildOrderBy(params: ListVideosParams): Prisma.VideoOrderByWithRelationInput[] {
  const direction: Prisma.SortOrder = params.order
  const primary: Prisma.VideoOrderByWithRelationInput =
    params.sort === 'recorded_at'
      ? { recordedAt: { sort: direction, nulls: 'last' } }
      : { createdAt: direction }

  // id を第2キーに入れてカーソルの安定性を担保する
  return [primary, { id: direction }]
}

/**
 * カーソルベースページネーション。
 * limit + 1 件取得し、超過分の有無で nextCursor を決める。
 */
export async function list(
  params: ListVideosParams,
): Promise<{ items: VideoWithRelations[]; nextCursor: string | null }> {
  const rows = await prisma.video.findMany({
    where: buildWhere(params),
    orderBy: buildOrderBy(params),
    include: videoInclude,
    take: params.limit + 1,
    ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
  })

  const hasMore = rows.length > params.limit
  const items = hasMore ? rows.slice(0, params.limit) : rows
  const last = items.at(-1)

  return { items, nextCursor: hasMore && last ? last.id : null }
}

export async function findById(id: string): Promise<VideoWithRelations | null> {
  return prisma.video.findUnique({ where: { id }, include: videoInclude })
}

export async function create(data: Prisma.VideoUncheckedCreateInput): Promise<VideoWithRelations> {
  return prisma.video.create({ data, include: videoInclude })
}

export async function update(
  id: string,
  data: Prisma.VideoUpdateInput,
): Promise<VideoWithRelations> {
  return prisma.video.update({ where: { id }, data, include: videoInclude })
}

export async function remove(id: string): Promise<void> {
  await prisma.video.delete({ where: { id } })
}

/** 動画に紐づくタグを一括で置き換える */
export async function replaceTags(videoId: string, tagIds: string[]): Promise<VideoWithRelations> {
  return prisma.$transaction(async (tx) => {
    await tx.videoTag.deleteMany({ where: { videoId } })
    if (tagIds.length > 0) {
      await tx.videoTag.createMany({
        data: tagIds.map((tagId) => ({ videoId, tagId })),
        skipDuplicates: true,
      })
    }
    return tx.video.findUniqueOrThrow({ where: { id: videoId }, include: videoInclude })
  })
}

/** ユーザーが所有する動画の R2 オブジェクトキーを列挙する（アカウント削除時のR2掃除用） */
export async function listStorageKeysByUser(
  userId: string,
): Promise<{ storageKey: string; playbackKey: string | null; thumbnailKey: string | null }[]> {
  return prisma.video.findMany({
    where: { userId },
    select: { storageKey: true, playbackKey: true, thumbnailKey: true },
  })
}
