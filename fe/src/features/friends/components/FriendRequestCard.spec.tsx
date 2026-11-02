import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FriendRequestCard } from './FriendRequestCard'
import type { FriendRequest } from '../types/friends.types'

describe('FriendRequestCard Component Tests', () => {
  const mockReceivedRequest: FriendRequest = {
    id: 'req-1',
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    requester: {
      id: 'user-sender',
      username: 'sender_user',
      displayName: 'Sender Name',
      avatarUrl: null,
    },
  }

  const mockSentRequest: FriendRequest = {
    id: 'req-2',
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    addressee: {
      id: 'user-receiver',
      username: 'receiver_user',
      displayName: 'Receiver Name',
      avatarUrl: null,
    },
  }

  it('calls onAccept when clicking Accept button', async () => {
    const onAccept = vi.fn().mockResolvedValue(undefined)

    render(
      <FriendRequestCard
        request={mockReceivedRequest}
        type="received"
        onAccept={onAccept}
      />
    )

    expect(screen.getByText('Sender Name')).toBeInTheDocument()
    expect(screen.getByText('@sender_user')).toBeInTheDocument()
    expect(screen.getByTestId('accept-btn-req-1')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('accept-btn-req-1'))
    expect(onAccept).toHaveBeenCalledWith('req-1')
  })

  it('calls onReject when clicking Reject button', async () => {
    const onReject = vi.fn().mockResolvedValue(undefined)

    render(
      <FriendRequestCard
        request={mockReceivedRequest}
        type="received"
        onReject={onReject}
      />
    )

    expect(screen.getByTestId('reject-btn-req-1')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('reject-btn-req-1'))
    expect(onReject).toHaveBeenCalledWith('req-1')
  })

  it('renders sent request card with pending badge and Cancel button', () => {
    const onCancel = vi.fn()

    render(
      <FriendRequestCard
        request={mockSentRequest}
        type="sent"
        onCancel={onCancel}
      />
    )

    expect(screen.getByText('Receiver Name')).toBeInTheDocument()
    expect(screen.getByText('@receiver_user')).toBeInTheDocument()
    expect(screen.getByText('Đang chờ phản hồi')).toBeInTheDocument()
    expect(screen.getByTestId('cancel-btn-req-2')).toBeInTheDocument()

    // Click Cancel
    fireEvent.click(screen.getByTestId('cancel-btn-req-2'))
    expect(onCancel).toHaveBeenCalledWith('req-2')
  })

  it('disables buttons when isProcessing is true', () => {
    render(
      <FriendRequestCard
        request={mockReceivedRequest}
        type="received"
        isProcessing={true}
      />
    )

    expect(screen.getByTestId('accept-btn-req-1')).toBeDisabled()
    expect(screen.getByTestId('reject-btn-req-1')).toBeDisabled()
  })
})
