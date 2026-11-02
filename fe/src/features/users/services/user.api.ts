import { apiClient } from '@/services/api.client'

export interface SearchedUser {
  id: string
  username: string
  displayName: string
  avatarUrl?: string | null
  isOnline?: boolean
  lastSeen?: string | null
}

export const userApi = {
  /**
   * GET /api/v1/users/search?q={keyword}&limit={limit}
   * Tìm kiếm người dùng theo username hoặc displayName (FR-04)
   */
  searchUsers: async (q: string, limit = 20): Promise<SearchedUser[]> => {
    if (!q || !q.trim()) return []
    const res = await apiClient.get<SearchedUser[]>('/users/search', {
      params: { q: q.trim(), limit },
    })
    return res.data || []
  },

  /**
   * GET /api/v1/users/:id
   * Lấy thông tin công khai của người dùng
   */
  getPublicProfile: async (id: string): Promise<SearchedUser> => {
    const res = await apiClient.get<SearchedUser>(`/users/${id}`)
    return res.data
  },
}
