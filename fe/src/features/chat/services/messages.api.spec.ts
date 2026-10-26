import { describe, it, expect, vi, beforeEach } from 'vitest'
import { messagesApi } from './messages.api'
import { apiClient } from '@/services/api.client'
import type { Message } from '../types/message.types'

vi.mock('@/services/api.client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}))

describe('messagesApi Unit Tests (AAA Methodology)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockMessage: Message = {
    id: 'msg-uuid-1',
    content: 'Xin chào, đây là tin nhắn kiểm thử',
    type: 'TEXT',
    fileUrl: null,
    replyToId: null,
    isRecalled: false,
    createdAt: '2026-10-26T10:00:00.000Z',
    updatedAt: '2026-10-26T10:00:00.000Z',
    sender: {
      id: 'user-uuid-1',
      username: 'alex',
      displayName: 'Alex Tran',
      avatarUrl: null,
    },
  }

  it('getMessages fetches messages without query parameters', async () => {
    // Arrange
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [mockMessage] })

    // Act
    const result = await messagesApi.getMessages('conv-123')

    // Assert
    expect(apiClient.get).toHaveBeenCalledWith('/conversations/conv-123/messages', {
      params: undefined,
    })
    expect(result).toEqual([mockMessage])
  })

  it('getMessages passes before cursor and limit pagination query', async () => {
    // Arrange
    const query = { before: 'msg-cursor-999', limit: 20 }
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [mockMessage] })

    // Act
    const result = await messagesApi.getMessages('conv-123', query)

    // Assert
    expect(apiClient.get).toHaveBeenCalledWith('/conversations/conv-123/messages', {
      params: query,
    })
    expect(result).toEqual([mockMessage])
  })
})
