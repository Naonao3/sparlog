import { Globe, Lock, MessageSquare, Timer } from 'lucide-react'
import Link from 'next/link'
import { TagBadge } from '@/components/video/TagBadge'
import { VideoStatusBadge } from '@/components/video/VideoStatusBadge'
import { formatDate, formatTimestamp } from '@/lib/utils/format'
import type { Video } from '@/types'

export function VideoCard({ video }: { video: Video }) {
  const commentTotal = (video.commentCount ?? 0) + (video.timestampCommentCount ?? 0)

  return (
    <Link
      href={`/videos/${video.id}`}
      className="group flex flex-col overflow-hidden rounded-lg border bg-card transition-colors hover:border-primary/50"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        {video.thumbnailUrl ? (
          // 署名付き URL は都度変わるため next/image の最適化は行わない
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.thumbnailUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            サムネイルなし
          </div>
        )}

        {video.durationSec !== null && (
          <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
            {formatTimestamp(video.durationSec)}
          </span>
        )}

        {video.status !== 'READY' && (
          <div className="absolute left-2 top-2">
            <VideoStatusBadge status={video.status} />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 font-medium leading-snug">{video.title}</h3>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{formatDate(video.recordedAt ?? video.createdAt)}</span>
          <span className="flex items-center gap-1">
            {video.visibility === 'PUBLIC' ? (
              <>
                <Globe className="h-3 w-3" />
                公開
              </>
            ) : (
              <>
                <Lock className="h-3 w-3" />
                非公開
              </>
            )}
          </span>
          {commentTotal > 0 && (
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {commentTotal}
            </span>
          )}
          {(video.timestampCommentCount ?? 0) > 0 && (
            <span className="flex items-center gap-1">
              <Timer className="h-3 w-3" />
              {video.timestampCommentCount}
            </span>
          )}
        </div>

        {video.tags.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1 pt-1">
            {video.tags.slice(0, 4).map((tag) => (
              <TagBadge key={tag.id} tag={tag} />
            ))}
            {video.tags.length > 4 && (
              <span className="text-xs text-muted-foreground">＋{video.tags.length - 4}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}
