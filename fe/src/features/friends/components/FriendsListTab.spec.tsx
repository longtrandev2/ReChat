import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FriendsListTab } from './FriendsListTab'
import type { FriendUser } from '../types/friends.types'

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}))

const mockIsUserOnline = vi.fn((id: string) => id === 'user-1')

vi.mock('@/hooks/useSocket', () => ({
  useSocket: () => ({
    isUserOnline: mockIsUserOnline,
  }),
}))

describe('FriendsListTab Component Tests', () => {
  const mockFriends: FriendUser[] = [
    {
      id: 'user-1',
      username: 'alice',
      displayName: 'Alice Wonder',
      avatarUrl: null,
      friendSince: '2026-10-01T00:00:00.000Z',
      isOnline: true,
    },
    {
      id: 'user-2',
      username: 'bob',
      displayName: 'Bob Builder',
      avatarUrl: null,
      friendSince: '2026-10-02T00:00:00.000Z',
      isOnline: false,
    },
  ]

  const mockOnSearchChange = vi.fn()
  const mockOnFilterChange = vi.fn()
  const mockOnUnfriend = vi.fn()
  const mockOnSwitchToFindTab = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders list of friends with filter buttons and search input', () => {
    render(
      <FriendsListTab
        friends={mockFriends}
        isLoading={false}
        searchQuery=""
        activeFilter="all"
        onSearchChange={mockOnSearchChange}
        onFilterChange={mockOnFilterChange}
        onUnfriend={mockOnUnfriend}
        onSwitchToFindTab={mockOnSwitchToFindTab}
      />
    )

    expect(screen.getByText('Alice Wonder')).toBeInTheDocument()
    expect(screen.getByText('Bob Builder')).toBeInTheDocument()
    expect(screen.getByTestId('filter-all-button')).toHaveTextContent('Tất cả (2)')
    expect(screen.getByTestId('filter-online-button')).toHaveTextContent('Đang hoạt động (1)')
  })

  it('filters friends based on search query', () => {
    render(
      <FriendsListTab
        friends={mockFriends}
        isLoading={false}
        searchQuery="bob"
        activeFilter="all"
        onSearchChange={mockOnSearchChange}
        onFilterChange={mockOnFilterChange}
        onUnfriend={mockOnUnfriend}
        onSwitchToFindTab={mockOnSwitchToFindTab}
      />
    )

    expect(screen.queryByText('Alice Wonder')).not.toBeInTheDocument()
    expect(screen.getByText('Bob Builder')).toBeInTheDocument()
  })

  it('filters friends based on activeFilter = online', () => {
    render(
      <FriendsListTab
        friends={mockFriends}
        isLoading={false}
        searchQuery=""
        activeFilter="online"
        onSearchChange={mockOnSearchChange}
        onFilterChange={mockOnFilterChange}
        onUnfriend={mockOnUnfriend}
        onSwitchToFindTab={mockOnSwitchToFindTab}
      />
    )

    // Alice is online (mocked true), Bob is offline
    expect(screen.getByText('Alice Wonder')).toBeInTheDocument()
    expect(screen.queryByText('Bob Builder')).not.toBeInTheDocument()
  })

  it('renders loading skeleton when isLoading is true', () => {
    render(
      <FriendsListTab
        friends={mockFriends}
        isLoading={true}
        searchQuery=""
        activeFilter="all"
        onSearchChange={mockOnSearchChange}
        onFilterChange={mockOnFilterChange}
        onUnfriend={mockOnUnfriend}
        onSwitchToFindTab={mockOnSwitchToFindTab}
      />
    )

    expect(screen.getByTestId('friends-loading-skeleton')).toBeInTheDocument()
  })

  it('renders infinite scroll sentinel when hasMore is true', () => {
    render(
      <FriendsListTab
        friends={mockFriends}
        isLoading={false}
        hasMore={true}
        searchQuery=""
        activeFilter="all"
        onSearchChange={mockOnSearchChange}
        onFilterChange={mockOnFilterChange}
        onUnfriend={mockOnUnfriend}
      />
    )

    expect(screen.getByTestId('infinite-scroll-sentinel')).toBeInTheDocument()
  })

  it('renders loading more spinner when isLoadingMore is true', () => {
    render(
      <FriendsListTab
        friends={mockFriends}
        isLoading={false}
        isLoadingMore={true}
        hasMore={true}
        searchQuery=""
        activeFilter="all"
        onSearchChange={mockOnSearchChange}
        onFilterChange={mockOnFilterChange}
        onUnfriend={mockOnUnfriend}
      />
    )

    expect(screen.getByTestId('friends-loading-more')).toBeInTheDocument()
    expect(screen.getByText('Đang tải thêm bạn bè...')).toBeInTheDocument()
  })

  it('ensures only friends-scroll-container has overflow-y-auto and header/filter are shrink-0', () => {
    render(
      <FriendsListTab
        friends={mockFriends}
        isLoading={false}
        searchQuery=""
        activeFilter="all"
        onSearchChange={mockOnSearchChange}
        onFilterChange={mockOnFilterChange}
        onUnfriend={mockOnUnfriend}
      />
    )

    const scrollContainer = screen.getByTestId('friends-scroll-container')
    expect(scrollContainer.className).toContain('overflow-y-auto')
    expect(scrollContainer.className).toContain('flex-1')
    expect(scrollContainer.className).toContain('min-h-0')
  })

  it('renders empty state when no friends exist and triggers find friends action', () => {
    render(
      <FriendsListTab
        friends={[]}
        isLoading={false}
        searchQuery=""
        activeFilter="all"
        onSearchChange={mockOnSearchChange}
        onFilterChange={mockOnFilterChange}
        onUnfriend={mockOnUnfriend}
        onSwitchToFindTab={mockOnSwitchToFindTab}
      />
    )

    expect(screen.getByText('Chưa có bạn bè nào')).toBeInTheDocument()
    const findBtn = screen.getByTestId('find-friends-action-button')
    fireEvent.click(findBtn)
    expect(mockOnSwitchToFindTab).toHaveBeenCalledTimes(1)
  })

  it('falls back to API isOnline when no realtime presence exists (FR-08)', () => {
    const friends: FriendUser[] = [
      { ...mockFriends[1], id: 'user-3', username: 'carol', displayName: 'Carol', isOnline: true },
    ]
    render(
      <FriendsListTab
        friends={friends}
        isLoading={false}
        searchQuery=""
        activeFilter="all"
        onSearchChange={mockOnSearchChange}
        onFilterChange={mockOnFilterChange}
        onUnfriend={mockOnUnfriend}
      />
    )
    expect(screen.getByTestId('filter-online-button')).toHaveTextContent('Đang hoạt động (1)')
  })
})
