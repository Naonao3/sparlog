'use client'

import { Upload, VideoOff } from 'lucide-react'
import Link from 'next/link'
import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { VideoCard } from '@/components/video/VideoCard'
import { VideoFilters } from '@/components/video/VideoFilters'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useVideos } from '@/hooks/useVideos'
import { useVideoFiltersStore } from '@/stores/videoFilters'
import type { ListVideosParams } from '@/types'

function VideoGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-lg border">
          <Skeleton className="aspect-video w-full rounded-none" />
          <div className="space-y-2 p-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function VideoLibrary() {
  const q = useVideoFiltersStore((state) => state.q)
  const tagIds = useVideoFiltersStore((state) => state.tagIds)
  const visibility = useVideoFiltersStore((state) => state.visibility)
  const status = useVideoFiltersStore((state) => state.status)
  const sort = useVideoFiltersStore((state) => state.sort)
  const order = useVideoFiltersStore((state) => state.order)

  const debouncedQuery = useDebouncedValue(q)

  // ストアの値からクエリパラメータを組み立てる（キーの安定のため useMemo）
  const params = useMemo<ListVideosParams>(
    () => ({
      ...(debouncedQuery.trim().length > 0 ? { q: debouncedQuery.trim() } : {}),
      ...(tagIds.length > 0 ? { tagIds } : {}),
      ...(visibility === 'ALL' ? {} : { visibility }),
      ...(status === 'ALL' ? {} : { status }),
      sort,
      order,
      limit: 24,
    }),
    [debouncedQuery, tagIds, visibility, status, sort, order],
  )

  const { data, isPending, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useVideos(params)

  const videos = data?.pages.flatMap((page) => page.items) ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">動画一覧</h1>
          <p className="text-sm text-muted-foreground">
            スパーリング・練習の記録を検索して振り返る。
          </p>
        </div>
        <Button asChild>
          <Link href="/videos/upload">
            <Upload className="h-4 w-4" />
            アップロード
          </Link>
        </Button>
      </div>

      <VideoFilters />

      {isPending ? (
        <VideoGridSkeleton />
      ) : isError ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
          動画を読み込めませんでした：{error.message}
        </div>
      ) : videos.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <VideoOff className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            条件に一致する動画がありません。
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/videos/upload">最初の動画をアップロード</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {videos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>

          {hasNextPage && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => void fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? '読み込み中…' : 'さらに読み込む'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
