import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'
import type { Tag } from '@/types'

/** タグの色を背景・文字色に反映する（色未設定なら secondary） */
export function TagBadge({
  tag,
  className,
  onClick,
  selected = false,
}: {
  tag: Tag
  className?: string
  onClick?: () => void
  selected?: boolean
}) {
  const style = tag.color
    ? { backgroundColor: `${tag.color}22`, color: tag.color, borderColor: `${tag.color}55` }
    : undefined

  const content = (
    <Badge
      variant="secondary"
      style={style}
      className={cn(
        'border',
        selected && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
        onClick && 'cursor-pointer transition-opacity hover:opacity-80',
        className,
      )}
    >
      {tag.name}
    </Badge>
  )

  if (!onClick) return content

  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className="rounded-full">
      {content}
    </button>
  )
}
