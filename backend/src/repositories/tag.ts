import type { Category, Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'

export const tagInclude = { category: true } as const satisfies Prisma.TagInclude

export type TagWithCategory = Prisma.TagGetPayload<{ include: typeof tagInclude }>

/* ----------------------------- Categories ----------------------------- */

export async function listCategories(): Promise<Category[]> {
  return prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] })
}

export async function findCategoryById(id: string): Promise<Category | null> {
  return prisma.category.findUnique({ where: { id } })
}

/* -------------------------------- Tags -------------------------------- */

/** システム共通タグ + 指定ユーザーの独自タグ */
export async function listForUser(userId: string): Promise<TagWithCategory[]> {
  return prisma.tag.findMany({
    where: { OR: [{ isSystem: true }, { userId }] },
    include: tagInclude,
    orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
  })
}

export async function findById(id: string): Promise<TagWithCategory | null> {
  return prisma.tag.findUnique({ where: { id }, include: tagInclude })
}

export async function findByNameForUser(
  userId: string,
  name: string,
): Promise<TagWithCategory | null> {
  return prisma.tag.findFirst({
    where: { name, OR: [{ isSystem: true }, { userId }] },
    include: tagInclude,
  })
}

/** 指定 id 群のうち、そのユーザーが利用できるタグだけを返す */
export async function findUsableByIds(userId: string, ids: string[]): Promise<TagWithCategory[]> {
  if (ids.length === 0) return []
  return prisma.tag.findMany({
    where: { id: { in: ids }, OR: [{ isSystem: true }, { userId }] },
    include: tagInclude,
  })
}

export async function create(data: Prisma.TagUncheckedCreateInput): Promise<TagWithCategory> {
  return prisma.tag.create({ data, include: tagInclude })
}

export async function update(
  id: string,
  data: Prisma.TagUncheckedUpdateInput,
): Promise<TagWithCategory> {
  return prisma.tag.update({ where: { id }, data, include: tagInclude })
}

export async function remove(id: string): Promise<void> {
  await prisma.tag.delete({ where: { id } })
}
