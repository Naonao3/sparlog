import { apiFetch } from './client'
import type { UpdateUserInput, UserProfile } from '@/types'

export async function getMyProfile(): Promise<UserProfile> {
  return apiFetch<UserProfile>('/users/me')
}

export async function updateMyProfile(input: UpdateUserInput): Promise<UserProfile> {
  return apiFetch<UserProfile>('/users/me', { method: 'PATCH', body: input })
}

export async function deleteMyAccount(): Promise<void> {
  await apiFetch<void>('/users/me', { method: 'DELETE' })
}
