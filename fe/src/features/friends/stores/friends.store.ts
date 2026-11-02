import { create } from 'zustand'
import { friendsApi } from '../services/friends.api'
import type { FriendUser, FriendRequest, BlockedUser } from '../types/friends.types'

export interface FriendsState {
  // Tab 1: Bạn bè
  friends: FriendUser[]
  isLoadingFriends: boolean
  isLoadingMore: boolean
  page: number
  hasMore: boolean
  totalFriends: number
  searchQuery: string
  activeFilter: 'all' | 'online'
  receivedRequestsCount: number

  // Tab 2: Lời mời kết bạn
  receivedRequests: FriendRequest[]
  sentRequests: FriendRequest[]
  isLoadingRequests: boolean
  requestsSubTab: 'received' | 'sent'
  isActionInProgress: Record<string, boolean>

  // Tab 3: Người dùng đã chặn
  blockedUsers: BlockedUser[]
  isLoadingBlocked: boolean

  // Tab 4: Tìm bạn mới
  findSearchQuery: string
  searchResults: FriendUser[]
  isSearchingUsers: boolean

  // Actions - Tab 1
  setSearchQuery: (query: string) => void
  setActiveFilter: (filter: 'all' | 'online') => void
  setFriends: (friends: FriendUser[]) => void
  fetchFriends: () => Promise<void>
  loadMoreFriends: () => Promise<void>
  fetchReceivedRequestsCount: () => Promise<void>
  unfriend: (friendId: string) => Promise<void>

  // Actions - Tab 2
  setRequestsSubTab: (subTab: 'received' | 'sent') => void
  fetchReceivedRequests: () => Promise<void>
  fetchSentRequests: () => Promise<void>
  acceptRequest: (requestId: string) => Promise<void>
  rejectRequest: (requestId: string) => Promise<void>
  cancelRequest: (requestId: string) => Promise<void>

  // Actions - Tab 3
  fetchBlockedUsers: () => Promise<void>
  blockUser: (friendId: string) => Promise<void>
  unblockUser: (friendId: string) => Promise<void>

  // Actions - Tab 4
  setFindSearchQuery: (query: string) => void
  searchUsers: (query: string) => Promise<void>
  sendFriendRequest: (userId: string) => Promise<void>

  // Realtime Socket Sync
  handleFriendAdded: (friend: FriendUser) => void
  handleFriendRemoved: (friendId: string) => void
  handlePresenceUpdate: (userId: string, isOnline: boolean, lastSeen?: string | null) => void
  handleRequestReceived: (request: FriendRequest) => void
  handleRequestCancelled: (requestId: string) => void
  handleRequestRejected: (requestId: string) => void
}

