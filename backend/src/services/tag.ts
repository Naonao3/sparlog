import type { Category } from '@prisma/client'
import { conflict, forbidden, notFound } from '../lib/errors.js'
import * as tagRepository from '../repositories/tag.js'
import type { TagWithCategory } from '../repositories/tag.js'
import type {
  CategoryResponse,
  CreateTagInput,
  TagResponse,
  UpdateTagInput,
} from '../types/index.js'

export function toCategoryResponse(category: Category): CategoryResponse {
  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    isSystem: category.isSystem,
    sortOrder: category.sortOrder,
  }
}

export function toTagResponse(tag: TagWithCategory): TagResponse {
  return {
    id: tag.id,
    name: tag.name,
    color: tag.color,
    isSystem: tag.isSystem,
    categoryId: tag.categoryId,
    category: tag.category ? toCategoryResponse(tag.category) : null,
    createdAt: tag.createdAt.toISOString(),
    updatedAt: tag.updatedAt.toISOString(),
  }
}

export async function listCategories(): Promise<CategoryResponse[]> {
  const categories = await tagRepository.listCategories()
  return categories.map(toCategoryResponse)
}

export async function listTags(userId: string): Promise<TagResponse[]> {
  const tags = await tagRepository.listForUser(userId)
  return tags.map(toTagResponse)
}

async function assertCategoryExists(categoryId: string): Promise<void> {
  const category = await tagRepository.findCategoryById(categoryId)
  if (!category) throw notFound('指定されたカテゴリが見つかりません')
}

/** 自分のタグであることを保証する（システムタグは編集・削除不可） */
async function findOwnTagOrThrow(userId: string, tagId: string): Promise<TagWithCategory> {
  const tag = await tagRepository.findById(tagId)
  if (!tag) throw notFound('タグが見つかりません')
  if (tag.isSystem) throw forbidden('システム共通タグは変更できません')
  if (tag.userId !== userId) throw forbidden('このタグを操作する権限がありません')
  return tag
}

export async function createTag(userId: string, input: CreateTagInput): Promise<TagResponse> {
  if (input.categoryId) await assertCategoryExists(input.categoryId)

  const duplicated = await tagRepository.findByNameForUser(userId, input.name)
  if (duplicated) throw conflict('同じ名前のタグがすでに存在します')

  const tag = await tagRepository.create({
    name: input.name,
    color: input.color ?? null,
    categoryId: input.categoryId ?? null,
    userId,
    isSystem: false,
  })

  return toTagResponse(tag)
}

export async function updateTag(
  userId: string,
  tagId: string,
  input: UpdateTagInput,
): Promise<TagResponse> {
  await findOwnTagOrThrow(userId, tagId)

  if (input.categoryId) await assertCategoryExists(input.categoryId)

  if (input.name !== undefined) {
    const duplicated = await tagRepository.findByNameForUser(userId, input.name)
    if (duplicated && duplicated.id !== tagId) {
      throw conflict('同じ名前のタグがすでに存在します')
    }
  }

  const tag = await tagRepository.update(tagId, {
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.color === undefined ? {} : { color: input.color }),
    ...(input.categoryId === undefined ? {} : { categoryId: input.categoryId }),
  })

  return toTagResponse(tag)
}

export async function deleteTag(userId: string, tagId: string): Promise<void> {
  await findOwnTagOrThrow(userId, tagId)
  await tagRepository.remove(tagId)
}

/** 動画に付与しようとしているタグがすべて利用可能か検証し、正規化した id 配列を返す */
export async function assertUsableTagIds(userId: string, tagIds: string[]): Promise<string[]> {
  const unique = [...new Set(tagIds)]
  if (unique.length === 0) return []

  const usable = await tagRepository.findUsableByIds(userId, unique)
  if (usable.length !== unique.length) {
    throw notFound('利用できないタグIDが含まれています')
  }
  return unique
}
