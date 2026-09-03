'use client'

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import { queryKeys } from '@/lib/api/queryKeys'
import * as tagsApi from '@/lib/api/tags'
import type { Category, CreateTagInput, Tag, UpdateTagInput } from '@/types'

export function useTags(): UseQueryResult<Tag[], Error> {
  return useQuery({
    queryKey: queryKeys.tags,
    queryFn: tagsApi.listTags,
    staleTime: 1000 * 60 * 5,
  })
}

export function useCategories(): UseQueryResult<Category[], Error> {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: tagsApi.listCategories,
    staleTime: 1000 * 60 * 60,
  })
}

export function useCreateTag(): UseMutationResult<Tag, Error, CreateTagInput> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: tagsApi.createTag,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tags })
    },
  })
}

export function useUpdateTag(): UseMutationResult<
  Tag,
  Error,
  { id: string; input: UpdateTagInput }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTagInput }) =>
      tagsApi.updateTag(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tags })
      void queryClient.invalidateQueries({ queryKey: queryKeys.videos.all })
    },
  })
}

export function useDeleteTag(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: tagsApi.deleteTag,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tags })
      void queryClient.invalidateQueries({ queryKey: queryKeys.videos.all })
    },
  })
}
