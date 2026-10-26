import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useMessagesStore } from './messages.store'
import { messagesApi } from '../services/messages.api'
import type { Message } from '../types/message.types'

vi.mock('../services/messages.api', () => ({
  messagesApi: {
    getMessages: vi.fn(),
  },
}))

describe('useMessagesStore Tests (ZOMBIES & AAA Methodology)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useMessagesStore.getState().reset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const mockMsg1: Message = {
    id: 'msg-1',
    content: 'Tin nhắn thứ nhất',
    type: 'TEXT',
    fileUrl: null,
    replyToId: null,
    isRecalled: false,
    createdAt: '2026-10-26T08:00:00.000Z',
    updatedAt: '2026-10-26T08:00:00.000Z',
    sender: {
      id: 'user-1',
      username: 'user1',
      displayName: 'User Một',
      avatarUrl: null,
    },
  }

  const mockMsg2: Message = {
    id: 'msg-2',
    content: 'Tin nhắn thứ hai',
    type: 'TEXT',
    fileUrl: null,
    replyToId: null,
    isRecalled: false,
    createdAt: '2026-10-26T08:05:00.000Z',
    updatedAt: '2026-10-26T08:05:00.000Z',
    sender: {
      id: 'user-2',
      username: 'user2',
      displayName: 'User Hai',
      avatarUrl: null,
    },
  }

  const mockOlderMsg: Message = {
    id: 'msg-0',
    content: 'Tin nhắn rất cũ trước đó',
    type: 'TEXT',
    fileUrl: null,
    replyToId: null,
    isRecalled: false,
    createdAt: '2026-10-26T07:50:00.000Z',
    updatedAt: '2026-10-26T07:50:00.000Z',
    sender: {
      id: 'user-1',
      username: 'user1',
      displayName: 'User Một',
      avatarUrl: null,
    },
  }

  // Z - Zero: Initial state
  it('Z: has clean initial state with empty maps and flags', () => {
    // Arrange & Act
    const state = useMessagesStore.getState()

    // Assert
    expect(state.messagesByConversation).toEqual({})
    expect(state.hasMoreByConversation).toEqual({})
    expect(state.typingUsers).toEqual({})
    expect(state.isLoadingMessages).toBe(false)
    expect(state.error).toBeNull()
  })

  // O - One: Fetching single message and single typing user
  it('O: handles single message fetch and single typing user', async () => {
    // Arrange
    vi.mocked(messagesApi.getMessages).mockResolvedValueOnce([mockMsg1])

    // Act
    await useMessagesStore.getState().fetchMessages('conv-1')

    // Assert
    const state = useMessagesStore.getState()
    expect(state.messagesByConversation['conv-1']).toHaveLength(1)
    expect(state.messagesByConversation['conv-1'][0]).toEqual(mockMsg1)
    expect(state.hasMoreByConversation['conv-1']).toBe(false) // 1 < 30 -> hasMore is false

    // Act typing
    useMessagesStore
      .getState()
      .setTypingStatus('conv-1', 'user-2', 'User Hai', true)

    // Assert typing
    const stateAfterTyping = useMessagesStore.getState()
    expect(stateAfterTyping.typingUsers['conv-1']).toEqual({
      'user-2': 'User Hai',
    })
  })

  // M - Many: Multiple messages and multiple typing users
  it('M: manages multiple messages and multiple typing users in conversation', async () => {
    // Arrange
    vi.mocked(messagesApi.getMessages).mockResolvedValueOnce([mockMsg1, mockMsg2])

    // Act
    await useMessagesStore.getState().fetchMessages('conv-1')
    useMessagesStore
      .getState()
      .setTypingStatus('conv-1', 'user-2', 'User Hai', true)
    useMessagesStore
      .getState()
      .setTypingStatus('conv-1', 'user-3', 'User Ba', true)

    // Assert
    const state = useMessagesStore.getState()
    expect(state.messagesByConversation['conv-1']).toEqual([mockMsg1, mockMsg2])
    expect(state.typingUsers['conv-1']).toEqual({
      'user-2': 'User Hai',
      'user-3': 'User Ba',
    })
  })

  // B - Boundary: Cursor pagination prepends older messages and deduplicates ID
  it('B: prepends older messages on cursor pagination and handles duplicate IDs', async () => {
    // Arrange: initial load of msg1, msg2
    vi.mocked(messagesApi.getMessages).mockResolvedValueOnce([mockMsg1, mockMsg2])
    await useMessagesStore.getState().fetchMessages('conv-1')

    // Act: fetch older messages with before cursor = msg-1
    vi.mocked(messagesApi.getMessages).mockResolvedValueOnce([mockOlderMsg, mockMsg1]) // mockMsg1 is overlapping
    await useMessagesStore.getState().fetchMessages('conv-1', 'msg-1')

    // Assert: mockOlderMsg is prepended, mockMsg1 is deduplicated
    const state = useMessagesStore.getState()
    expect(state.messagesByConversation['conv-1']).toEqual([
      mockOlderMsg,
      mockMsg1,
      mockMsg2,
    ])
  })

  // B - Boundary: hasMore is true when fetched count reaches limit (30)
  it('B: sets hasMoreByConversation to true when fetched count reaches 30 items', async () => {
    // Arrange
    const thirtyMessages: Message[] = Array.from({ length: 30 }, (_, i) => ({
      ...mockMsg1,
      id: `msg-batch-${i}`,
    }))
    vi.mocked(messagesApi.getMessages).mockResolvedValueOnce(thirtyMessages)

    // Act
    await useMessagesStore.getState().fetchMessages('conv-1')

    // Assert
    const state = useMessagesStore.getState()
    expect(state.hasMoreByConversation['conv-1']).toBe(true)
  })

  // I - Interface: appendIncomingMessage updates existing or appends new
  it('I: appends new incoming message or updates existing message in place', () => {
    // Arrange
    useMessagesStore.getState().appendIncomingMessage('conv-1', mockMsg1)
    expect(useMessagesStore.getState().messagesByConversation['conv-1']).toEqual([
      mockMsg1,
    ])

    // Act 1: append distinct message
    useMessagesStore.getState().appendIncomingMessage('conv-1', mockMsg2)
    expect(useMessagesStore.getState().messagesByConversation['conv-1']).toEqual([
      mockMsg1,
      mockMsg2,
    ])

    // Act 2: update existing message (e.g. edited or recalled)
    const updatedMsg2: Message = {
      ...mockMsg2,
      content: 'Nội dung đã chỉnh sửa',
    }
    useMessagesStore.getState().appendIncomingMessage('conv-1', updatedMsg2)

    // Assert
    const messages = useMessagesStore.getState().messagesByConversation['conv-1']
    expect(messages).toHaveLength(2)
    expect(messages[1].content).toBe('Nội dung đã chỉnh sửa')
  })

  // E - Exceptions: API error handling
  it('E: captures API error and sets error state without corrupting message cache', async () => {
    // Arrange
    vi.mocked(messagesApi.getMessages).mockRejectedValueOnce(
      new Error('Mạng bị gián đoạn')
    )

    // Act
    await useMessagesStore.getState().fetchMessages('conv-1')

    // Assert
    const state = useMessagesStore.getState()
    expect(state.isLoadingMessages).toBe(false)
    expect(state.error).toBe('Mạng bị gián đoạn')
    expect(state.messagesByConversation['conv-1']).toBeUndefined()
  })

  // S - State transitions & Simple scenarios: auto-clear typing timer & cleanup
  it('S: auto-clears typing indicator after 3s timeout and supports manual cancellation', () => {
    vi.useFakeTimers()

    // Act 1: start typing
    useMessagesStore
      .getState()
      .setTypingStatus('conv-1', 'user-2', 'User Hai', true)
    expect(useMessagesStore.getState().typingUsers['conv-1']['user-2']).toBe(
      'User Hai'
    )

    // Fast-forward 3000ms
    vi.advanceTimersByTime(3000)

    // Assert: auto-cleared
    expect(
      useMessagesStore.getState().typingUsers['conv-1']?.['user-2']
    ).toBeUndefined()

    // Act 2: manual cancellation before timeout
    useMessagesStore
      .getState()
      .setTypingStatus('conv-1', 'user-3', 'User Ba', true)
    expect(useMessagesStore.getState().typingUsers['conv-1']['user-3']).toBe(
      'User Ba'
    )

    useMessagesStore
      .getState()
      .setTypingStatus('conv-1', 'user-3', 'User Ba', false)
    expect(
      useMessagesStore.getState().typingUsers['conv-1']?.['user-3']
    ).toBeUndefined()
  })

  // S - State transitions: clearConversationMessages removes conversation cache
  it('S: clearConversationMessages removes specific conversation data', async () => {
    // Arrange
    vi.mocked(messagesApi.getMessages).mockResolvedValueOnce([mockMsg1])
    await useMessagesStore.getState().fetchMessages('conv-1')
    useMessagesStore
      .getState()
      .setTypingStatus('conv-1', 'user-1', 'User Một', true)

    // Act
    useMessagesStore.getState().clearConversationMessages('conv-1')

    // Assert
    const state = useMessagesStore.getState()
    expect(state.messagesByConversation['conv-1']).toBeUndefined()
    expect(state.hasMoreByConversation['conv-1']).toBeUndefined()
    expect(state.typingUsers['conv-1']).toBeUndefined()
  })
})