export const useFriendsStore = create<FriendsState>((set, get) => ({
  friends: [],
  isLoadingFriends: false,
  isLoadingMore: false,
  page: 1,
  hasMore: false,
  totalFriends: 0,
  searchQuery: '',
  activeFilter: 'all',
  receivedRequestsCount: 0,

  // Tab 2: Lời mời kết bạn
  receivedRequests: [],
  sentRequests: [],
  isLoadingRequests: false,
  requestsSubTab: 'received',
  isActionInProgress: {},

  // Tab 3: Người dùng đã chặn
  blockedUsers: [],
  isLoadingBlocked: false,

  // Tab 4: Tìm bạn mới
  findSearchQuery: '',
  searchResults: [],
  isSearchingUsers: false,

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setActiveFilter: (activeFilter) => set({ activeFilter }),
  setFriends: (friends) => set({ friends }),
  setRequestsSubTab: (requestsSubTab) => set({ requestsSubTab }),
  setFindSearchQuery: (findSearchQuery) => set({ findSearchQuery }),

  fetchFriends: async () => {
    set({ isLoadingFriends: true })
    try {
      const res = await friendsApi.getFriendsPaginated({ page: 1, limit: 20 })
      set({
        friends: res.data || [],
        page: 1,
        hasMore: res.meta?.hasNextPage ?? false,
        totalFriends: res.meta?.total ?? (res.data?.length || 0),
      })
    } catch (err) {
      console.error('Failed to fetch friends:', err)
      set({ friends: [], hasMore: false, totalFriends: 0 })
    } finally {
      set({ isLoadingFriends: false })
    }
  },

  loadMoreFriends: async () => {
    const { page, hasMore, isLoadingMore, isLoadingFriends, friends } = get()
    if (!hasMore || isLoadingMore || isLoadingFriends) return

    set({ isLoadingMore: true })
    try {
      const nextPage = page + 1
      const res = await friendsApi.getFriendsPaginated({ page: nextPage, limit: 20 })
      const newItems = res.data || []

      // Deduplicate against existing list
      const existingIds = new Set(friends.map((f) => f.id))
      const uniqueNewItems = newItems.filter((f) => !existingIds.has(f.id))

      set({
        friends: [...friends, ...uniqueNewItems],
        page: nextPage,
        hasMore: res.meta?.hasNextPage ?? false,
        totalFriends: res.meta?.total ?? friends.length + uniqueNewItems.length,
      })
    } catch (err) {
      console.error('Failed to load more friends:', err)
    } finally {
      set({ isLoadingMore: false })
    }
  },

  fetchReceivedRequestsCount: async () => {
    try {
      const requests = await friendsApi.getReceivedRequests()
      set({
        receivedRequests: requests,
        receivedRequestsCount: requests.length,
      })
    } catch {
      // Bỏ qua lỗi ngầm khi đếm lời mời
    }
  },

  fetchReceivedRequests: async () => {
    set({ isLoadingRequests: true })
    try {
      const requests = await friendsApi.getReceivedRequests()
      set({
        receivedRequests: requests,
        receivedRequestsCount: requests.length,
      })
    } catch (err) {
      console.error('Failed to fetch received requests:', err)
      set({ receivedRequests: [] })
    } finally {
      set({ isLoadingRequests: false })
    }
  },

  fetchSentRequests: async () => {
    set({ isLoadingRequests: true })
    try {
      const requests = await friendsApi.getSentRequests()
      set({ sentRequests: requests })
    } catch (err) {
      console.error('Failed to fetch sent requests:', err)
      set({ sentRequests: [] })
    } finally {
      set({ isLoadingRequests: false })
    }
  },

  acceptRequest: async (requestId: string) => {
    set((state) => ({
      isActionInProgress: { ...state.isActionInProgress, [requestId]: true },
    }))
    try {
      await friendsApi.acceptRequest(requestId)
      const targetReq = get().receivedRequests.find((r) => r.id === requestId)
      set((state) => ({
        receivedRequests: state.receivedRequests.filter((r) => r.id !== requestId),
        receivedRequestsCount: Math.max(0, state.receivedRequestsCount - 1),
      }))
      if (targetReq?.requester) {
        get().handleFriendAdded(targetReq.requester)
      } else {
        await get().fetchFriends()
      }
    } finally {
      set((state) => {
        const next = { ...state.isActionInProgress }
        delete next[requestId]
        return { isActionInProgress: next }
      })
    }
  },

  rejectRequest: async (requestId: string) => {
    set((state) => ({
      isActionInProgress: { ...state.isActionInProgress, [requestId]: true },
    }))
    try {
      await friendsApi.rejectRequest(requestId)
      set((state) => ({
        receivedRequests: state.receivedRequests.filter((r) => r.id !== requestId),
        receivedRequestsCount: Math.max(0, state.receivedRequestsCount - 1),
      }))
    } finally {
      set((state) => {
        const next = { ...state.isActionInProgress }
        delete next[requestId]
        return { isActionInProgress: next }
      })
    }
  },

  cancelRequest: async (requestId: string) => {
    set((state) => ({
      isActionInProgress: { ...state.isActionInProgress, [requestId]: true },
    }))
    try {
      await friendsApi.cancelRequest(requestId)
      set((state) => ({
        sentRequests: state.sentRequests.filter((r) => r.id !== requestId),
      }))
    } finally {
      set((state) => {
        const next = { ...state.isActionInProgress }
        delete next[requestId]
        return { isActionInProgress: next }
      })
    }
  },

  fetchBlockedUsers: async () => {
    set({ isLoadingBlocked: true })
    try {
      const list = await friendsApi.getBlockedUsers()
      set({ blockedUsers: list || [] })
    } catch (err) {
      console.error('Failed to fetch blocked users:', err)
      set({ blockedUsers: [] })
    } finally {
      set({ isLoadingBlocked: false })
    }
  },

  blockUser: async (friendId: string) => {
    await friendsApi.blockUser(friendId)
    // Xóa khỏi danh sách bạn bè nếu có
    set((state) => ({
      friends: state.friends.filter((f) => f.id !== friendId),
      totalFriends: Math.max(0, state.totalFriends - 1),
    }))
    // Refresh danh sách người dùng đã chặn
    await get().fetchBlockedUsers()
  },

  unblockUser: async (friendId: string) => {
    await friendsApi.unblockUser(friendId)
    set((state) => ({
      blockedUsers: state.blockedUsers.filter((u) => u.id !== friendId),
    }))
  },

  searchUsers: async (query: string) => {
    const trimmed = query.trim()
    set({ findSearchQuery: query })
    if (!trimmed) {
      set({ searchResults: [], isSearchingUsers: false })
      return
    }

    set({ isSearchingUsers: true })
    try {
      const results = await friendsApi.searchUsers(trimmed)
      set({ searchResults: results })
    } catch (err) {
      console.error('Failed to search users:', err)
      set({ searchResults: [] })
    } finally {
      set({ isSearchingUsers: false })
    }
  },

  sendFriendRequest: async (userId: string) => {
    set((state) => ({
      isActionInProgress: { ...state.isActionInProgress, [userId]: true },
    }))
    try {
      const newRequest = await friendsApi.sendFriendRequest(userId)
      set((state) => ({
        sentRequests: [newRequest, ...state.sentRequests],
      }))
    } finally {
      set((state) => {
        const next = { ...state.isActionInProgress }
        delete next[userId]
        return { isActionInProgress: next }
      })
    }
  },

  unfriend: async (friendId: string) => {
    await friendsApi.unfriend(friendId)
    set((state) => ({
      friends: state.friends.filter((f) => f.id !== friendId),
      totalFriends: Math.max(0, state.totalFriends - 1),
    }))
  },

  handleFriendAdded: (friend: FriendUser) => {
    set((state) => {
      if (state.friends.some((f) => f.id === friend.id)) {
        return state
      }
      return {
        friends: [friend, ...state.friends],
        totalFriends: state.totalFriends + 1,
      }
    })
  },

  handleFriendRemoved: (friendId: string) => {
    set((state) => ({
      friends: state.friends.filter((f) => f.id !== friendId),
      totalFriends: Math.max(0, state.totalFriends - 1),
    }))
  },

  handlePresenceUpdate: (userId: string, isOnline: boolean, lastSeen?: string | null) => {
    set((state) => ({
      friends: state.friends.map((f) => {
        if (f.id === userId) {
          return { ...f, isOnline, lastSeen: lastSeen ?? f.lastSeen }
        }
        return f
      }),
    }))
  },

  handleRequestReceived: (request: FriendRequest) => {
    set((state) => {
      if (state.receivedRequests.some((r) => r.id === request.id)) {
        return state
      }
      return {
        receivedRequests: [request, ...state.receivedRequests],
        receivedRequestsCount: state.receivedRequestsCount + 1,
      }
    })
  },

  handleRequestCancelled: (requestId: string) => {
    set((state) => ({
      receivedRequests: state.receivedRequests.filter((r) => r.id !== requestId),
      receivedRequestsCount: Math.max(0, state.receivedRequestsCount - 1),
    }))
  },

  handleRequestRejected: (requestId: string) => {
    set((state) => ({
      sentRequests: state.sentRequests.filter((r) => r.id !== requestId),
    }))
  },
}))
