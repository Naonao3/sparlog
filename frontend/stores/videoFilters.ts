import { create } from 'zustand'
import type { ListVideosParams, VideoStatus, Visibility } from '@/types'

interface VideoFiltersState {
  q: string
  tagIds: string[]
  visibility: Visibility | 'ALL'
  status: VideoStatus | 'ALL'
  sort: 'recorded_at' | 'created_at'
  order: 'asc' | 'desc'
  setQuery: (q: string) => void
  toggleTag: (tagId: string) => void
  setVisibility: (visibility: Visibility | 'ALL') => void
  setStatus: (status: VideoStatus | 'ALL') => void
  setSort: (sort: 'recorded_at' | 'created_at') => void
  setOrder: (order: 'asc' | 'desc') => void
  reset: () => void
  toParams: () => ListVideosParams
}

const initialState = {
  q: '',
  tagIds: [] as string[],
  visibility: 'ALL' as Visibility | 'ALL',
  status: 'ALL' as VideoStatus | 'ALL',
  sort: 'created_at' as const,
  order: 'desc' as const,
}

/** 動画一覧の絞り込み条件。ページ遷移しても保持したいのでストアに置く。 */
export const useVideoFiltersStore = create<VideoFiltersState>((set, get) => ({
  ...initialState,
  setQuery: (q) => set({ q }),
  toggleTag: (tagId) =>
    set((state) => ({
      tagIds: state.tagIds.includes(tagId)
        ? state.tagIds.filter((id) => id !== tagId)
        : [...state.tagIds, tagId],
    })),
  setVisibility: (visibility) => set({ visibility }),
  setStatus: (status) => set({ status }),
  setSort: (sort) => set({ sort }),
  setOrder: (order) => set({ order }),
  reset: () => set(initialState),
  toParams: () => {
    const { q, tagIds, visibility, status, sort, order } = get()
    return {
      ...(q.trim().length > 0 ? { q: q.trim() } : {}),
      ...(tagIds.length > 0 ? { tagIds } : {}),
      ...(visibility === 'ALL' ? {} : { visibility }),
      ...(status === 'ALL' ? {} : { status }),
      sort,
      order,
      limit: 24,
    }
  },
}))
