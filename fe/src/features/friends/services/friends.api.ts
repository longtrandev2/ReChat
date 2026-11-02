import { apiClient } from '@/services/api.client'
import type { FriendUser, FriendRequest, FriendsListResponse, BlockedUser } from '../types/friends.types'

export * from '../types/friends.types'

export const friendsApi = {
  /**
   * GET /api/v1/friends
   * Lấy danh sách bạn bè kèm phân trang và tìm kiếm (FR-08)
   */
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

  /**
   * GET /api/v1/friends
   * Lấy danh sách bạn bè kèm phân trang và metadata cho infinite scroll (FR-08)
   */
  getFriendsPaginated: async (params?: {
    page?: number
    limit?: number
    search?: string
  }): Promise<FriendsListResponse> => {
    const res = await apiClient.get<FriendsListResponse | FriendUser[]>('/friends', {
      params,
    })
    if (Array.isArray(res.data)) {
      return {
        data: res.data,
        meta: {
          page: params?.page ?? 1,
          limit: params?.limit ?? res.data.length,
          total: res.data.length,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      }
    }
    return res.data
  },

  /**
   * DELETE /api/v1/friends/:friendId
   * Hủy kết bạn (Unfriend) (FR-08, BR-04)
   */
  unfriend: async (friendId: string): Promise<{ message: string }> => {
    const res = await apiClient.delete<{ message: string }>(`/friends/${friendId}`)
    return res.data
  },

  /**
   * GET /api/v1/friends/requests
   * Lấy danh sách lời mời kết bạn nhận được (FR-07)
   */
  getReceivedRequests: async (): Promise<FriendRequest[]> => {
    const res = await apiClient.get<FriendRequest[]>('/friends/requests')
    return res.data
  },

  /**
   * GET /api/v1/friends/requests/sent
   * Lấy danh sách lời mời kết bạn tôi đã gửi (FR-06)
   */
  getSentRequests: async (): Promise<FriendRequest[]> => {
    const res = await apiClient.get<FriendRequest[]>('/friends/requests/sent')
    return res.data
  },

  /**
   * POST /api/v1/friends/request/:userId
   * Gửi lời mời kết bạn (FR-06, BR-03)
   */
  sendFriendRequest: async (userId: string): Promise<FriendRequest> => {
    const res = await apiClient.post<FriendRequest>(`/friends/request/${userId}`)
    return res.data
  },

  /**
   * PATCH /api/v1/friends/requests/:requestId/accept
   * Chấp nhận lời mời kết bạn (FR-07)
   */
  acceptRequest: async (requestId: string): Promise<FriendRequest> => {
    const res = await apiClient.patch<FriendRequest>(`/friends/requests/${requestId}/accept`)
    return res.data
  },

  /**
   * DELETE /api/v1/friends/requests/:requestId/reject
   * Từ chối lời mời kết bạn (FR-07)
   */
  rejectRequest: async (requestId: string): Promise<{ message: string }> => {
    const res = await apiClient.delete<{ message: string }>(`/friends/requests/${requestId}/reject`)
    return res.data
  },

  /**
   * DELETE /api/v1/friends/requests/:requestId/cancel
   * Hủy/thu hồi lời mời kết bạn đã gửi (FR-06)
   */
  cancelRequest: async (requestId: string): Promise<{ message: string }> => {
    const res = await apiClient.delete<{ message: string }>(`/friends/requests/${requestId}/cancel`)
    return res.data
  },

  /**
   * GET /api/v1/users/search?q={query}&limit={limit}
   * Tìm kiếm người dùng theo username hoặc displayName (FR-05)
   */
  searchUsers: async (q: string, limit = 20): Promise<FriendUser[]> => {
    const res = await apiClient.get<FriendUser[]>('/users/search', {
      params: { q, limit },
    })
    return res.data
  },

  /**
   * GET /api/v1/friends/blocked
   * Lấy danh sách người dùng đã bị chặn (FR-29)
   */
  getBlockedUsers: async (): Promise<BlockedUser[]> => {
    const res = await apiClient.get<BlockedUser[]>('/friends/blocked')
    return res.data
  },

  /**
   * POST /api/v1/friends/:friendId/block
   * Chặn người dùng (FR-29, BR-28)
   */
  blockUser: async (friendId: string): Promise<{ message: string }> => {
    const res = await apiClient.post<{ message: string }>(`/friends/${friendId}/block`)
    return res.data
  },

  /**
   * POST /api/v1/friends/:friendId/unblock
   * Bỏ chặn người dùng (FR-29, BR-28)
   */
  unblockUser: async (friendId: string): Promise<{ message: string }> => {
    const res = await apiClient.post<{ message: string }>(`/friends/${friendId}/unblock`)
    return res.data
  },
}

