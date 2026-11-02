import { describe, it, expect, vi, beforeEach } from 'vitest'
import { conversationApi } from './conversation.api'
import { apiClient } from '@/services/api.client'
import type { Conversation } from '../types/conversation.types'

vi.mock('@/services/api.client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('conversationApi Unit Tests (AAA Methodology)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockConversation: Conversation = {
    id: 'conv-123',
    type: 'DIRECT',
    name: 'Nguyễn Văn A',
    avatarUrl: 'https://example.com/avatar.png',
    unreadCount: 2,
    lastMessage: {
      id: 'msg-456',
      content: 'Chào bạn nhé!',
      type: 'TEXT',
      createdAt: '2026-10-26T10:00:00.000Z',
      sender: {
        id: 'user-789',
        username: 'nguyenvana',
        displayName: 'Nguyễn Văn A',
        avatarUrl: 'https://example.com/avatar.png',
      },
    },
    lastMessageAt: '2026-10-26T10:00:00.000Z',
    createdAt: '2026-10-20T08:00:00.000Z',
    updatedAt: '2026-10-26T10:00:00.000Z',
  }

  it('getInbox fetches user inbox list via GET /conversations', async () => {
    // Arrange
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [mockConversation] })

    // Act
    const result = await conversationApi.getInbox()

    // Assert
    expect(apiClient.get).toHaveBeenCalledWith('/conversations')
    expect(result).toEqual([mockConversation])
  })

  it('createDirect creates a 1-1 conversation via POST /conversations/direct', async () => {
    // Arrange
    const payload = { targetUserId: 'target-uuid-456' }
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockConversation })

    // Act
    const result = await conversationApi.createDirect(payload)

    // Assert
    expect(apiClient.post).toHaveBeenCalledWith('/conversations/direct', payload)
    expect(result).toEqual(mockConversation)
  })

  it('createGroup creates a group conversation via POST /conversations/group', async () => {
    // Arrange
    const payload = {
      name: 'Team Dev ReChat',
      memberIds: ['user-1', 'user-2'],
    }
    const groupConversation: Conversation = {
      ...mockConversation,
      id: 'group-conv-999',
      type: 'GROUP',
      name: 'Team Dev ReChat',
    }
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: groupConversation })

    // Act
    const result = await conversationApi.createGroup(payload)

    // Assert
    expect(apiClient.post).toHaveBeenCalledWith('/conversations/group', payload)
    expect(result).toEqual(groupConversation)
  })

  it('getConversationById fetches details via GET /conversations/:id', async () => {
    // Arrange
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockConversation })

    // Act
    const result = await conversationApi.getConversationById('conv-123')

    // Assert
    expect(apiClient.get).toHaveBeenCalledWith('/conversations/conv-123')
    expect(result).toEqual(mockConversation)
  })

  it('markAsRead triggers PATCH /conversations/:id/read', async () => {
    // Arrange
    vi.mocked(apiClient.patch).mockResolvedValueOnce({ data: { success: true } })

    // Act
    await conversationApi.markAsRead('conv-123')

    // Assert
    expect(apiClient.patch).toHaveBeenCalledWith('/conversations/conv-123/read')
  })

  it('pinMessage triggers POST /conversations/:id/messages/:messageId/pin', async () => {
    // Arrange
    const mockMessage = { id: 'msg-456', isPinned: true }
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockMessage })

    // Act
    const result = await conversationApi.pinMessage('conv-123', 'msg-456')

    // Assert
    expect(apiClient.post).toHaveBeenCalledWith('/conversations/conv-123/messages/msg-456/pin')
    expect(result).toEqual(mockMessage)
  })

  it('unpinMessage triggers DELETE /conversations/:id/messages/:messageId/pin', async () => {
    // Arrange
    const mockRes = { message: 'Bỏ ghim thành công' }
    vi.mocked(apiClient.delete).mockResolvedValueOnce({ data: mockRes })

    // Act
    const result = await conversationApi.unpinMessage('conv-123', 'msg-456')

    // Assert
    expect(apiClient.delete).toHaveBeenCalledWith('/conversations/conv-123/messages/msg-456/pin')
    expect(result).toEqual(mockRes)
  })

  it('getPinnedMessages triggers GET /conversations/:id/pinned-messages', async () => {
    // Arrange
    const mockList = [{ id: 'msg-p1' }, { id: 'msg-p2' }]
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockList })

    // Act
    const result = await conversationApi.getPinnedMessages('conv-123')

    // Assert
    expect(apiClient.get).toHaveBeenCalledWith('/conversations/conv-123/pinned-messages')
    expect(result).toEqual(mockList)
  })

  it('updateGroup triggers PATCH /conversations/:id with name and avatarUrl', async () => {
    // Arrange
    const payload = { name: 'New Group Name', avatarUrl: 'https://new-avatar.png' }
    const updatedConv = { ...mockConversation, ...payload }
    vi.mocked(apiClient.patch).mockResolvedValueOnce({ data: updatedConv })

    // Act
    const result = await conversationApi.updateGroup('conv-123', payload)

    // Assert
    expect(apiClient.patch).toHaveBeenCalledWith('/conversations/conv-123', payload)
    expect(result).toEqual(updatedConv)
  })

  it('updateQuickEmoji triggers PATCH /conversations/:id/quick-emoji', async () => {
    // Arrange
    vi.mocked(apiClient.patch).mockResolvedValueOnce({ data: { quickEmoji: '🔥' } })

    // Act
    const result = await conversationApi.updateQuickEmoji('conv-123', '🔥')

    // Assert
    expect(apiClient.patch).toHaveBeenCalledWith('/conversations/conv-123/quick-emoji', { emoji: '🔥' })
    expect(result).toEqual({ quickEmoji: '🔥' })
  })

  it('addMembers triggers POST /conversations/:id/members', async () => {
    // Arrange
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { success: true } })

    // Act
    await conversationApi.addMembers('conv-123', ['user-1', 'user-2'])

    // Assert
    expect(apiClient.post).toHaveBeenCalledWith('/conversations/conv-123/members', {
      memberIds: ['user-1', 'user-2'],
    })
  })

  it('kickMember triggers DELETE /conversations/:id/members/:userId', async () => {
    // Arrange
    const mockRes = { message: 'Đã xóa thành viên' }
    vi.mocked(apiClient.delete).mockResolvedValueOnce({ data: mockRes })

    // Act
    const result = await conversationApi.kickMember('conv-123', 'user-bad')

    // Assert
    expect(apiClient.delete).toHaveBeenCalledWith('/conversations/conv-123/members/user-bad')
    expect(result).toEqual(mockRes)
  })

  it('updateMemberRole triggers PATCH /conversations/:id/members/:userId/role', async () => {
    // Arrange
    const mockRes = { message: 'Đã thăng cấp' }
    vi.mocked(apiClient.patch).mockResolvedValueOnce({ data: mockRes })

    // Act
    const result = await conversationApi.updateMemberRole('conv-123', 'user-admin', 'ADMIN')

    // Assert
    expect(apiClient.patch).toHaveBeenCalledWith('/conversations/conv-123/members/user-admin/role', {
      role: 'ADMIN',
    })
    expect(result).toEqual(mockRes)
  })

  it('transferOwner triggers PATCH /conversations/:id/transfer-owner', async () => {
    // Arrange
    const mockRes = { message: 'Chuyển giao thành công' }
    vi.mocked(apiClient.patch).mockResolvedValueOnce({ data: mockRes })

    // Act
    const result = await conversationApi.transferOwner('conv-123', 'user-new-owner')

    // Assert
    expect(apiClient.patch).toHaveBeenCalledWith('/conversations/conv-123/transfer-owner', {
      newOwnerId: 'user-new-owner',
    })
    expect(result).toEqual(mockRes)
  })

  it('leaveGroup triggers DELETE /conversations/:id/leave', async () => {
    // Arrange
    const mockRes = { message: 'Đã rời nhóm' }
    vi.mocked(apiClient.delete).mockResolvedValueOnce({ data: mockRes })

    // Act
    const result = await conversationApi.leaveGroup('conv-123')

    // Assert
    expect(apiClient.delete).toHaveBeenCalledWith('/conversations/conv-123/leave')
    expect(result).toEqual(mockRes)
  })
})
