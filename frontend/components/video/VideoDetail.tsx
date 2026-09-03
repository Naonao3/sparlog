'use client'

import { AlertCircle, ArrowLeft, Globe, Lock, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { CommentSection } from '@/components/comment/CommentSection'
import { TimestampCommentPanel } from '@/components/comment/TimestampCommentPanel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DeleteVideoButton } from '@/components/video/DeleteVideoButton'
import { TagBadge } from '@/components/video/TagBadge'
import { VideoEditDialog } from '@/components/video/VideoEditDialog'
import { VideoPlayer } from '@/components/video/VideoPlayer'
import { VideoStatusBadge } from '@/components/video/VideoStatusBadge'
import { useCompleteVideoUpload, useVideo, useVideoStream } from '@/hooks/useVideos'
import { formatDateTime, formatFileSize, formatTimestamp } from '@/lib/utils/format'

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="aspect-video w-full rounded-lg" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-24 w-full" />
    </div>
  )
}

export function VideoDetail({ videoId }: { videoId: string }) {
  const { data: video, isPending, isError, error } = useVideo(videoId)
  const isReady = video?.status === 'READY'
  const { data: stream, isError: isStreamError } = useVideoStream(videoId, isReady)
  const retryProcessing = useCompleteVideoUpload()

  if (isPending) return <DetailSkeleton />

  if (isError) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/videos">
            <ArrowLeft className="h-4 w-4" />
            動画一覧へ戻る
          </Link>
        </Button>
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
          動画を読み込めませんでした：{error.message}
        </div>
      </div>
    )
  }

  async function handleRetry(): Promise<void> {
    try {
      await retryProcessing.mutateAsync(videoId)
      toast.success('再処理を開始しました')
    } catch (retryError: unknown) {
      toast.error('再処理を開始できませんでした', {
        description: retryError instanceof Error ? retryError.message : undefined,
      })
    }
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/videos">
          <ArrowLeft className="h-4 w-4" />
          動画一覧へ戻る
        </Link>
      </Button>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          {isReady && stream ? (
            <VideoPlayer src={stream.url} mimeType={video.mimeType} poster={video.thumbnailUrl} />
          ) : (
            <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-lg border bg-muted/30 text-center">
              {video.status === 'ERROR' ? (
                <>
                  <AlertCircle className="h-8 w-8 text-destructive" />
                  <div>
                    <p className="text-sm font-medium">処理に失敗しました</p>
                    {video.errorMessage && (
                      <p className="mt-1 max-w-md px-4 text-xs text-muted-foreground">
                        {video.errorMessage}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleRetry()}
                    disabled={retryProcessing.isPending}
                  >
                    <RefreshCw className="h-4 w-4" />
                    再処理する
                  </Button>
                </>
              ) : isStreamError ? (
                <p className="text-sm text-destructive">再生URLを取得できませんでした。</p>
              ) : (
                <>
                  <VideoStatusBadge status={video.status} />
                  <p className="text-sm text-muted-foreground">
                    サムネイル生成とメタデータ抽出が終わるまでお待ちください。
                  </p>
                </>
              )}
            </div>
          )}

          <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{video.title}</h1>
              <div className="flex gap-2">
                <VideoEditDialog video={video} />
                <DeleteVideoButton videoId={video.id} title={video.title} />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <VideoStatusBadge status={video.status} />
              <Badge variant="secondary" className="gap-1">
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
              </Badge>
              <span>撮影: {formatDateTime(video.recordedAt)}</span>
              <span>登録: {formatDateTime(video.createdAt)}</span>
              {video.durationSec !== null && <span>長さ: {formatTimestamp(video.durationSec)}</span>}
              {video.fileSize !== null && <span>{formatFileSize(video.fileSize)}</span>}
              {video.width !== null && video.height !== null && (
                <span>
                  {video.width}×{video.height}
                </span>
              )}
            </div>

            {video.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {video.tags.map((tag) => (
                  <TagBadge key={tag.id} tag={tag} />
                ))}
              </div>
            )}

            {video.description && (
              <p className="whitespace-pre-wrap rounded-lg border bg-card p-4 text-sm leading-relaxed">
                {video.description}
              </p>
            )}
          </div>
        </div>

        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <Tabs defaultValue="timestamps">
            <TabsList className="w-full">
              <TabsTrigger value="timestamps" className="flex-1">
                シーンコメント
                {(video.timestampCommentCount ?? 0) > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {video.timestampCommentCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="comments" className="flex-1">
                メモ
                {(video.commentCount ?? 0) > 0 && (
                  <span className="text-xs text-muted-foreground">{video.commentCount}</span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="timestamps">
              <TimestampCommentPanel videoId={video.id} />
            </TabsContent>

            <TabsContent value="comments">
              <CommentSection videoId={video.id} />
            </TabsContent>
          </Tabs>
        </aside>
      </div>
    </div>
  )
}
