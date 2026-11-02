import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FriendsPage } from './FriendsPage'
import { friendsApi } from '../services/friends.api'
import type { FriendUser } from '../types/friends.types'

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}))

const mockSocketOn = vi.fn()
const mockSocketOff = vi.fn()

vi.mock('@/hooks/useSocket', () => ({
  useSocket: () => ({
    socket: {
      on: mockSocketOn,
      off: mockSocketOff,
    },
    isUserOnline: (id: string) => id === 'u1',
  }),
}))

vi.mock('../services/friends.api', () => ({
  friendsApi: {
    getFriends: vi.fn(),
    getFriendsPaginated: vi.fn(),
    getReceivedRequests: vi.fn(),
    getSentRequests: vi.fn(),
    acceptRequest: vi.fn(),
    rejectRequest: vi.fn(),
    cancelRequest: vi.fn(),
    unfriend: vi.fn(),
    getBlockedUsers: vi.fn(),
    blockUser: vi.fn(),
    unblockUser: vi.fn(),
  },
}))

describe('FriendsPage Component Tests', () => {
  const mockFriends: FriendUser[] = [
    {
      id: 'u1',
      username: 'johndoe',
      displayName: 'John Doe',
      avatarUrl: null,
      friendSince: '2026-10-15T00:00:00.000Z',
      isOnline: true,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(friendsApi.getFriends).mockResolvedValue(mockFriends)
    vi.mocked(friendsApi.getFriendsPaginated).mockResolvedValue({
      data: mockFriends,
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    })
    vi.mocked(friendsApi.getReceivedRequests).mockResolvedValue([])
    vi.mocked(friendsApi.getSentRequests).mockResolvedValue([])
    vi.mocked(friendsApi.getBlockedUsers).mockResolvedValue([])
  })

  it('renders page header and default Tab 1 (Tất cả bạn bè)', async () => {
    render(<FriendsPage />)

    expect(screen.getByText('Danh bạ & Bạn bè')).toBeInTheDocument()
    expect(screen.getByTestId('tab-all')).toBeInTheDocument()
    expect(screen.getByTestId('tab-requests')).toBeInTheDocument()
    expect(screen.getByTestId('tab-blocked')).toBeInTheDocument()
    expect(screen.getByTestId('tab-find')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('@johndoe')).toBeInTheDocument()
    })
  })

  it('switches to other tabs when clicking tab navigation pills', async () => {
    render(<FriendsPage />)

    // Click Tab Requests
    fireEvent.click(screen.getByTestId('tab-requests'))
    expect(screen.getByTestId('friend-requests-tab')).toBeInTheDocument()

    // Click Tab Blocked
    fireEvent.click(screen.getByTestId('tab-blocked'))
    expect(screen.getByTestId('blocked-users-tab')).toBeInTheDocument()

    // Click Tab Find
    fireEvent.click(screen.getByTestId('tab-find'))
    expect(screen.getByTestId('find-friends-tab')).toBeInTheDocument()

    // Switch back to Tab All
    fireEvent.click(screen.getByTestId('tab-all'))
    expect(screen.getByTestId('friends-list-tab')).toBeInTheDocument()
  })

  it('registers and unregisters socket presence and friendship events on mount and unmount', () => {
    const { unmount } = render(<FriendsPage />)

    expect(mockSocketOn).toHaveBeenCalledWith('friendRequestAccepted', expect.any(Function))
    expect(mockSocketOn).toHaveBeenCalledWith('friendRemoved', expect.any(Function))
    expect(mockSocketOn).toHaveBeenCalledWith('userPresence', expect.any(Function))
    expect(mockSocketOn).toHaveBeenCalledWith('friendRequestReceived', expect.any(Function))
    expect(mockSocketOn).toHaveBeenCalledWith('friendRequestCancelled', expect.any(Function))
    expect(mockSocketOn).toHaveBeenCalledWith('friendRequestRejected', expect.any(Function))

    unmount()

    expect(mockSocketOff).toHaveBeenCalledWith('friendRequestAccepted', expect.any(Function))
    expect(mockSocketOff).toHaveBeenCalledWith('friendRemoved', expect.any(Function))
    expect(mockSocketOff).toHaveBeenCalledWith('userPresence', expect.any(Function))
    expect(mockSocketOff).toHaveBeenCalledWith('friendRequestReceived', expect.any(Function))
    expect(mockSocketOff).toHaveBeenCalledWith('friendRequestCancelled', expect.any(Function))
    expect(mockSocketOff).toHaveBeenCalledWith('friendRequestRejected', expect.any(Function))
  })
})
