import { apiClient } from '@/services/api.client'
import type {
  Conversation,
  CreateDirectPayload,
  CreateGroupPayload,
} from '../types/conversation.types'

export const conversationApi = {
  /**
   * GET /api/v1/conversations
   * Lấy danh sách Inbox kèm tin nhắn mới nhất và số tin chưa đọc (FR-09, BR-10)
   */
  getInbox: async (): Promise<Conversation[]> => {
    const res = await apiClient.get<Conversation[]>('/conversations')
    return res.data
  },

  /**
   * POST /api/v1/conversations/direct
   * Mở/tạo cuộc trò chuyện 1-1 với bạn bè theo targetUserId (FR-10, BR-05)
   */
  createDirect: async (payload: CreateDirectPayload): Promise<Conversation> => {
    const res = await apiClient.post<Conversation>('/conversations/direct', payload)
    return res.data
  },

  /**
   * POST /api/v1/conversations/group
   * Tạo nhóm chat mới với danh sách thành viên (FR-11, BR-06)
   */
  createGroup: async (payload: CreateGroupPayload): Promise<Conversation> => {
    const res = await apiClient.post<Conversation>('/conversations/group', payload)
    return res.data
  },

  /**
   * GET /api/v1/conversations/:id
   * Lấy thông tin chi tiết một cuộc trò chuyện
   */
  getConversationById: async (id: string): Promise<Conversation> => {
    const res = await apiClient.get<Conversation>(`/conversations/${id}`)
    return res.data
  },

  /**
   * PATCH /api/v1/conversations/:id/read
   * Đánh dấu cuộc trò chuyện đã đọc (reset unreadCount về 0)
   */
  markAsRead: async (id: string): Promise<void> => {
    await apiClient.patch(`/conversations/${id}/read`)
  },
}
