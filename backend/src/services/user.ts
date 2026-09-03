import type { User } from '@prisma/client'
import { env } from '../config/env.js'
import { notFound } from '../lib/errors.js'
import * as userRepository from '../repositories/user.js'
import * as videoRepository from '../repositories/video.js'
import * as storageService from './storage.js'
import type { UpdateUserInput, UserResponse } from '../types/index.js'

export function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    authProvider: user.authProvider,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }
}

/**
 * プロフィール取得。
 * 通常は auth.users のトリガーで行が作られているが、トリガー未適用や
 * 移行直後のケースに備えて JWT の情報から補完的に作成する。
 */
export async function getProfile(userId: string, email: string | null): Promise<UserResponse> {
  const existing = await userRepository.findById(userId)
  if (existing) return toUserResponse(existing)

  if (!email) throw notFound('ユーザーが見つかりません')

  const created = await userRepository.createFromAuth({
    id: userId,
    email,
    authProvider: 'email',
  })
  return toUserResponse(created)
}

export async function updateProfile(
  userId: string,
  input: UpdateUserInput,
): Promise<UserResponse> {
  const existing = await userRepository.findById(userId)
  if (!existing) throw notFound('ユーザーが見つかりません')

  const updated = await userRepository.update(userId, {
    ...(input.displayName === undefined ? {} : { displayName: input.displayName }),
    ...(input.avatarUrl === undefined ? {} : { avatarUrl: input.avatarUrl }),
    ...(input.bio === undefined ? {} : { bio: input.bio }),
  })

  return toUserResponse(updated)
}

/** Supabase Admin API で auth.users を削除する（設定されている場合のみ） */
async function deleteAuthUser(userId: string): Promise<void> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return

  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  })

  if (!response.ok && response.status !== 404) {
    console.error(`[user] auth.users の削除に失敗しました: ${response.status}`)
  }
}

/**
 * アカウント削除。R2 のオブジェクトを消してから DB 行を削除する
 * （動画・コメント・タグは onDelete: Cascade で連鎖削除される）。
 */
export async function deleteAccount(userId: string): Promise<void> {
  const existing = await userRepository.findById(userId)
  if (!existing) throw notFound('ユーザーが見つかりません')

  const videos = await videoRepository.listStorageKeysByUser(userId)
  const keys = videos.flatMap((video) =>
    video.thumbnailKey ? [video.storageKey, video.thumbnailKey] : [video.storageKey],
  )

  await storageService.deleteObjects(keys)
  await userRepository.remove(userId)
  await deleteAuthUser(userId)
}
