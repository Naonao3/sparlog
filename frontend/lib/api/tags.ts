import { apiFetch } from './client'
import type { Category, CreateTagInput, ItemsResponse, Tag, UpdateTagInput } from '@/types'

export async function listTags(): Promise<Tag[]> {
  const result = await apiFetch<ItemsResponse<Tag>>('/tags')
  return result.items
}

export async function createTag(input: CreateTagInput): Promise<Tag> {
  return apiFetch<Tag>('/tags', { method: 'POST', body: input })
}

export async function updateTag(id: string, input: UpdateTagInput): Promise<Tag> {
  return apiFetch<Tag>(`/tags/${id}`, { method: 'PATCH', body: input })
}

export async function deleteTag(id: string): Promise<void> {
  await apiFetch<void>(`/tags/${id}`, { method: 'DELETE' })
}

export async function listCategories(): Promise<Category[]> {
  const result = await apiFetch<ItemsResponse<Category>>('/categories')
  return result.items
}
