import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useSharedMedia } from './useSharedMedia'
import { messagesApi } from '../services/messages.api'
import type { Message } from '../types/message.types'

vi.mock('../services/messages.api', () => ({
  messagesApi: {
    getMessages: vi.fn(),
  },
}))

describe('useSharedMedia Hook Tests (ZOMBIES & AAA)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const createMockMessage = (id: string, type: 'IMAGE' | 'FILE', createdAt: string): Message => ({
    id,
    content: `File ${id}`,
    type,
    fileUrl: `https://example.com/${id}.png`,
    fileSize: 1024,
    replyToId: null,
    isRecalled: false,
    createdAt,
    updatedAt: createdAt,
    sender: {
      id: 'user-1',
      username: 'test',
      displayName: 'Test User',
      avatarUrl: null,
    },
  })

  it('Zero: returns empty list when API returns 0 items', async () => {
    vi.mocked(messagesApi.getMessages).mockResolvedValueOnce([])

    const { result } = renderHook(() =>
      useSharedMedia({ conversationId: 'conv-1', type: 'IMAGE', enabled: true })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.items).toEqual([])
    expect(result.current.hasMore).toBe(false)
    expect(messagesApi.getMessages).toHaveBeenCalledWith('conv-1', {
      type: 'IMAGE',
      limit: 30,
    })
  })

  it('One & Many: reverses ASC backend list to newest first and detects hasMore', async () => {
    const oldMsg = createMockMessage('msg-1', 'IMAGE', '2026-10-25T10:00:00Z')
    const newMsg = createMockMessage('msg-2', 'IMAGE', '2026-10-26T10:00:00Z')
    // Backend returns ASC: [oldMsg, newMsg]
    vi.mocked(messagesApi.getMessages).mockResolvedValueOnce([oldMsg, newMsg])

    const { result } = renderHook(() =>
      useSharedMedia({ conversationId: 'conv-1', type: 'IMAGE', enabled: true, limit: 2 })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // Hook displays newest first: [newMsg, oldMsg]
    expect(result.current.items).toEqual([newMsg, oldMsg])
    expect(result.current.hasMore).toBe(true) // length === limit
  })

  it('Boundary: loadMore fetches older batch with before cursor and appends to list', async () => {
    const msg1 = createMockMessage('msg-1', 'IMAGE', '2026-10-25T10:00:00Z')
    const msg2 = createMockMessage('msg-2', 'IMAGE', '2026-10-26T10:00:00Z')
    vi.mocked(messagesApi.getMessages).mockResolvedValueOnce([msg1, msg2])

    const { result } = renderHook(() =>
      useSharedMedia({ conversationId: 'conv-1', type: 'IMAGE', enabled: true, limit: 2 })
    )

    await waitFor(() => {
      expect(result.current.items.length).toBe(2)
    })

    // Older batch
    const msgOlder = createMockMessage('msg-0', 'IMAGE', '2026-10-24T10:00:00Z')
    vi.mocked(messagesApi.getMessages).mockResolvedValueOnce([msgOlder])

    await act(async () => {
      await result.current.loadMore()
    })

    expect(messagesApi.getMessages).toHaveBeenCalledWith('conv-1', {
      type: 'IMAGE',
      limit: 2,
      before: 'msg-1', // oldest id in first batch
    })

    // Final list: [msg2, msg1, msgOlder]
    expect(result.current.items).toEqual([msg2, msg1, msgOlder])
    expect(result.current.hasMore).toBe(false) // length < limit
  })

  it('Interface: prependItem adds new real-time message to top of list', async () => {
    vi.mocked(messagesApi.getMessages).mockResolvedValueOnce([])

    const { result } = renderHook(() =>
      useSharedMedia({ conversationId: 'conv-1', type: 'IMAGE', enabled: true })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const newIncoming = createMockMessage('msg-incoming', 'IMAGE', '2026-10-27T12:00:00Z')

    act(() => {
      result.current.prependItem(newIncoming)
    })

    expect(result.current.items).toEqual([newIncoming])
  })

  it('Interface: removeItem immediately removes recalled message by ID', async () => {
    const msg1 = createMockMessage('msg-1', 'IMAGE', '2026-10-26T10:00:00Z')
    const msg2 = createMockMessage('msg-2', 'IMAGE', '2026-10-26T11:00:00Z')
    vi.mocked(messagesApi.getMessages).mockResolvedValueOnce([msg1, msg2])

    const { result } = renderHook(() =>
      useSharedMedia({ conversationId: 'conv-1', type: 'IMAGE', enabled: true })
    )

    await waitFor(() => {
      expect(result.current.items.length).toBe(2)
    })

    act(() => {
      result.current.removeItem('msg-1')
    })

    expect(result.current.items.map((m) => m.id)).toEqual(['msg-2'])
  })

  it('Error handling: records error message when API rejects', async () => {
    vi.mocked(messagesApi.getMessages).mockRejectedValueOnce(new Error('Network disconnected'))

    const { result } = renderHook(() =>
      useSharedMedia({ conversationId: 'conv-1', type: 'IMAGE', enabled: true })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBe('Network disconnected')
    expect(result.current.items).toEqual([])
  })
})
