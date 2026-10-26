import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useConversationStore } from './conversation.store'
import { conversationApi } from '../services/conversation.api'
import type { Conversation, LastMessage } from '../types/conversation.types'

vi.mock('../services/conversation.api', () => ({
  conversationApi: {
    getInbox: vi.fn(),
    createDirect: vi.fn(),
    createGroup: vi.fn(),
    getConversationById: vi.fn(),
    markAsRead: vi.fn(),
  },
}))

describe('useConversationStore Tests (ZOMBIES & AAA Methodology)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useConversationStore.getState().reset()
  })

  const mockConv1: Conversation = {
    id: 'conv-1',
    type: 'DIRECT',
    name: 'Nguyễn Văn A',
    avatarUrl: null,
    unreadCount: 1,
    lastMessage: {
      id: 'msg-1',
      content: 'Xin chào bạn',
      type: 'TEXT',
      createdAt: '2026-10-26T08:00:00.000Z',
    },
    lastMessageAt: '2026-10-26T08:00:00.000Z',
    createdAt: '2026-10-20T00:00:00.000Z',
    updatedAt: '2026-10-26T08:00:00.000Z',
  }

  const mockConv2: Conversation = {
    id: 'conv-2',
    type: 'GROUP',
    name: 'Nhóm Lập Trình Frontend',
    avatarUrl: null,
    unreadCount: 0,
    lastMessage: {
      id: 'msg-2',
      content: 'Đã triển khai xong Phase 2',
      type: 'TEXT',
      createdAt: '2026-10-26T09:00:00.000Z',
    },
    lastMessageAt: '2026-10-26T09:00:00.000Z',
    createdAt: '2026-10-21T00:00:00.000Z',
    updatedAt: '2026-10-26T09:00:00.000Z',
  }

  // Z - Zero: Initial state
  it('Z: has clean initial state with empty conversations list', () => {
    const state = useConversationStore.getState()
    expect(state.conversations).toEqual([])
    expect(state.activeConversationId).toBeNull()
    expect(state.searchQuery).toBe('')
    expect(state.filterTab).toBe('all')
    expect(state.isLoading).toBe(false)
    expect(state.error).toBeNull()
  })

  // O - One: Fetching inbox and sorting by recency
  it('O: fetchInbox populates conversations sorted by newest lastMessageAt', async () => {
    // Arrange: conv1 has 08:00, conv2 has 09:00
    vi.mocked(conversationApi.getInbox).mockResolvedValueOnce([mockConv1, mockConv2])

    // Act
    await useConversationStore.getState().fetchInbox()

    // Assert: conv2 (09:00) should appear before conv1 (08:00)
    const state = useConversationStore.getState()
    expect(state.conversations).toHaveLength(2)
    expect(state.conversations[0].id).toBe('conv-2')
    expect(state.conversations[1].id).toBe('conv-1')
    expect(state.isLoading).toBe(false)
  })

  // M - Many: Filtering by tabs and search query
  it('M: filters conversations correctly by tab (unread, group) and search query', () => {
    // Arrange
    useConversationStore.setState({
      conversations: [mockConv1, mockConv2],
    })

    const store = useConversationStore.getState()

    // Filter by 'unread': only conv1 (unreadCount: 1)
    store.setFilterTab('unread')
    let filtered = useConversationStore.getState().getFilteredConversations()
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe('conv-1')

    // Filter by 'group': only conv2 (type: 'GROUP')
    store.setFilterTab('group')
    filtered = useConversationStore.getState().getFilteredConversations()
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe('conv-2')

    // Filter by search query: 'lập trình'
    store.setFilterTab('all')
    store.setSearchQuery('lập trình')
    filtered = useConversationStore.getState().getFilteredConversations()
    expect(filtered).toHaveLength(1)
    expect(filtered[0].name).toBe('Nhóm Lập Trình Frontend')

    // Filter by last message content snippet: 'Phase 2'
    store.setSearchQuery('Phase 2')
    filtered = useConversationStore.getState().getFilteredConversations()
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe('conv-2')
  })

  // B - Boundaries: Realtime new message re-orders inbox and increments unread count
  it('B: handleNewMessage bumps conversation to the top and increments unread count when not active', () => {
    // Arrange: initial state with conv2 at top, conv1 at second
    useConversationStore.setState({
      conversations: [mockConv2, mockConv1],
      activeConversationId: null,
    })

    const newMsg: LastMessage = {
      id: 'msg-3',
      content: 'Tin nhắn mới nhất từ Nguyễn Văn A',
      type: 'TEXT',
      createdAt: '2026-10-26T10:30:00.000Z',
    }

    // Act: conv1 receives a new message from partner
    useConversationStore.getState().handleNewMessage('conv-1', newMsg, false)

    // Assert: conv1 should now be at the very top (index 0) with unreadCount = 2
    const state = useConversationStore.getState()
    expect(state.conversations[0].id).toBe('conv-1')
    expect(state.conversations[0].unreadCount).toBe(2)
    expect(state.conversations[0].lastMessage?.content).toBe('Tin nhắn mới nhất từ Nguyễn Văn A')
    expect(state.conversations[1].id).toBe('conv-2')
  })

  // I - Interfaces: Selecting conversation marks it as read optimistically
  it('I: setActiveConversation automatically marks conversation as read and resets unreadCount', async () => {
    // Arrange
    useConversationStore.setState({
      conversations: [mockConv1],
      activeConversationId: null,
    })
    vi.mocked(conversationApi.markAsRead).mockResolvedValueOnce(undefined)

    // Act
    useConversationStore.getState().setActiveConversation('conv-1')

    // Assert
    const state = useConversationStore.getState()
    expect(state.activeConversationId).toBe('conv-1')
    expect(state.conversations[0].unreadCount).toBe(0)
    expect(conversationApi.markAsRead).toHaveBeenCalledWith('conv-1')
  })

  // E - Exceptions: Handles fetch failure gracefully
  it('E: fetchInbox records error state when API fails', async () => {
    // Arrange
    vi.mocked(conversationApi.getInbox).mockRejectedValueOnce(new Error('Network error 500'))

    // Act
    await useConversationStore.getState().fetchInbox()

    // Assert
    const state = useConversationStore.getState()
    expect(state.isLoading).toBe(false)
    expect(state.error).toBe('Network error 500')
    expect(state.conversations).toEqual([])
  })

  // S - Simple Scenarios: reset restores clean state
  it('S: reset clears all conversations, filters, and active state', () => {
    // Arrange
    useConversationStore.setState({
      conversations: [mockConv1, mockConv2],
      activeConversationId: 'conv-1',
      searchQuery: 'test',
      filterTab: 'unread',
    })

    // Act
    useConversationStore.getState().reset()

    // Assert
    const state = useConversationStore.getState()
    expect(state.conversations).toEqual([])
    expect(state.activeConversationId).toBeNull()
    expect(state.searchQuery).toBe('')
    expect(state.filterTab).toBe('all')
  })
})
