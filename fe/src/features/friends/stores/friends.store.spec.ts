import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useFriendsStore } from './friends.store'
import { friendsApi } from '../services/friends.api'
import type { FriendUser, FriendRequest } from '../types/friends.types'

vi.mock('../services/friends.api', () => ({
  friendsApi: {
    getFriends: vi.fn(),
    getFriendsPaginated: vi.fn(),
    unfriend: vi.fn(),
    getReceivedRequests: vi.fn(),
    getSentRequests: vi.fn(),
    acceptRequest: vi.fn(),
    rejectRequest: vi.fn(),
    cancelRequest: vi.fn(),
    searchUsers: vi.fn(),
    sendFriendRequest: vi.fn(),
    getBlockedUsers: vi.fn(),
    blockUser: vi.fn(),
    unblockUser: vi.fn(),
  },
}))

describe('FriendsStore Tests', () => {
  const mockFriend1: FriendUser = {
    id: 'user-1',
    username: 'nguyenvana',
    displayName: 'Nguyễn Văn A',
    avatarUrl: null,
    friendSince: '2026-10-14T10:00:00.000Z',
    isOnline: true,
  }

  const mockFriend2: FriendUser = {
    id: 'user-2',
    username: 'tranthib',
    displayName: 'Trần Thị B',
    avatarUrl: null,
    friendSince: '2026-10-15T10:00:00.000Z',
    isOnline: false,
  }

  const mockRequest1: FriendRequest = {
    id: 'req-1',
    status: 'PENDING',
    createdAt: '2026-10-20T00:00:00.000Z',
    requester: mockFriend1,
  }

  const mockRequest2: FriendRequest = {
    id: 'req-2',
    status: 'PENDING',
    createdAt: '2026-10-21T00:00:00.000Z',
    addressee: mockFriend2,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    useFriendsStore.setState({
      friends: [],
      isLoadingFriends: false,
      isLoadingMore: false,
      page: 1,
      hasMore: false,
      totalFriends: 0,
      searchQuery: '',
      activeFilter: 'all',
      receivedRequestsCount: 0,
      receivedRequests: [],
      sentRequests: [],
      isLoadingRequests: false,
      requestsSubTab: 'received',
      isActionInProgress: {},
    })
  })

  it('fetchFriends populates store with friends from API', async () => {
    vi.mocked(friendsApi.getFriendsPaginated).mockResolvedValueOnce({
      data: [mockFriend1, mockFriend2],
      meta: {
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    })

    await useFriendsStore.getState().fetchFriends()

    expect(friendsApi.getFriendsPaginated).toHaveBeenCalledWith({ page: 1, limit: 20 })
    expect(useFriendsStore.getState().friends).toEqual([mockFriend1, mockFriend2])
    expect(useFriendsStore.getState().isLoadingFriends).toBe(false)
    expect(useFriendsStore.getState().hasMore).toBe(false)
    expect(useFriendsStore.getState().totalFriends).toBe(2)
  })

  it('loadMoreFriends fetches next page and appends unique friends to store', async () => {
    useFriendsStore.setState({
      friends: [mockFriend1],
      page: 1,
      hasMore: true,
      totalFriends: 2,
    })

    vi.mocked(friendsApi.getFriendsPaginated).mockResolvedValueOnce({
      data: [mockFriend2],
      meta: {
        page: 2,
        limit: 20,
        total: 2,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: true,
      },
    })

    await useFriendsStore.getState().loadMoreFriends()

    expect(friendsApi.getFriendsPaginated).toHaveBeenCalledWith({ page: 2, limit: 20 })
    expect(useFriendsStore.getState().friends).toEqual([mockFriend1, mockFriend2])
    expect(useFriendsStore.getState().page).toBe(2)
    expect(useFriendsStore.getState().hasMore).toBe(false)
  })

  it('loadMoreFriends ignores call if hasMore is false or already loading', async () => {
    useFriendsStore.setState({
      friends: [mockFriend1],
      page: 1,
      hasMore: false,
      isLoadingMore: false,
    })

    await useFriendsStore.getState().loadMoreFriends()
    expect(friendsApi.getFriendsPaginated).not.toHaveBeenCalled()
  })

  it('unfriend removes friend from store and calls API', async () => {
    useFriendsStore.setState({ friends: [mockFriend1, mockFriend2] })
    vi.mocked(friendsApi.unfriend).mockResolvedValueOnce({ message: 'Success' })

    await useFriendsStore.getState().unfriend('user-1')

    expect(friendsApi.unfriend).toHaveBeenCalledWith('user-1')
    expect(useFriendsStore.getState().friends).toEqual([mockFriend2])
  })

  it('fetchReceivedRequests updates receivedRequests in store', async () => {
    vi.mocked(friendsApi.getReceivedRequests).mockResolvedValueOnce([mockRequest1])

    await useFriendsStore.getState().fetchReceivedRequests()

    expect(friendsApi.getReceivedRequests).toHaveBeenCalledTimes(1)
    expect(useFriendsStore.getState().receivedRequests).toEqual([mockRequest1])
    expect(useFriendsStore.getState().receivedRequestsCount).toBe(1)
  })

  it('fetchSentRequests updates sentRequests in store', async () => {
    vi.mocked(friendsApi.getSentRequests).mockResolvedValueOnce([mockRequest2])

    await useFriendsStore.getState().fetchSentRequests()

    expect(friendsApi.getSentRequests).toHaveBeenCalledTimes(1)
    expect(useFriendsStore.getState().sentRequests).toEqual([mockRequest2])
  })

  it('acceptRequest removes request from receivedRequests and adds user to friends', async () => {
    useFriendsStore.setState({
      receivedRequests: [mockRequest1],
      receivedRequestsCount: 1,
      friends: [],
    })
    vi.mocked(friendsApi.acceptRequest).mockResolvedValueOnce(mockRequest1)

    await useFriendsStore.getState().acceptRequest('req-1')

    expect(friendsApi.acceptRequest).toHaveBeenCalledWith('req-1')
    expect(useFriendsStore.getState().receivedRequests).toHaveLength(0)
    expect(useFriendsStore.getState().receivedRequestsCount).toBe(0)
    expect(useFriendsStore.getState().friends).toEqual([mockFriend1])
  })

  it('rejectRequest removes request from receivedRequests', async () => {
    useFriendsStore.setState({
      receivedRequests: [mockRequest1],
      receivedRequestsCount: 1,
    })
    vi.mocked(friendsApi.rejectRequest).mockResolvedValueOnce({ message: 'Rejected' })

    await useFriendsStore.getState().rejectRequest('req-1')

    expect(friendsApi.rejectRequest).toHaveBeenCalledWith('req-1')
    expect(useFriendsStore.getState().receivedRequests).toHaveLength(0)
    expect(useFriendsStore.getState().receivedRequestsCount).toBe(0)
  })

  it('cancelRequest removes request from sentRequests', async () => {
    useFriendsStore.setState({
      sentRequests: [mockRequest2],
    })
    vi.mocked(friendsApi.cancelRequest).mockResolvedValueOnce({ message: 'Cancelled' })

    await useFriendsStore.getState().cancelRequest('req-2')

    expect(friendsApi.cancelRequest).toHaveBeenCalledWith('req-2')
    expect(useFriendsStore.getState().sentRequests).toHaveLength(0)
  })

  it('handleRequestReceived adds new received request and increments count', () => {
    useFriendsStore.getState().handleRequestReceived(mockRequest1)
    expect(useFriendsStore.getState().receivedRequests).toHaveLength(1)
    expect(useFriendsStore.getState().receivedRequestsCount).toBe(1)

    // Duplicate check
    useFriendsStore.getState().handleRequestReceived(mockRequest1)
    expect(useFriendsStore.getState().receivedRequests).toHaveLength(1)
  })

  it('handleRequestCancelled removes received request and decrements count', () => {
    useFriendsStore.setState({
      receivedRequests: [mockRequest1],
      receivedRequestsCount: 1,
    })
    useFriendsStore.getState().handleRequestCancelled('req-1')
    expect(useFriendsStore.getState().receivedRequests).toHaveLength(0)
    expect(useFriendsStore.getState().receivedRequestsCount).toBe(0)
  })

  it('handleRequestRejected removes sent request', () => {
    useFriendsStore.setState({
      sentRequests: [mockRequest2],
    })
    useFriendsStore.getState().handleRequestRejected('req-2')
    expect(useFriendsStore.getState().sentRequests).toHaveLength(0)
  })

  it('handleFriendAdded prepends new friend if not already present', () => {
    useFriendsStore.setState({ friends: [mockFriend1] })

    useFriendsStore.getState().handleFriendAdded(mockFriend2)
    expect(useFriendsStore.getState().friends).toHaveLength(2)
    expect(useFriendsStore.getState().friends[0]).toEqual(mockFriend2)

    // Duplicate check
    useFriendsStore.getState().handleFriendAdded(mockFriend2)
    expect(useFriendsStore.getState().friends).toHaveLength(2)
  })

  it('handleFriendRemoved removes friend by ID', () => {
    useFriendsStore.setState({ friends: [mockFriend1, mockFriend2] })

    useFriendsStore.getState().handleFriendRemoved('user-2')
    expect(useFriendsStore.getState().friends).toEqual([mockFriend1])
  })

  it('searchUsers queries API and updates searchResults', async () => {
    vi.mocked(friendsApi.searchUsers).mockResolvedValueOnce([mockFriend1])

    await useFriendsStore.getState().searchUsers('nguyen')

    expect(friendsApi.searchUsers).toHaveBeenCalledWith('nguyen')
    expect(useFriendsStore.getState().searchResults).toEqual([mockFriend1])
    expect(useFriendsStore.getState().isSearchingUsers).toBe(false)
  })

  it('searchUsers clears results when query is empty', async () => {
    useFriendsStore.setState({ searchResults: [mockFriend1] })

    await useFriendsStore.getState().searchUsers('   ')

    expect(friendsApi.searchUsers).not.toHaveBeenCalled()
    expect(useFriendsStore.getState().searchResults).toEqual([])
  })

  it('sendFriendRequest calls API and prepends request to sentRequests', async () => {
    useFriendsStore.setState({ sentRequests: [] })
    vi.mocked(friendsApi.sendFriendRequest).mockResolvedValueOnce(mockRequest2)

    await useFriendsStore.getState().sendFriendRequest('user-2')

    expect(friendsApi.sendFriendRequest).toHaveBeenCalledWith('user-2')
    expect(useFriendsStore.getState().sentRequests).toEqual([mockRequest2])
  })

  it('handlePresenceUpdate updates isOnline and lastSeen of the targeted friend', () => {
    useFriendsStore.setState({ friends: [mockFriend1, mockFriend2] })

    useFriendsStore.getState().handlePresenceUpdate('user-2', true)
    const updated = useFriendsStore.getState().friends.find((f) => f.id === 'user-2')
    expect(updated?.isOnline).toBe(true)
  })

  it('fetchBlockedUsers loads and sets blocked users', async () => {
    const mockBlocked = [
      { id: 'b-1', username: 'blocked1', displayName: 'Blocked 1', avatarUrl: null },
    ]
    vi.mocked(friendsApi.getBlockedUsers).mockResolvedValueOnce(mockBlocked)

    await useFriendsStore.getState().fetchBlockedUsers()

    expect(friendsApi.getBlockedUsers).toHaveBeenCalled()
    expect(useFriendsStore.getState().blockedUsers).toEqual(mockBlocked)
    expect(useFriendsStore.getState().isLoadingBlocked).toBe(false)
  })

  it('blockUser calls API, removes user from friends, and refreshes blocked list', async () => {
    useFriendsStore.setState({
      friends: [mockFriend1, mockFriend2],
      totalFriends: 2,
      blockedUsers: [],
    })
    vi.mocked(friendsApi.blockUser).mockResolvedValueOnce({ message: 'Blocked' })
    vi.mocked(friendsApi.getBlockedUsers).mockResolvedValueOnce([
      { id: mockFriend1.id, username: mockFriend1.username, displayName: mockFriend1.displayName, avatarUrl: null },
    ])

    await useFriendsStore.getState().blockUser(mockFriend1.id)

    expect(friendsApi.blockUser).toHaveBeenCalledWith(mockFriend1.id)
    expect(useFriendsStore.getState().friends).toEqual([mockFriend2])
    expect(useFriendsStore.getState().totalFriends).toBe(1)
    expect(useFriendsStore.getState().blockedUsers).toHaveLength(1)
  })

  it('unblockUser calls API and removes user from blockedUsers', async () => {
    useFriendsStore.setState({
      blockedUsers: [
        { id: 'b-1', username: 'blocked1', displayName: 'Blocked 1', avatarUrl: null },
      ],
    })
    vi.mocked(friendsApi.unblockUser).mockResolvedValueOnce({ message: 'Unblocked' })

    await useFriendsStore.getState().unblockUser('b-1')

    expect(friendsApi.unblockUser).toHaveBeenCalledWith('b-1')
    expect(useFriendsStore.getState().blockedUsers).toHaveLength(0)
  })
})

