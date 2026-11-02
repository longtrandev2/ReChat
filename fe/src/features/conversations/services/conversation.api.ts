import { apiClient } from '@/services/api.client'
import type { Message } from '@/features/chat/types/message.types'
import type {
  Conversation,
  CreateDirectPayload,
  CreateGroupPayload,
  UpdateGroupPayload,
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

  /**
   * POST /api/v1/conversations/:id/messages/:messageId/pin
   * Ghim tin nhắn trong cuộc trò chuyện (FR-20, BR-18)
   */
  pinMessage: async (conversationId: string, messageId: string): Promise<Message> => {
    const res = await apiClient.post<Message>(`/conversations/${conversationId}/messages/${messageId}/pin`)
    return res.data
  },

  /**
   * DELETE /api/v1/conversations/:id/messages/:messageId/pin
   * Bỏ ghim tin nhắn trong cuộc trò chuyện (FR-20, BR-18)
   */
  unpinMessage: async (conversationId: string, messageId: string): Promise<{ message: string }> => {
    const res = await apiClient.delete<{ message: string }>(`/conversations/${conversationId}/messages/${messageId}/pin`)
    return res.data
  },

  /**
   * GET /api/v1/conversations/:id/pinned-messages
   * Lấy danh sách tin nhắn đang được ghim (FR-20, BR-18)
   */
  getPinnedMessages: async (conversationId: string): Promise<Message[]> => {
    const res = await apiClient.get<Message[]>(`/conversations/${conversationId}/pinned-messages`)
    return res.data
  },

  /**
   * PATCH /api/v1/conversations/:id
   * Cập nhật thông tin nhóm: tên nhóm, avatarUrl (FR-19, BR-17, BR-32)
   */
  updateGroup: async (conversationId: string, payload: UpdateGroupPayload): Promise<Conversation> => {
    const res = await apiClient.patch<Conversation>(`/conversations/${conversationId}`, payload)
    return res.data
  },

  /**
   * PATCH /api/v1/conversations/:id/quick-emoji
   * Tùy chỉnh biểu tượng cảm xúc nhanh mặc định (FR-30, BR-29)
   */
  updateQuickEmoji: async (conversationId: string, emoji: string): Promise<{ quickEmoji: string }> => {
    const res = await apiClient.patch<{ quickEmoji: string }>(`/conversations/${conversationId}/quick-emoji`, { emoji })
    return res.data
  },

  /**
   * POST /api/v1/conversations/:id/members
   * Thêm thành viên mới vào nhóm chat (FR-12)
   */
  addMembers: async (conversationId: string, memberIds: string[]): Promise<void> => {
    await apiClient.post(`/conversations/${conversationId}/members`, { memberIds })
  },

  /**
   * DELETE /api/v1/conversations/:id/members/:userId
   * Xóa thành viên khỏi nhóm chat (Kick) (FR-18, BR-14)
   */
  kickMember: async (conversationId: string, targetUserId: string): Promise<{ message: string }> => {
    const res = await apiClient.delete<{ message: string }>(`/conversations/${conversationId}/members/${targetUserId}`)
    return res.data
  },

  /**
   * PATCH /api/v1/conversations/:id/members/:userId/role
   * Thay đổi vai trò thành viên nhóm (Thăng/Giáng cấp Admin) (FR-18, BR-16)
   */
  updateMemberRole: async (
    conversationId: string,
    targetUserId: string,
    role: 'ADMIN' | 'MEMBER'
  ): Promise<{ message: string }> => {
    const res = await apiClient.patch<{ message: string }>(`/conversations/${conversationId}/members/${targetUserId}/role`, {
      role,
    })
    return res.data
  },

  /**
   * PATCH /api/v1/conversations/:id/transfer-owner
   * Chuyển quyền Trưởng nhóm chat (FR-18, BR-15)
   */
  transferOwner: async (conversationId: string, newOwnerId: string): Promise<{ message: string }> => {
    const res = await apiClient.patch<{ message: string }>(`/conversations/${conversationId}/transfer-owner`, {
      newOwnerId,
    })
    return res.data
  },

  /**
   * DELETE /api/v1/conversations/:id/leave
   * Rời khỏi nhóm chat (FR-12, BR-12)
   */
  leaveGroup: async (conversationId: string): Promise<{ message: string }> => {
    const res = await apiClient.delete<{ message: string }>(`/conversations/${conversationId}/leave`)
    return res.data
  },

  /**
   * GET /api/v1/conversations/:id/messages/search?q={keyword}
   * Tìm kiếm tin nhắn trong cuộc hội thoại theo từ khóa (FR-31, BR-30)
   */
  searchMessages: async (conversationId: string, query: string): Promise<Message[]> => {
    const res = await apiClient.get<Message[]>(`/conversations/${conversationId}/messages/search`, {
      params: { q: query },
    })
    return res.data
  },

  /**
   * PATCH /api/v1/conversations/:id/mute
   * Tắt/bật thông báo cuộc hội thoại (FR-32, BR-31)
   */
  toggleMute: async (conversationId: string, isMuted: boolean): Promise<{ conversationId: string; isMuted: boolean }> => {
    const res = await apiClient.patch<{ conversationId: string; isMuted: boolean }>(`/conversations/${conversationId}/mute`, {
      isMuted,
    })
    return res.data
  },
}
