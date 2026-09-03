import { apiFetch } from './client'
import type {
  Comment,
  CreateCommentInput,
  CreateTimestampCommentInput,
  ItemsResponse,
  TimestampComment,
  UpdateTimestampCommentInput,
} from '@/types'

/* ------------------------------ Comments ------------------------------ */

export async function listComments(videoId: string): Promise<Comment[]> {
  const result = await apiFetch<ItemsResponse<Comment>>(`/videos/${videoId}/comments`)
  return result.items
}

export async function createComment(
  videoId: string,
  input: CreateCommentInput,
): Promise<Comment> {
  return apiFetch<Comment>(`/videos/${videoId}/comments`, { method: 'POST', body: input })
}

export async function updateComment(
  videoId: string,
  commentId: string,
  input: CreateCommentInput,
): Promise<Comment> {
  return apiFetch<Comment>(`/videos/${videoId}/comments/${commentId}`, {
    method: 'PATCH',
    body: input,
  })
}

export async function deleteComment(videoId: string, commentId: string): Promise<void> {
  await apiFetch<void>(`/videos/${videoId}/comments/${commentId}`, { method: 'DELETE' })
}

/* ------------------------- Timestamp comments ------------------------- */

export async function listTimestampComments(videoId: string): Promise<TimestampComment[]> {
  const result = await apiFetch<ItemsResponse<TimestampComment>>(
    `/videos/${videoId}/timestamp-comments`,
  )
  return result.items
}

export async function createTimestampComment(
  videoId: string,
  input: CreateTimestampCommentInput,
): Promise<TimestampComment> {
  return apiFetch<TimestampComment>(`/videos/${videoId}/timestamp-comments`, {
    method: 'POST',
    body: input,
  })
}

export async function updateTimestampComment(
  videoId: string,
  commentId: string,
  input: UpdateTimestampCommentInput,
): Promise<TimestampComment> {
  return apiFetch<TimestampComment>(`/videos/${videoId}/timestamp-comments/${commentId}`, {
    method: 'PATCH',
    body: input,
  })
}

export async function deleteTimestampComment(
  videoId: string,
  commentId: string,
): Promise<void> {
  await apiFetch<void>(`/videos/${videoId}/timestamp-comments/${commentId}`, { method: 'DELETE' })
}
