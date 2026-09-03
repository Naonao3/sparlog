import { apiFetch } from './client'
import type {
  CreateVideoInput,
  CreateVideoResponse,
  ListVideosParams,
  Paginated,
  StreamResponse,
  UpdateVideoInput,
  Video,
} from '@/types'

function toSearchParams(params: ListVideosParams): URLSearchParams {
  const search = new URLSearchParams()
  if (params.tagIds && params.tagIds.length > 0) search.set('tag_ids', params.tagIds.join(','))
  if (params.visibility) search.set('visibility', params.visibility)
  if (params.status) search.set('status', params.status)
  if (params.q) search.set('q', params.q)
  if (params.sort) search.set('sort', params.sort)
  if (params.order) search.set('order', params.order)
  if (params.limit) search.set('limit', String(params.limit))
  if (params.cursor) search.set('cursor', params.cursor)
  return search
}

export async function listVideos(params: ListVideosParams): Promise<Paginated<Video>> {
  return apiFetch<Paginated<Video>>('/videos', { searchParams: toSearchParams(params) })
}

export async function getVideo(id: string): Promise<Video> {
  return apiFetch<Video>(`/videos/${id}`)
}

export async function createVideo(input: CreateVideoInput): Promise<CreateVideoResponse> {
  return apiFetch<CreateVideoResponse>('/videos', { method: 'POST', body: input })
}

export async function updateVideo(id: string, input: UpdateVideoInput): Promise<Video> {
  return apiFetch<Video>(`/videos/${id}`, { method: 'PATCH', body: input })
}

export async function deleteVideo(id: string): Promise<void> {
  await apiFetch<void>(`/videos/${id}`, { method: 'DELETE' })
}

export async function completeVideoUpload(id: string): Promise<Video> {
  return apiFetch<Video>(`/videos/${id}/complete`, { method: 'POST' })
}

export async function getVideoStream(id: string): Promise<StreamResponse> {
  return apiFetch<StreamResponse>(`/videos/${id}/stream`)
}

export async function updateVideoTags(id: string, tagIds: string[]): Promise<Video> {
  return apiFetch<Video>(`/videos/${id}/tags`, { method: 'PUT', body: { tagIds } })
}
