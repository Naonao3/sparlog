'use client'

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import { queryKeys } from '@/lib/api/queryKeys'
import * as usersApi from '@/lib/api/users'
import type { UpdateUserInput, UserProfile } from '@/types'

export function useProfile(): UseQueryResult<UserProfile, Error> {
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: usersApi.getMyProfile,
    staleTime: 1000 * 60 * 5,
  })
}

export function useUpdateProfile(): UseMutationResult<UserProfile, Error, UpdateUserInput> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: usersApi.updateMyProfile,
    onSuccess: (profile) => {
      queryClient.setQueryData(queryKeys.profile, profile)
    },
  })
}

export function useDeleteAccount(): UseMutationResult<void, Error, void> {
  return useMutation({ mutationFn: usersApi.deleteMyAccount })
}
