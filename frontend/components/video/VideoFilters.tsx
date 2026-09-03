'use client'

import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TagSelector } from '@/components/video/TagSelector'
import { useVideoFiltersStore } from '@/stores/videoFilters'
import type { VideoStatus, Visibility } from '@/types'

export function VideoFilters() {
  const [isTagPanelOpen, setIsTagPanelOpen] = useState(false)

  const q = useVideoFiltersStore((state) => state.q)
  const tagIds = useVideoFiltersStore((state) => state.tagIds)
  const visibility = useVideoFiltersStore((state) => state.visibility)
  const status = useVideoFiltersStore((state) => state.status)
  const sort = useVideoFiltersStore((state) => state.sort)
  const order = useVideoFiltersStore((state) => state.order)

  const setQuery = useVideoFiltersStore((state) => state.setQuery)
  const toggleTag = useVideoFiltersStore((state) => state.toggleTag)
  const setVisibility = useVideoFiltersStore((state) => state.setVisibility)
  const setStatus = useVideoFiltersStore((state) => state.setStatus)
  const setSort = useVideoFiltersStore((state) => state.setSort)
  const setOrder = useVideoFiltersStore((state) => state.setOrder)
  const reset = useVideoFiltersStore((state) => state.reset)

  const hasActiveFilters =
    q.length > 0 || tagIds.length > 0 || visibility !== 'ALL' || status !== 'ALL'

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="タイトル・説明から検索"
            className="pl-9"
          />
        </div>

        <Button
          type="button"
          variant={isTagPanelOpen || tagIds.length > 0 ? 'secondary' : 'outline'}
          onClick={() => setIsTagPanelOpen((open) => !open)}
          className="sm:w-auto"
        >
          <SlidersHorizontal className="h-4 w-4" />
          タグ
          {tagIds.length > 0 && (
            <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
              {tagIds.length}
            </span>
          )}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={visibility}
          onValueChange={(value) => setVisibility(value as Visibility | 'ALL')}
        >
          <SelectTrigger className="h-9 w-[130px]">
            <SelectValue placeholder="公開設定" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">すべての公開設定</SelectItem>
            <SelectItem value="PRIVATE">非公開</SelectItem>
            <SelectItem value="PUBLIC">公開</SelectItem>
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={(value) => setStatus(value as VideoStatus | 'ALL')}>
          <SelectTrigger className="h-9 w-[140px]">
            <SelectValue placeholder="ステータス" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">すべてのステータス</SelectItem>
            <SelectItem value="READY">再生可能</SelectItem>
            <SelectItem value="PROCESSING">処理中</SelectItem>
            <SelectItem value="UPLOADING">アップロード中</SelectItem>
            <SelectItem value="ERROR">エラー</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={sort}
          onValueChange={(value) => setSort(value as 'recorded_at' | 'created_at')}
        >
          <SelectTrigger className="h-9 w-[130px]">
            <SelectValue placeholder="並び替え" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at">登録日</SelectItem>
            <SelectItem value="recorded_at">撮影日</SelectItem>
          </SelectContent>
        </Select>

        <Select value={order} onValueChange={(value) => setOrder(value as 'asc' | 'desc')}>
          <SelectTrigger className="h-9 w-[110px]">
            <SelectValue placeholder="順序" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">新しい順</SelectItem>
            <SelectItem value="asc">古い順</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button type="button" variant="ghost" size="sm" onClick={reset}>
            <X className="h-4 w-4" />
            条件をクリア
          </Button>
        )}
      </div>

      {isTagPanelOpen && (
        <div className="rounded-lg border bg-card p-4">
          <TagSelector selectedIds={tagIds} onToggle={toggleTag} />
        </div>
      )}
    </div>
  )
}
