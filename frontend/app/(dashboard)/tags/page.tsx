import type { Metadata } from 'next'
import { TagManager } from '@/components/tag/TagManager'

export const metadata: Metadata = { title: 'タグ管理' }

export default function TagsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">タグ管理</h1>
        <p className="text-sm text-muted-foreground">
          動画の絞り込みに使うタグを管理します。
        </p>
      </div>
      <TagManager />
    </div>
  )
}
