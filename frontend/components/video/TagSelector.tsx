'use client'

import { TagBadge } from '@/components/video/TagBadge'
import { Skeleton } from '@/components/ui/skeleton'
import { useTags } from '@/hooks/useTags'
import type { Tag } from '@/types'

interface TagSelectorProps {
  selectedIds: string[]
  onToggle: (tagId: string) => void
  /** 見出しの有無 */
  showGroupLabels?: boolean
}

function groupByCategory(tags: Tag[]): { label: string; tags: Tag[] }[] {
  const groups = new Map<string, { label: string; sortOrder: number; tags: Tag[] }>()

  for (const tag of tags) {
    const key = tag.category?.id ?? 'uncategorized'
    const label = tag.category?.name ?? 'その他'
    const sortOrder = tag.category?.sortOrder ?? 9999
    const group = groups.get(key) ?? { label, sortOrder, tags: [] }
    group.tags.push(tag)
    groups.set(key, group)
  }

  return [...groups.values()].sort((a, b) => a.sortOrder - b.sortOrder)
}

/** タグの複数選択 UI。フィルタ・動画編集の双方で使う。 */
export function TagSelector({ selectedIds, onToggle, showGroupLabels = true }: TagSelectorProps) {
  const { data: tags, isPending, isError } = useTags()

  if (isPending) {
    return (
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-6 w-16 rounded-full" />
        ))}
      </div>
    )
  }

  if (isError || !tags) {
    return <p className="text-sm text-destructive">タグを読み込めませんでした。</p>
  }

  if (tags.length === 0) {
    return <p className="text-sm text-muted-foreground">タグがまだありません。</p>
  }

  const groups = groupByCategory(tags)

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div key={group.label} className="space-y-1.5">
          {showGroupLabels && (
            <p className="text-xs font-medium text-muted-foreground">{group.label}</p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {group.tags.map((tag) => (
              <TagBadge
                key={tag.id}
                tag={tag}
                selected={selectedIds.includes(tag.id)}
                onClick={() => onToggle(tag.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
