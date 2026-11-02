import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FriendCard } from './FriendCard'
import { conversationApi } from '@/features/conversations/services/conversation.api'
import type { FriendUser } from '../types/friends.types'
import type { Conversation } from '@/features/conversations/types/conversation.types'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('@/features/conversations/services/conversation.api', () => ({
  conversationApi: {
    createDirect: vi.fn(),
  },
}))

describe('FriendCard Component Tests', () => {
  const mockFriend: FriendUser = {
    id: 'friend-1',
    username: 'alexnguyen',
    displayName: 'Alex Nguyễn',
    avatarUrl: null,
    friendSince: '2026-10-10T08:00:00.000Z',
    isOnline: true,
  }

  const mockOnUnfriend = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders friend name, username, and online indicator', () => {
    render(<FriendCard friend={mockFriend} isOnline={true} onUnfriend={mockOnUnfriend} />)

    expect(screen.getByText('Alex Nguyễn')).toBeInTheDocument()
    expect(screen.getByText('@alexnguyen')).toBeInTheDocument()
    expect(screen.getByText('Đang hoạt động')).toBeInTheDocument()
    expect(screen.getByText(/Bạn từ 10\/10\/2026/)).toBeInTheDocument()
  })

  it('renders offline label when isOnline is false', () => {
    render(<FriendCard friend={mockFriend} isOnline={false} onUnfriend={mockOnUnfriend} />)

    expect(screen.getByText('Ngoại tuyến')).toBeInTheDocument()
  })

  it('clicking "Nhắn tin" calls createDirect and navigates to conversation route', async () => {
    const mockConv: Partial<Conversation> = {
      id: 'conv-direct-1',
      type: 'DIRECT',
    }
    vi.mocked(conversationApi.createDirect).mockResolvedValueOnce(mockConv as Conversation)

    render(<FriendCard friend={mockFriend} isOnline={true} onUnfriend={mockOnUnfriend} />)

    const chatButton = screen.getByTestId('start-chat-btn-friend-1')
    fireEvent.click(chatButton)

    await waitFor(() => {
      expect(conversationApi.createDirect).toHaveBeenCalledWith({ targetUserId: 'friend-1' })
      expect(mockNavigate).toHaveBeenCalledWith('/chat/conv-direct-1')
    })
  })

  it('opens confirmation modal and executes unfriend action', async () => {
    const user = userEvent.setup()
    mockOnUnfriend.mockResolvedValueOnce(undefined)

    render(<FriendCard friend={mockFriend} isOnline={true} onUnfriend={mockOnUnfriend} />)

    // Click options dropdown button
    const optionsBtn = screen.getByTestId('friend-options-friend-1')
    await user.click(optionsBtn)

    // Click "Hủy kết bạn" item in dropdown
    const unfriendMenuItem = await screen.findByTestId('unfriend-btn-friend-1')
    await user.click(unfriendMenuItem)

    // Confirmation dialog should be visible
    expect(screen.getByText(/Bạn có chắc chắn muốn hủy kết bạn/)).toBeInTheDocument()

    // Confirm unfriend
    const confirmBtn = screen.getByTestId('confirm-unfriend-button')
    await user.click(confirmBtn)

    await waitFor(() => {
      expect(mockOnUnfriend).toHaveBeenCalledWith('friend-1')
    })
  })

  it('opens block confirmation modal and executes block action', async () => {
    const user = userEvent.setup()
    const mockOnBlock = vi.fn().mockResolvedValueOnce(undefined)

    render(
      <FriendCard
        friend={mockFriend}
        isOnline={true}
        onUnfriend={mockOnUnfriend}
        onBlock={mockOnBlock}
      />
    )

    // Click options dropdown button
    const optionsBtn = screen.getByTestId('friend-options-friend-1')
    await user.click(optionsBtn)

    // Click "Chặn người dùng" item in dropdown
    const blockMenuItem = await screen.findByTestId('block-btn-friend-1')
    await user.click(blockMenuItem)

    // Confirmation dialog should be visible
    expect(screen.getByText(/Bạn có chắc chắn muốn chặn/)).toBeInTheDocument()

    // Confirm block
    const confirmBtn = screen.getByTestId('confirm-block-button')
    await user.click(confirmBtn)

    await waitFor(() => {
      expect(mockOnBlock).toHaveBeenCalledWith('friend-1')
    })
  })
})

