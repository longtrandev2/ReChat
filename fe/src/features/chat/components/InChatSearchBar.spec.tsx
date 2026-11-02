import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { InChatSearchBar } from './InChatSearchBar'
import { conversationApi } from '@/features/conversations/services/conversation.api'
import type { Message } from '../types/message.types'

vi.mock('@/features/conversations/services/conversation.api', () => ({
  conversationApi: {
    searchMessages: vi.fn(),
  },
}))

describe('InChatSearchBar Component Tests', () => {
  const mockOnJumpToMessage = vi.fn()
  const mockOnClose = vi.fn()

  const mockMessages: Message[] = [
    {
      id: 'msg-1',
      content: 'Tin nhắn chào buổi sáng',
      type: 'TEXT',
      fileUrl: null,
      replyToId: null,
      isRecalled: false,
      createdAt: '2026-10-26T08:00:00.000Z',
      updatedAt: '2026-10-26T08:00:00.000Z',
      sender: {
        id: 'user-1',
        username: 'nguyenvana',
        displayName: 'Nguyễn Văn A',
        avatarUrl: null,
      },
    },
    {
      id: 'msg-2',
      content: 'Chào buổi sáng bạn nhé!',
      type: 'TEXT',
      fileUrl: null,
      replyToId: null,
      isRecalled: false,
      createdAt: '2026-10-26T08:05:00.000Z',
      updatedAt: '2026-10-26T08:05:00.000Z',
      sender: {
        id: 'user-2',
        username: 'tranthib',
        displayName: 'Trần Thị B',
        avatarUrl: null,
      },
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders input with placeholder and autofocus', () => {
    render(
      <InChatSearchBar
        conversationId="conv-1"
        onJumpToMessage={mockOnJumpToMessage}
        onClose={mockOnClose}
      />
    )

    const input = screen.getByTestId('in-chat-search-input')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('placeholder', 'Tìm kiếm trong cuộc trò chuyện...')
    expect(document.activeElement).toBe(input)
  })

  it('triggers search API after 300ms debounce and displays result counter', async () => {
    vi.mocked(conversationApi.searchMessages).mockResolvedValueOnce(mockMessages)

    render(
      <InChatSearchBar
        conversationId="conv-1"
        onJumpToMessage={mockOnJumpToMessage}
        onClose={mockOnClose}
      />
    )

    const input = screen.getByTestId('in-chat-search-input')
    fireEvent.change(input, { target: { value: 'chào' } })

    await waitFor(() => {
      expect(conversationApi.searchMessages).toHaveBeenCalledWith('conv-1', 'chào')
    })

    await waitFor(() => {
      expect(screen.getByTestId('in-chat-search-counter')).toHaveTextContent('2 / 2')
    })

    // Mặc định chọn kết quả cuối cùng (mới nhất)
    expect(mockOnJumpToMessage).toHaveBeenCalledWith('msg-2')
  })

  it('navigates results with prev and next buttons', async () => {
    vi.mocked(conversationApi.searchMessages).mockResolvedValueOnce(mockMessages)

    render(
      <InChatSearchBar
        conversationId="conv-1"
        onJumpToMessage={mockOnJumpToMessage}
        onClose={mockOnClose}
      />
    )

    const input = screen.getByTestId('in-chat-search-input')
    fireEvent.change(input, { target: { value: 'buổi sáng' } })

    await waitFor(() => {
      expect(screen.getByTestId('in-chat-search-counter')).toHaveTextContent('2 / 2')
    })

    const prevBtn = screen.getByTestId('in-chat-search-prev')
    const nextBtn = screen.getByTestId('in-chat-search-next')

    // Bấm Prev: chuyển từ index 1 về index 0
    fireEvent.click(prevBtn)
    expect(screen.getByTestId('in-chat-search-counter')).toHaveTextContent('1 / 2')
    expect(mockOnJumpToMessage).toHaveBeenCalledWith('msg-1')

    // Bấm Next: chuyển từ index 0 sang index 1
    fireEvent.click(nextBtn)
    expect(screen.getByTestId('in-chat-search-counter')).toHaveTextContent('2 / 2')
    expect(mockOnJumpToMessage).toHaveBeenCalledWith('msg-2')
  })

  it('supports keyboard navigation (Enter, Shift+Enter, Escape)', async () => {
    vi.mocked(conversationApi.searchMessages).mockResolvedValueOnce(mockMessages)

    render(
      <InChatSearchBar
        conversationId="conv-1"
        onJumpToMessage={mockOnJumpToMessage}
        onClose={mockOnClose}
      />
    )

    const input = screen.getByTestId('in-chat-search-input')
    fireEvent.change(input, { target: { value: 'sáng' } })

    await waitFor(() => {
      expect(screen.getByTestId('in-chat-search-counter')).toHaveTextContent('2 / 2')
    })

    // Shift + Enter: Prev
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    expect(screen.getByTestId('in-chat-search-counter')).toHaveTextContent('1 / 2')
    expect(mockOnJumpToMessage).toHaveBeenCalledWith('msg-1')

    // Enter: Next
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false })
    expect(screen.getByTestId('in-chat-search-counter')).toHaveTextContent('2 / 2')
    expect(mockOnJumpToMessage).toHaveBeenCalledWith('msg-2')

    // Escape: Close
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('displays "Không tìm thấy" when 0 results found', async () => {
    vi.mocked(conversationApi.searchMessages).mockResolvedValueOnce([])

    render(
      <InChatSearchBar
        conversationId="conv-1"
        onJumpToMessage={mockOnJumpToMessage}
        onClose={mockOnClose}
      />
    )

    const input = screen.getByTestId('in-chat-search-input')
    fireEvent.change(input, { target: { value: 'từ khóa không tồn tại' } })

    await waitFor(() => {
      expect(screen.getByTestId('in-chat-search-counter')).toHaveTextContent('Không tìm thấy')
    })
  })

  it('clears query and resets state when clear button is clicked', async () => {
    vi.mocked(conversationApi.searchMessages).mockResolvedValueOnce(mockMessages)

    render(
      <InChatSearchBar
        conversationId="conv-1"
        onJumpToMessage={mockOnJumpToMessage}
        onClose={mockOnClose}
      />
    )

    const input = screen.getByTestId('in-chat-search-input')
    fireEvent.change(input, { target: { value: 'chào' } })

    await waitFor(() => {
      expect(screen.getByTestId('in-chat-search-clear')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('in-chat-search-clear'))
    expect(input).toHaveValue('')
    expect(screen.queryByTestId('in-chat-search-counter')).not.toBeInTheDocument()
  })

  it('calls onQueryChange when typing and resets on clear or close', () => {
    const mockOnQueryChange = vi.fn()
    render(
      <InChatSearchBar
        conversationId="conv-1"
        onJumpToMessage={mockOnJumpToMessage}
        onClose={mockOnClose}
        onQueryChange={mockOnQueryChange}
      />
    )

    const input = screen.getByTestId('in-chat-search-input')
    fireEvent.change(input, { target: { value: 'rechat' } })
    expect(mockOnQueryChange).toHaveBeenCalledWith('rechat')

    fireEvent.click(screen.getByTestId('in-chat-search-close'))
    expect(mockOnQueryChange).toHaveBeenCalledWith('')
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })
})
