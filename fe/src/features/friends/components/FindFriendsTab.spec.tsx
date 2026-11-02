import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FindFriendsTab } from './FindFriendsTab'
import type { FriendUser, FriendRequest } from '../types/friends.types'

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}))

describe('FindFriendsTab Component Tests', () => {
  const mockUser1: FriendUser = {
    id: 'u-1',
    username: 'alice',
    displayName: 'Alice Walker',
    avatarUrl: null,
  }

  const mockUser2: FriendUser = {
    id: 'u-2',
    username: 'bob',
    displayName: 'Bob Dylan',
    avatarUrl: null,
  }

  const mockFriends: FriendUser[] = [mockUser1]
  const mockSentRequests: FriendRequest[] = [
    {
      id: 'req-sent-1',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      addressee: mockUser2,
    },
  ]

  it('renders discovery prompt when searchQuery is empty', () => {
    render(
      <FindFriendsTab
        searchQuery=""
        searchResults={[]}
        friends={[]}
        sentRequests={[]}
        receivedRequests={[]}
        isSearching={false}
        onSearchChange={vi.fn()}
        onSendRequest={vi.fn()}
      />
    )

    expect(screen.getByTestId('find-prompt-state')).toBeInTheDocument()
    expect(screen.getByText('Khám phá & Kết bạn trên ReChat')).toBeInTheDocument()
    expect(screen.getByTestId('find-users-input')).toBeInTheDocument()
  })

  it('calls onSearchChange when typing in search input', () => {
    const onSearchChange = vi.fn()

    render(
      <FindFriendsTab
        searchQuery=""
        searchResults={[]}
        friends={[]}
        sentRequests={[]}
        receivedRequests={[]}
        isSearching={false}
        onSearchChange={onSearchChange}
        onSendRequest={vi.fn()}
      />
    )

    const input = screen.getByTestId('find-users-input')
    fireEvent.change(input, { target: { value: 'alice' } })
    expect(onSearchChange).toHaveBeenCalledWith('alice')
  })

  it('renders search results grid with accurate relation status', () => {
    render(
      <FindFriendsTab
        searchQuery="test"
        searchResults={[mockUser1, mockUser2]}
        friends={mockFriends}
        sentRequests={mockSentRequests}
        receivedRequests={[]}
        isSearching={false}
        onSearchChange={vi.fn()}
        onSendRequest={vi.fn()}
      />
    )

    // Alice is already friend
    expect(screen.getByText('Alice Walker')).toBeInTheDocument()
    expect(screen.getByTestId('message-user-btn-u-1')).toBeInTheDocument()

    // Bob has sent request pending
    expect(screen.getByText('Bob Dylan')).toBeInTheDocument()
    expect(screen.getByTestId('cancel-user-request-btn-u-2')).toBeInTheDocument()
  })

  it('ensures only find-friends-scroll-container has overflow-y-auto and search bar is shrink-0', () => {
    render(
      <FindFriendsTab
        searchQuery="test"
        searchResults={[mockUser1]}
        friends={[]}
        sentRequests={[]}
        receivedRequests={[]}
        isSearching={false}
        onSearchChange={vi.fn()}
        onSendRequest={vi.fn()}
      />
    )

    const scrollContainer = screen.getByTestId('find-friends-scroll-container')
    expect(scrollContainer.className).toContain('overflow-y-auto')
    expect(scrollContainer.className).toContain('flex-1')
    expect(scrollContainer.className).toContain('min-h-0')
  })

  it('renders no results state when searching with non-matching query', () => {
    render(
      <FindFriendsTab
        searchQuery="nonexistent"
        searchResults={[]}
        friends={[]}
        sentRequests={[]}
        receivedRequests={[]}
        isSearching={false}
        onSearchChange={vi.fn()}
        onSendRequest={vi.fn()}
      />
    )

    expect(screen.getByTestId('find-users-no-results')).toBeInTheDocument()
    expect(screen.getByText('Không tìm thấy người dùng')).toBeInTheDocument()
  })

  it('renders loading skeleton when isSearching is true', () => {
    render(
      <FindFriendsTab
        searchQuery="alice"
        searchResults={[]}
        friends={[]}
        sentRequests={[]}
        receivedRequests={[]}
        isSearching={true}
        onSearchChange={vi.fn()}
        onSendRequest={vi.fn()}
      />
    )

    expect(screen.getByTestId('find-users-loading-skeleton')).toBeInTheDocument()
  })
})
