import type { Prisma, User } from '@prisma/client'
import { prisma } from '../lib/prisma.js'

export async function findById(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } })
}

export async function findByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { email } })
}

/**
 * Cognito のユーザーに対応する users 行を作る。既にあれば何もしない。
 * 初回ログイン直後に複数のリクエストが同時に来ても重複しないよう upsert にする。
 * id は Cognito の sub と一致させる。
 */
export async function createIfAbsent(input: {
  id: string
  email: string
  authProvider: string
  displayName: string | null
  avatarUrl: string | null
}): Promise<User> {
  return prisma.user.upsert({
    where: { id: input.id },
    create: input,
    update: {},
  })
}

export async function update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
  return prisma.user.update({ where: { id }, data })
}

export async function remove(id: string): Promise<void> {
  await prisma.user.delete({ where: { id } })
}
