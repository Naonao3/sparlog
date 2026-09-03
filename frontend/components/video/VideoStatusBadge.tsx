import { AlertCircle, CheckCircle2, Loader2, UploadCloud } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'
import type { VideoStatus } from '@/types'

const STATUS_CONFIG: Record<
  VideoStatus,
  { label: string; className: string; icon: typeof CheckCircle2; spin?: boolean }
> = {
  UPLOADING: {
    label: 'アップロード中',
    className: 'bg-sky-500/15 text-sky-400',
    icon: UploadCloud,
  },
  PROCESSING: {
    label: '処理中',
    className: 'bg-amber-500/15 text-amber-400',
    icon: Loader2,
    spin: true,
  },
  READY: {
    label: '再生可能',
    className: 'bg-emerald-500/15 text-emerald-400',
    icon: CheckCircle2,
  },
  ERROR: {
    label: 'エラー',
    className: 'bg-destructive/15 text-destructive',
    icon: AlertCircle,
  },
}

export function VideoStatusBadge({
  status,
  className,
}: {
  status: VideoStatus
  className?: string
}) {
  const config = STATUS_CONFIG[status]
  const Icon = config.icon

  return (
    <Badge variant="secondary" className={cn('gap-1', config.className, className)}>
      <Icon className={cn('h-3 w-3', config.spin && 'animate-spin')} />
      {config.label}
    </Badge>
  )
}
