'use client'

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type UseInfiniteQueryResult,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import { queryKeys } from '@/lib/api/queryKeys'
import * as videosApi from '@/lib/api/videos'
import type {
  CreateVideoInput,
  CreateVideoResponse,
  ListVideosParams,
  Paginated,
  StreamResponse,
  UpdateVideoInput,
  Video,
} from '@/types'

/** 動画一覧（カーソルベースの無限スクロール） */
export function useVideos(
  params: ListVideosParams,
): UseInfiniteQueryResult<{ pages: Paginated<Video>[]; pageParams: (string | undefined)[] }, Error> {
  return useInfiniteQuery({
    queryKey: queryKeys.videos.list(params),
    queryFn: ({ pageParam }) =>
      videosApi.listVideos({ ...params, ...(pageParam ? { cursor: pageParam } : {}) }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
}

/**
 * 動画詳細。
 * PROCESSING の間だけ 3 秒ごとにポーリングして READY への遷移を待つ。
 */
export function useVideo(id: string, enabled = true): UseQueryResult<Video, Error> {
  return useQuery({
    queryKey: queryKeys.videos.detail(id),
    queryFn: () => videosApi.getVideo(id),
    enabled: enabled && id.length > 0,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'PROCESSING' || status === 'UPLOADING' ? 3000 : false
    },
  })
}

/** 再生用の署名付き URL。有効期限より短い間隔で自動更新する。 */
export function useVideoStream(id: string, enabled: boolean): UseQueryResult<StreamResponse, Error> {
  return useQuery({
    queryKey: queryKeys.videos.stream(id),
    queryFn: () => videosApi.getVideoStream(id),
    enabled: enabled && id.length > 0,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 30,
    retry: false,
  })
}

export function useCreateVideo(): UseMutationResult<CreateVideoResponse, Error, CreateVideoInput> {
  return useMutation({ mutationFn: videosApi.createVideo })
}

export function useCompleteVideoUpload(): UseMutationResult<Video, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: videosApi.completeVideoUpload,
    onSuccess: (video) => {
      queryClient.setQueryData(queryKeys.videos.detail(video.id), video)
      void queryClient.invalidateQueries({ queryKey: queryKeys.videos.all })
    },
  })
}

export function useUpdateVideo(
  id: string,
): UseMutationResult<Video, Error, UpdateVideoInput> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateVideoInput) => videosApi.updateVideo(id, input),
    onSuccess: (video) => {
      queryClient.setQueryData(queryKeys.videos.detail(id), video)
      void queryClient.invalidateQueries({ queryKey: queryKeys.videos.all })
    },
  })
}

export function useUpdateVideoTags(id: string): UseMutationResult<Video, Error, string[]> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (tagIds: string[]) => videosApi.updateVideoTags(id, tagIds),
    onSuccess: (video) => {
      queryClient.setQueryData(queryKeys.videos.detail(id), video)
      void queryClient.invalidateQueries({ queryKey: queryKeys.videos.all })
    },
  })
}

export function useDeleteVideo(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: videosApi.deleteVideo,
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.videos.detail(id) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.videos.all })
    },
  })
}
