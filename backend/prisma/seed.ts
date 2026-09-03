import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface SeedCategory {
  slug: string
  name: string
  sortOrder: number
  tags: { name: string; color?: string }[]
}

/** システム共通のカテゴリと共通タグ（全ユーザーが利用できる） */
const SEED_CATEGORIES: SeedCategory[] = [
  {
    slug: 'practice-type',
    name: '練習種別',
    sortOrder: 10,
    tags: [
      { name: 'スパーリング', color: '#ef4444' },
      { name: 'マススパー', color: '#f97316' },
      { name: 'ミット打ち', color: '#f59e0b' },
      { name: 'サンドバッグ', color: '#eab308' },
      { name: 'シャドー', color: '#84cc16' },
      { name: '打ち込み', color: '#22c55e' },
      { name: '乱取り', color: '#10b981' },
    ],
  },
  {
    slug: 'technique',
    name: '技術',
    sortOrder: 20,
    tags: [
      { name: 'パンチ', color: '#3b82f6' },
      { name: 'キック', color: '#6366f1' },
      { name: '膝・肘', color: '#8b5cf6' },
      { name: 'クリンチ', color: '#a855f7' },
      { name: 'テイクダウン', color: '#d946ef' },
      { name: '寝技', color: '#ec4899' },
      { name: 'サブミッション', color: '#f43f5e' },
      { name: 'ディフェンス', color: '#0ea5e9' },
    ],
  },
  {
    slug: 'position',
    name: 'ポジション',
    sortOrder: 30,
    tags: [
      { name: '立ち技', color: '#14b8a6' },
      { name: 'グラウンド', color: '#06b6d4' },
      { name: 'ケージ際', color: '#0891b2' },
    ],
  },
  {
    slug: 'review',
    name: '振り返り',
    sortOrder: 40,
    tags: [
      { name: '良かった点', color: '#22c55e' },
      { name: '課題', color: '#ef4444' },
      { name: '要復習', color: '#f59e0b' },
      { name: '大会・試合', color: '#7c3aed' },
    ],
  },
]

async function main(): Promise<void> {
  for (const category of SEED_CATEGORIES) {
    const saved = await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name, sortOrder: category.sortOrder, isSystem: true },
      create: {
        slug: category.slug,
        name: category.name,
        sortOrder: category.sortOrder,
        isSystem: true,
      },
    })

    for (const tag of category.tags) {
      // システムタグは userId が null のため upsert のユニーク指定が使えない
      const existing = await prisma.tag.findFirst({
        where: { name: tag.name, userId: null, isSystem: true },
      })

      if (existing) {
        await prisma.tag.update({
          where: { id: existing.id },
          data: { categoryId: saved.id, color: tag.color ?? null },
        })
      } else {
        await prisma.tag.create({
          data: {
            name: tag.name,
            color: tag.color ?? null,
            categoryId: saved.id,
            isSystem: true,
            userId: null,
          },
        })
      }
    }
  }

  const categoryCount = await prisma.category.count()
  const tagCount = await prisma.tag.count({ where: { isSystem: true } })
  console.log(`[seed] カテゴリ ${categoryCount} 件 / システムタグ ${tagCount} 件を投入しました`)
}

main()
  .catch((error: unknown) => {
    console.error('[seed] 失敗しました', error)
    process.exitCode = 1
  })
  .finally(() => {
    void prisma.$disconnect()
  })
