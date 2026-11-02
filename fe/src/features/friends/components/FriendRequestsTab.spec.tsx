import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FriendRequestsTab } from './FriendRequestsTab'
import type { FriendRequest } from '../types/friends.types'

describe('FriendRequestsTab Component Tests', () => {
  const mockReceived: FriendRequest[] = [
    {
      id: 'req-r1',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      requester: {
        id: 'u-sender-1',
        username: 'alice',
        displayName: 'Alice Walker',
        avatarUrl: null,
      },
    },
  ]

  const mockSent: FriendRequest[] = [
    {
      id: 'req-s1',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      addressee: {
        id: 'u-target-1',
        username: 'bob',
        displayName: 'Bob Dylan',
        avatarUrl: null,
      },
    },
  ]

  it('renders received subtab by default with count badges', () => {
    const onSubTabChange = vi.fn()

    render(
      <FriendRequestsTab
        receivedRequests={mockReceived}
        sentRequests={mockSent}
        subTab="received"
        isLoading={false}
        onSubTabChange={onSubTabChange}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByTestId('subtab-received-button')).toHaveTextContent('Đã nhận (1)')
    expect(screen.getByTestId('subtab-sent-button')).toHaveTextContent('Đã gửi (1)')
    expect(screen.getByText('Alice Walker')).toBeInTheDocument()

    // Switch subtab
    fireEvent.click(screen.getByTestId('subtab-sent-button'))
    expect(onSubTabChange).toHaveBeenCalledWith('sent')
  })

  it('renders sent requests when subTab is sent', () => {
    render(
      <FriendRequestsTab
        receivedRequests={mockReceived}
        sentRequests={mockSent}
        subTab="sent"
        isLoading={false}
        onSubTabChange={vi.fn()}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText('Bob Dylan')).toBeInTheDocument()
    expect(screen.getByText('Đang chờ phản hồi')).toBeInTheDocument()
  })

  it('ensures only requests-scroll-container has overflow-y-auto and subtabs are shrink-0', () => {
    render(
      <FriendRequestsTab
        receivedRequests={mockReceived}
        sentRequests={mockSent}
        subTab="received"
        isLoading={false}
        onSubTabChange={vi.fn()}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    const scrollContainer = screen.getByTestId('requests-scroll-container')
    expect(scrollContainer.className).toContain('overflow-y-auto')
    expect(scrollContainer.className).toContain('flex-1')
    expect(scrollContainer.className).toContain('min-h-0')
  })

  it('renders skeleton loading when isLoading is true', () => {
    render(
      <FriendRequestsTab
        receivedRequests={mockReceived}
        sentRequests={mockSent}
        subTab="received"
        isLoading={true}
        onSubTabChange={vi.fn()}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByTestId('requests-loading-skeleton')).toBeInTheDocument()
  })

  it('renders empty state when receivedRequests is empty', () => {
    render(
      <FriendRequestsTab
        receivedRequests={[]}
        sentRequests={[]}
        subTab="received"
        isLoading={false}
        onSubTabChange={vi.fn()}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText('Không có lời mời kết bạn nào')).toBeInTheDocument()
  })

  it('renders empty state when sentRequests is empty', () => {
    render(
      <FriendRequestsTab
        receivedRequests={[]}
        sentRequests={[]}
        subTab="sent"
        isLoading={false}
        onSubTabChange={vi.fn()}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText('Bạn chưa gửi lời mời nào')).toBeInTheDocument()
  })
})
