import { apiClient } from '@/services/api.client'
import type { GetMessagesQuery, Message } from '../types/message.types'

export const messagesApi = {
  /**
   * GET /api/v1/conversations/:id/messages
   * Lấy lịch sử tin nhắn của cuộc hội thoại với phân trang Cursor (FR-13, BR-08)
   * - before: UUID tin nhắn mốc để lấy các tin cũ hơn
   * - limit: số lượng tin nhắn (mặc định 30, tối đa 50)
   */
  getMessages: async (
    conversationId: string,
    query?: GetMessagesQuery
  ): Promise<Message[]> => {
    const res = await apiClient.get<Message[]>(
      `/conversations/${conversationId}/messages`,
      { params: query }
    )
    return res.data
  },
}
