import type { User } from '@prisma/client'
import type { AuthIdentity } from '../lib/cognitoClaims.js'
import { conflict, notFound } from '../lib/errors.js'
import * as userRepository from '../repositories/user.js'
import * as videoRepository from '../repositories/video.js'
import * as cognitoService from './cognito.js'
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
 * users 行の存在を確認済みのユーザー（sub → email）。
 * リクエストごとに DB を引かないためのプロセス内キャッシュで、上限を超えたら古いものから捨てる。
 */
const knownUsers = new Map<string, string>()
const KNOWN_USERS_LIMIT = 10_000

function remember(userId: string, email: string): void {
  knownUsers.delete(userId)
  knownUsers.set(userId, email)
  if (knownUsers.size > KNOWN_USERS_LIMIT) {
    const oldest = knownUsers.keys().next()
    if (!oldest.done) knownUsers.delete(oldest.value)
  }
}

/** 別の sub が同じメールアドレスで登録済みなら 409 にする */
async function assertEmailAvailable(userId: string, email: string): Promise<void> {
  const owner = await userRepository.findByEmail(email)
  if (owner && owner.id !== userId) {
    // Cognito ではメール＋パスワードと Google が同じアドレスでも別ユーザーになるため起こりうる
    throw conflict(
      'このメールアドレスは別のログイン方法で登録されています。最初に登録した方法でログインしてください',
    )
  }
}

/**
 * Cognito のユーザーに対応する users 行を用意する（authMiddleware から呼ぶ）。
 * - 初回: 行を作成する（表示名は Google の name、なければメールアドレスの @ より前）
 * - Cognito 側でメールアドレスが変わっていたら追従する
 */
export async function ensureUser(identity: AuthIdentity): Promise<void> {
  if (knownUsers.get(identity.userId) === identity.email) return

  const existing = await userRepository.findById(identity.userId)

  if (!existing) {
    await assertEmailAvailable(identity.userId, identity.email)
    await userRepository.createIfAbsent({
      id: identity.userId,
      email: identity.email,
      authProvider: identity.authProvider,
      displayName: identity.name ?? identity.email.split('@')[0] ?? null,
      avatarUrl: identity.picture,
    })
  } else if (existing.email !== identity.email) {
    await assertEmailAvailable(identity.userId, identity.email)
    await userRepository.update(identity.userId, { email: identity.email })
  }

  remember(identity.userId, identity.email)
}

export async function getProfile(userId: string): Promise<UserResponse> {
  const user = await userRepository.findById(userId)
  if (!user) throw notFound('ユーザーが見つかりません')
  return toUserResponse(user)
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

/**
 * アカウント削除。S3 のオブジェクト → DB 行 → Cognito ユーザーの順に消す
 * （動画・コメント・タグは onDelete: Cascade で連鎖削除される）。
 * Cognito の削除に失敗した場合は 500 になるが、再試行すると authMiddleware が空の users 行を
 * 作り直してから削除し直すので、最終的に全部消える。
 */
export async function deleteAccount(identity: AuthIdentity): Promise<void> {
  const existing = await userRepository.findById(identity.userId)
  if (!existing) throw notFound('ユーザーが見つかりません')

  const videos = await videoRepository.listStorageKeysByUser(identity.userId)
  const keys = videos.flatMap(storageService.collectVideoObjectKeys)

  await storageService.deleteObjects(keys)
  await userRepository.remove(identity.userId)
  knownUsers.delete(identity.userId)
  await cognitoService.deleteUser(identity.username)
}
