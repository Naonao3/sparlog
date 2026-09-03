import type { Prisma, User } from '@prisma/client'
import { prisma } from '../lib/prisma.js'

export async function findById(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } })
}

export async function findByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { email } })
}

/**
 * Supabase Auth のトリガーで users 行が作られる前にAPIが呼ばれた場合の保険。
 * id は auth.users.id と一致させる。
 */
export async function createFromAuth(input: {
  id: string
  email: string
  authProvider: string
}): Promise<User> {
  return prisma.user.create({
    data: {
      id: input.id,
      email: input.email,
      authProvider: input.authProvider,
    },
  })
}

export async function update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
  return prisma.user.update({ where: { id }, data })
}

export async function remove(id: string): Promise<void> {
  await prisma.user.delete({ where: { id } })
}
