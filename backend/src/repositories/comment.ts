import type { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'

export const authorInclude = {
  user: { select: { id: true, displayName: true, avatarUrl: true } },
} as const satisfies Prisma.CommentInclude

export type CommentWithAuthor = Prisma.CommentGetPayload<{ include: typeof authorInclude }>
export type TimestampCommentWithAuthor = Prisma.TimestampCommentGetPayload<{
  include: typeof authorInclude
}>

/* ------------------------------ Comments ------------------------------ */

export async function listByVideo(videoId: string): Promise<CommentWithAuthor[]> {
  return prisma.comment.findMany({
    where: { videoId },
    include: authorInclude,
    orderBy: { createdAt: 'asc' },
  })
}

export async function findById(id: string): Promise<CommentWithAuthor | null> {
  return prisma.comment.findUnique({ where: { id }, include: authorInclude })
}

export async function create(data: Prisma.CommentUncheckedCreateInput): Promise<CommentWithAuthor> {
  return prisma.comment.create({ data, include: authorInclude })
}

export async function update(id: string, body: string): Promise<CommentWithAuthor> {
  return prisma.comment.update({ where: { id }, data: { body }, include: authorInclude })
}

export async function remove(id: string): Promise<void> {
  await prisma.comment.delete({ where: { id } })
}

/* ------------------------- Timestamp comments ------------------------- */

export async function listTimestampsByVideo(
  videoId: string,
): Promise<TimestampCommentWithAuthor[]> {
  return prisma.timestampComment.findMany({
    where: { videoId },
    include: authorInclude,
    orderBy: [{ atSec: 'asc' }, { createdAt: 'asc' }],
  })
}

export async function findTimestampById(id: string): Promise<TimestampCommentWithAuthor | null> {
  return prisma.timestampComment.findUnique({ where: { id }, include: authorInclude })
}

export async function createTimestamp(
  data: Prisma.TimestampCommentUncheckedCreateInput,
): Promise<TimestampCommentWithAuthor> {
  return prisma.timestampComment.create({ data, include: authorInclude })
}

export async function updateTimestamp(
  id: string,
  data: Prisma.TimestampCommentUncheckedUpdateInput,
): Promise<TimestampCommentWithAuthor> {
  return prisma.timestampComment.update({ where: { id }, data, include: authorInclude })
}

export async function removeTimestamp(id: string): Promise<void> {
  await prisma.timestampComment.delete({ where: { id } })
}
