import { apiClient } from '@/services/api.client'

export interface FriendUser {
  id: string
  username: string
  displayName: string
  avatarUrl?: string | null
  friendSince?: string
}

export interface FriendsListResponse {
  data: FriendUser[]
  meta?: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
}

export const friendsApi = {
  getFriends: async (params?: {
    page?: number
    limit?: number
    search?: string
  }): Promise<FriendUser[]> => {
    const res = await apiClient.get<FriendsListResponse | FriendUser[]>('/friends', {
      params,
    })
    if (Array.isArray(res.data)) {
      return res.data
    }
    if (res.data && Array.isArray(res.data.data)) {
      return res.data.data
    }
    return []
  },
}
