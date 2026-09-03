import type { ListVideosParams } from '@/types'

/** TanStack Query のキーを一元管理する */
export const queryKeys = {
  profile: ['profile'] as const,
  videos: {
    all: ['videos'] as const,
    list: (params: ListVideosParams) => ['videos', 'list', params] as const,
    detail: (id: string) => ['videos', 'detail', id] as const,
    stream: (id: string) => ['videos', 'stream', id] as const,
  },
  comments: (videoId: string) => ['comments', videoId] as const,
  timestampComments: (videoId: string) => ['timestamp-comments', videoId] as const,
  tags: ['tags'] as const,
  categories: ['categories'] as const,
} as const
