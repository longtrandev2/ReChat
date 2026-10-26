import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConversationSidebar } from './ConversationSidebar'
import { useConversationStore } from '../stores/conversation.store'
import type { Conversation } from '../types/conversation.types'

// Mock useSocket
vi.mock('@/hooks/useSocket', () => ({
  useSocket: () => ({
    isUserOnline: vi.fn(() => false),
    isConnected: true,
  }),
}))

describe('ConversationSidebar Component Tests', () => {
  const user = userEvent.setup()

  const mockConv1: Conversation = {
    id: 'conv-1',
    type: 'DIRECT',
    name: 'Nguyễn Văn A',
    avatarUrl: null,
    unreadCount: 2,
    lastMessage: {
      id: 'msg-1',
      content: 'Chào bạn, dự án thế nào rồi?',
      type: 'TEXT',
      createdAt: '2026-10-26T10:00:00.000Z',
    },
    lastMessageAt: '2026-10-26T10:00:00.000Z',
    createdAt: '2026-10-20T00:00:00.000Z',
    updatedAt: '2026-10-26T10:00:00.000Z',
  }

  const mockConv2: Conversation = {
    id: 'conv-2',
    type: 'GROUP',
    name: 'Nhóm Lập Trình Frontend',
    avatarUrl: null,
    unreadCount: 0,
    lastMessage: {
      id: 'msg-2',
      content: 'Đã hoàn thành Task 2',
      type: 'TEXT',
      createdAt: '2026-10-26T09:30:00.000Z',
    },
    lastMessageAt: '2026-10-26T09:30:00.000Z',
    createdAt: '2026-10-21T00:00:00.000Z',
    updatedAt: '2026-10-26T09:30:00.000Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    useConversationStore.setState({
      conversations: [mockConv1, mockConv2],
      activeConversationId: null,
      searchQuery: '',
      filterTab: 'all',
      isLoading: false,
      error: null,
    })
  })

  it('renders header, search bar, tabs, and conversation items', () => {
    render(<ConversationSidebar />)

    // Heading
    expect(screen.getByRole('heading', { name: 'Đoạn chat' })).toBeInTheDocument()
    // Search input
    expect(screen.getByPlaceholderText('Tìm kiếm đoạn chat...')).toBeInTheDocument()
    // Tabs
    expect(screen.getByRole('button', { name: 'Tất cả' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /chưa đọc/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nhóm' })).toBeInTheDocument()

    // Items
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument()
    expect(screen.getByText('Nhóm Lập Trình Frontend')).toBeInTheDocument()
  })

  it('shows skeleton loader when isLoading is true and conversations are empty', () => {
    useConversationStore.setState({
      conversations: [],
      isLoading: true,
    })

    render(<ConversationSidebar />)
    expect(screen.getByTestId('sidebar-skeleton')).toBeInTheDocument()
  })

  it('filters conversation list when typing into search bar and clears query on click', async () => {
    render(<ConversationSidebar />)

    const searchInput = screen.getByPlaceholderText('Tìm kiếm đoạn chat...')
    await user.type(searchInput, 'Frontend')

    expect(screen.getByText('Nhóm Lập Trình Frontend')).toBeInTheDocument()
    expect(screen.queryByText('Nguyễn Văn A')).not.toBeInTheDocument()

    // Clear search
    const clearBtn = screen.getByRole('button', { name: 'Xóa tìm kiếm' })
    await user.click(clearBtn)

    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument()
    expect(screen.getByText('Nhóm Lập Trình Frontend')).toBeInTheDocument()
  })

  it('filters by "Chưa đọc" tab correctly', async () => {
    render(<ConversationSidebar />)

    const unreadTab = screen.getByRole('button', { name: /chưa đọc/i })
    await user.click(unreadTab)

    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument()
    expect(screen.queryByText('Nhóm Lập Trình Frontend')).not.toBeInTheDocument()
  })

  it('triggers onSelectConversation callback when clicking a conversation item', async () => {
    const handleSelect = vi.fn()
    render(<ConversationSidebar onSelectConversation={handleSelect} />)

    const item = screen.getByText('Nguyễn Văn A')
    await user.click(item)

    expect(handleSelect).toHaveBeenCalledWith('conv-1')
    expect(useConversationStore.getState().activeConversationId).toBe('conv-1')
  })
})
