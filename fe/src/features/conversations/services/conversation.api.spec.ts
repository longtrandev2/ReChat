import { describe, it, expect, vi, beforeEach } from 'vitest'
import { conversationApi } from './conversation.api'
import { apiClient } from '@/services/api.client'
import type { Conversation } from '../types/conversation.types'

vi.mock('@/services/api.client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
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
})
