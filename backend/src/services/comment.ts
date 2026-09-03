import { forbidden, notFound } from '../lib/errors.js'
import * as commentRepository from '../repositories/comment.js'
import type {
  CommentWithAuthor,
  TimestampCommentWithAuthor,
} from '../repositories/comment.js'
import { findViewableVideoOrThrow } from './video.js'
import type {
  CommentResponse,
  CreateCommentInput,
  CreateTimestampCommentInput,
  TimestampCommentResponse,
  UpdateCommentInput,
  UpdateTimestampCommentInput,
} from '../types/index.js'

function toCommentResponse(comment: CommentWithAuthor): CommentResponse {
  return {
    id: comment.id,
    videoId: comment.videoId,
    body: comment.body,
    author: {
      id: comment.user.id,
      displayName: comment.user.displayName,
      avatarUrl: comment.user.avatarUrl,
    },
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  }
}

function toTimestampCommentResponse(
  comment: TimestampCommentWithAuthor,
): TimestampCommentResponse {
  return {
    id: comment.id,
    videoId: comment.videoId,
    atSec: comment.atSec,
    body: comment.body,
    author: {
      id: comment.user.id,
      displayName: comment.user.displayName,
      avatarUrl: comment.user.avatarUrl,
    },
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  }
}

/* ------------------------------ Comments ------------------------------ */

export async function listComments(userId: string, videoId: string): Promise<CommentResponse[]> {
  await findViewableVideoOrThrow(userId, videoId)
  const comments = await commentRepository.listByVideo(videoId)
  return comments.map(toCommentResponse)
}

export async function createComment(
  userId: string,
  videoId: string,
  input: CreateCommentInput,
): Promise<CommentResponse> {
  await findViewableVideoOrThrow(userId, videoId)
  const comment = await commentRepository.create({ videoId, userId, body: input.body })
  return toCommentResponse(comment)
}

async function findOwnCommentOrThrow(
  userId: string,
  videoId: string,
  commentId: string,
): Promise<CommentWithAuthor> {
  const comment = await commentRepository.findById(commentId)
  if (!comment || comment.videoId !== videoId) throw notFound('コメントが見つかりません')
  if (comment.userId !== userId) throw forbidden('自分のコメントのみ操作できます')
  return comment
}

export async function updateComment(
  userId: string,
  videoId: string,
  commentId: string,
  input: UpdateCommentInput,
): Promise<CommentResponse> {
  await findOwnCommentOrThrow(userId, videoId, commentId)
  const updated = await commentRepository.update(commentId, input.body)
  return toCommentResponse(updated)
}

export async function deleteComment(
  userId: string,
  videoId: string,
  commentId: string,
): Promise<void> {
  await findOwnCommentOrThrow(userId, videoId, commentId)
  await commentRepository.remove(commentId)
}

/* ------------------------- Timestamp comments ------------------------- */

export async function listTimestampComments(
  userId: string,
  videoId: string,
): Promise<TimestampCommentResponse[]> {
  await findViewableVideoOrThrow(userId, videoId)
  const comments = await commentRepository.listTimestampsByVideo(videoId)
  return comments.map(toTimestampCommentResponse)
}

export async function createTimestampComment(
  userId: string,
  videoId: string,
  input: CreateTimestampCommentInput,
): Promise<TimestampCommentResponse> {
  await findViewableVideoOrThrow(userId, videoId)
  const comment = await commentRepository.createTimestamp({
    videoId,
    userId,
    atSec: input.atSec,
    body: input.body,
  })
  return toTimestampCommentResponse(comment)
}

async function findOwnTimestampCommentOrThrow(
  userId: string,
  videoId: string,
  commentId: string,
): Promise<TimestampCommentWithAuthor> {
  const comment = await commentRepository.findTimestampById(commentId)
  if (!comment || comment.videoId !== videoId) {
    throw notFound('タイムスタンプコメントが見つかりません')
  }
  if (comment.userId !== userId) throw forbidden('自分のコメントのみ操作できます')
  return comment
}

export async function updateTimestampComment(
  userId: string,
  videoId: string,
  commentId: string,
  input: UpdateTimestampCommentInput,
): Promise<TimestampCommentResponse> {
  await findOwnTimestampCommentOrThrow(userId, videoId, commentId)
  const updated = await commentRepository.updateTimestamp(commentId, {
    ...(input.atSec === undefined ? {} : { atSec: input.atSec }),
    ...(input.body === undefined ? {} : { body: input.body }),
  })
  return toTimestampCommentResponse(updated)
}

export async function deleteTimestampComment(
  userId: string,
  videoId: string,
  commentId: string,
): Promise<void> {
  await findOwnTimestampCommentOrThrow(userId, videoId, commentId)
  await commentRepository.removeTimestamp(commentId)
}
