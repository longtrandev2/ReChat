import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { UserSearchCard } from './UserSearchCard'
import type { FriendUser } from '../types/friends.types'

const mockNavigate = vi.fn()
const toastError = vi.hoisted(() => vi.fn())
vi.mock('sonner', () => ({ toast: { error: toastError } }))
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('@/features/conversations/services/conversation.api', () => ({
  conversationApi: {
    createDirect: vi.fn().mockResolvedValue({ id: 'conv-123' }),
  },
}))

describe('UserSearchCard Component Tests', () => {
  const mockUser: FriendUser = {
    id: 'user-test-1',
    username: 'johndoe',
    displayName: 'John Doe',
    avatarUrl: null,
  }

  it('renders with "Kết bạn" button when relationStatus is NONE', () => {
    const onSend = vi.fn().mockResolvedValue(undefined)

    render(
      <UserSearchCard
        user={mockUser}
        relationStatus="NONE"
        onSendRequest={onSend}
      />
    )

    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('@johndoe')).toBeInTheDocument()
    expect(screen.getByText('Chưa kết nối')).toBeInTheDocument()

    const addBtn = screen.getByTestId('send-friend-request-btn-user-test-1')
    expect(addBtn).toBeInTheDocument()
    fireEvent.click(addBtn)
    expect(onSend).toHaveBeenCalledWith('user-test-1')
  })

  it('renders with "Nhắn tin" button and "Bạn bè" badge when relationStatus is FRIEND', async () => {
    render(
      <UserSearchCard
        user={mockUser}
        relationStatus="FRIEND"
        onSendRequest={vi.fn()}
      />
    )

    expect(screen.getByText('Bạn bè')).toBeInTheDocument()
    const msgBtn = screen.getByTestId('message-user-btn-user-test-1')
    expect(msgBtn).toBeInTheDocument()

    fireEvent.click(msgBtn)
    await vi.waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/chat/conv-123')
    })
  })

  it('renders with "Hủy lời mời" button when relationStatus is SENT_REQUEST', () => {
    const onCancel = vi.fn().mockResolvedValue(undefined)

    render(
      <UserSearchCard
        user={mockUser}
        relationStatus="SENT_REQUEST"
        requestId="req-sent-1"
        onSendRequest={vi.fn()}
        onCancelRequest={onCancel}
      />
    )

    expect(screen.getByText('Đã gửi lời mời')).toBeInTheDocument()
    const cancelBtn = screen.getByTestId('cancel-user-request-btn-user-test-1')
    fireEvent.click(cancelBtn)
    expect(onCancel).toHaveBeenCalledWith('req-sent-1')
  })

  it('calls onAcceptRequest when clicking Accept button in RECEIVED_REQUEST status', () => {
    const onAccept = vi.fn().mockResolvedValue(undefined)

    render(
      <UserSearchCard
        user={mockUser}
        relationStatus="RECEIVED_REQUEST"
        requestId="req-rcv-1"
        onSendRequest={vi.fn()}
        onAcceptRequest={onAccept}
      />
    )

    expect(screen.getByText('Đã gửi lời mời cho bạn')).toBeInTheDocument()
    const acceptBtn = screen.getByTestId('accept-user-request-btn-user-test-1')
    fireEvent.click(acceptBtn)
    expect(onAccept).toHaveBeenCalledWith('req-rcv-1')
  })

  it('calls onRejectRequest when clicking Reject button in RECEIVED_REQUEST status', () => {
    const onReject = vi.fn().mockResolvedValue(undefined)

    render(
      <UserSearchCard
        user={mockUser}
        relationStatus="RECEIVED_REQUEST"
        requestId="req-rcv-1"
        onSendRequest={vi.fn()}
        onRejectRequest={onReject}
      />
    )

    const rejectBtn = screen.getByTestId('reject-user-request-btn-user-test-1')
    fireEvent.click(rejectBtn)
    expect(onReject).toHaveBeenCalledWith('req-rcv-1')
  })

  it('M5: shows a toast with the server message when sending a request fails (BR-28)', async () => {
    const onSend = vi.fn().mockRejectedValue({
      isAxiosError: true,
      response: { data: { message: 'Bạn không thể gửi lời mời kết bạn cho người dùng này' } },
    })
    render(<UserSearchCard user={mockUser} relationStatus="NONE" onSendRequest={onSend} />)

    fireEvent.click(screen.getByTestId('send-friend-request-btn-user-test-1'))

    await waitFor(() => expect(toastError).toHaveBeenCalled())
    expect(screen.getByTestId('send-friend-request-btn-user-test-1')).toBeInTheDocument()
  })
})
