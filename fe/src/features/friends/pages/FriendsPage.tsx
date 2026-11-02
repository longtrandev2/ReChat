import { useState, useEffect } from 'react'
import { Users, UserPlus, ShieldAlert, UserSearch } from 'lucide-react'
import { useFriendsStore } from '../stores/friends.store'
import { FriendsListTab } from '../components/FriendsListTab'
import { FriendRequestsTab } from '../components/FriendRequestsTab'
import { FindFriendsTab } from '../components/FindFriendsTab'
import { BlockedUsersTab } from '../components/BlockedUsersTab'
import { useSocket } from '@/hooks/useSocket'
import type { FriendsTab, FriendUser } from '../types/friends.types'

/**
 * FriendsPage: Trung tâm quản lý bạn bè ReChat (/friends)
 * - Hệ thống 4 Tabs: Tất cả bạn bè, Lời mời kết bạn, Người dùng đã chặn, Tìm kiếm bạn mới
 * - Đồng bộ danh sách và presence qua WebSocket realtime
 */
export function FriendsPage() {
  const [activeTab, setActiveTab] = useState<FriendsTab>('all')
  const {
    friends,
    isLoadingFriends,
    isLoadingMore,
    hasMore,
    totalFriends,
    searchQuery,
    activeFilter,
    receivedRequestsCount,
    receivedRequests,
    sentRequests,
    isLoadingRequests,
    requestsSubTab,
    isActionInProgress,
    blockedUsers,
    isLoadingBlocked,
    findSearchQuery,
    searchResults,
    isSearchingUsers,
    setSearchQuery,
    setActiveFilter,
    setRequestsSubTab,
    fetchFriends,
    loadMoreFriends,
    fetchReceivedRequestsCount,
    fetchReceivedRequests,
    fetchSentRequests,
    fetchBlockedUsers,
    acceptRequest,
    rejectRequest,
    cancelRequest,
    blockUser,
    unblockUser,
    searchUsers,
    sendFriendRequest,
    unfriend,
    handleFriendAdded,
    handleFriendRemoved,
    handlePresenceUpdate,
    handleRequestReceived,
    handleRequestCancelled,
    handleRequestRejected,
  } = useFriendsStore()

  const { socket } = useSocket()

  // Tải danh sách bạn bè & số lượng lời mời khi vào trang
  useEffect(() => {
    fetchFriends()
    fetchReceivedRequestsCount()
    fetchReceivedRequests()
    fetchSentRequests()
    fetchBlockedUsers()
  }, [fetchFriends, fetchReceivedRequestsCount, fetchReceivedRequests, fetchSentRequests, fetchBlockedUsers])

  // Lắng nghe các sự kiện socket liên quan đến quan hệ bạn bè & lời mời kết bạn
  useEffect(() => {
    if (!socket) return

    const onFriendAccepted = (data: { friend?: FriendUser }) => {
      if (data?.friend) {
        handleFriendAdded(data.friend)
      } else {
        fetchFriends()
      }
      fetchReceivedRequestsCount()
    }

    const onFriendRemoved = (data: { friendId: string }) => {
      if (data?.friendId) {
        handleFriendRemoved(data.friendId)
      }
    }

    const onPresence = (data: { userId: string; isOnline: boolean; lastSeen?: string | null }) => {
      if (data?.userId !== undefined && data?.isOnline !== undefined) {
        handlePresenceUpdate(data.userId, data.isOnline, data.lastSeen)
      }
    }

    const onRequestReceived = (data: {
      requestId: string
      requester: FriendUser
      createdAt?: string
    }) => {
      if (data?.requestId && data?.requester) {
        handleRequestReceived({
          id: data.requestId,
          status: 'PENDING',
          createdAt: data.createdAt ?? new Date().toISOString(),
          requester: data.requester,
        })
      }
    }

    const onRequestCancelled = (data: { requestId: string }) => {
      if (data?.requestId) {
        handleRequestCancelled(data.requestId)
      }
    }

    const onRequestRejected = (data: { requestId: string }) => {
      if (data?.requestId) {
        handleRequestRejected(data.requestId)
      }
    }

    socket.on('friendRequestAccepted', onFriendAccepted)
    socket.on('friendRemoved', onFriendRemoved)
    socket.on('userPresence', onPresence)
    socket.on('friendRequestReceived', onRequestReceived)
    socket.on('friendRequestCancelled', onRequestCancelled)
    socket.on('friendRequestRejected', onRequestRejected)

    return () => {
      socket.off('friendRequestAccepted', onFriendAccepted)
      socket.off('friendRemoved', onFriendRemoved)
      socket.off('userPresence', onPresence)
      socket.off('friendRequestReceived', onRequestReceived)
      socket.off('friendRequestCancelled', onRequestCancelled)
      socket.off('friendRequestRejected', onRequestRejected)
    }
  }, [
    socket,
    fetchFriends,
    fetchReceivedRequestsCount,
    handleFriendAdded,
    handleFriendRemoved,
    handlePresenceUpdate,
    handleRequestReceived,
    handleRequestCancelled,
    handleRequestRejected,
  ])

  const tabs: Array<{ id: FriendsTab; label: string; icon: typeof Users; badge?: number }> = [
    { id: 'all', label: 'Tất cả bạn bè', icon: Users, badge: totalFriends > 0 ? totalFriends : friends.length },
    { id: 'requests', label: 'Lời mời kết bạn', icon: UserPlus, badge: receivedRequestsCount },
    { id: 'blocked', label: 'Đã chặn', icon: ShieldAlert, badge: blockedUsers.length },
    { id: 'find', label: 'Tìm bạn mới', icon: UserSearch },
  ]

  return (
    <div
      className="flex-1 flex flex-col h-full bg-gradient-to-b from-[#E8EFF6]/30 via-canvas-light to-[#E1EAF2]/30 dark:from-[#111B27]/40 dark:via-[#0E1621] dark:to-[#0A1017] overflow-hidden select-none"
      data-testid="friends-page"
    >
      <div className="flex-1 flex flex-col min-h-0 max-w-7xl mx-auto w-full p-4 sm:p-6 md:p-8 overflow-hidden">
        {/* Header trang và hệ thống Tabs chuyển đổi - GHIM CỐ ĐỊNH Ở TRÊN (shrink-0) */}
        <header className="shrink-0 pb-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-ink-primary dark:text-ink-primary-dark tracking-tight">
                Danh bạ & Bạn bè
              </h1>
              <p className="text-xs sm:text-sm text-ink-secondary dark:text-ink-secondary-dark mt-1">
                Quản lý kết nối, tìm kiếm người dùng và kết nối trò chuyện trên ReChat
              </p>
            </div>
          </div>

          {/* Tab Navigation Navigation Pills */}
          <div
            className="flex items-center gap-1.5 p-1 bg-surface-light-2 dark:bg-[#17212B] rounded-2xl border border-border/60 dark:border-border-dark overflow-x-auto scrollbar-none"
            role="tablist"
          >
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-white dark:bg-[#242F3D] text-brand dark:text-brand-accent shadow-xs font-semibold'
                      : 'text-ink-secondary dark:text-ink-secondary-dark hover:text-ink-primary dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                  data-testid={`tab-${tab.id}`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[11px] font-semibold ${
                        isActive
                          ? 'bg-brand/10 dark:bg-brand/20 text-brand dark:text-brand-accent'
                          : 'bg-black/5 dark:bg-white/10 text-ink-muted'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </header>

        {/* Nội dung tương ứng theo Tab đang chọn - min-h-0 overflow-hidden */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {activeTab === 'all' && (
            <FriendsListTab
              friends={friends}
              isLoading={isLoadingFriends}
              isLoadingMore={isLoadingMore}
              hasMore={hasMore}
              totalFriends={totalFriends}
              searchQuery={searchQuery}
              activeFilter={activeFilter}
              onSearchChange={setSearchQuery}
              onFilterChange={setActiveFilter}
              onLoadMore={loadMoreFriends}
              onUnfriend={unfriend}
              onBlock={blockUser}
              onSwitchToFindTab={() => setActiveTab('find')}
            />
          )}

          {activeTab === 'requests' && (
            <FriendRequestsTab
              receivedRequests={receivedRequests}
              sentRequests={sentRequests}
              subTab={requestsSubTab}
              isLoading={isLoadingRequests}
              isActionInProgress={isActionInProgress}
              onSubTabChange={(tab) => {
                setRequestsSubTab(tab)
                if (tab === 'sent') {
                  fetchSentRequests()
                } else {
                  fetchReceivedRequests()
                }
              }}
              onAccept={acceptRequest}
              onReject={rejectRequest}
              onCancel={cancelRequest}
              onSwitchToFindTab={() => setActiveTab('find')}
            />
          )}

          {activeTab === 'blocked' && (
            <BlockedUsersTab
              blockedUsers={blockedUsers}
              isLoading={isLoadingBlocked}
              onUnblock={unblockUser}
            />
          )}

          {activeTab === 'find' && (
            <FindFriendsTab
              searchQuery={findSearchQuery}
              searchResults={searchResults}
              friends={friends}
              sentRequests={sentRequests}
              receivedRequests={receivedRequests}
              isSearching={isSearchingUsers}
              isActionInProgress={isActionInProgress}
              onSearchChange={searchUsers}
              onSendRequest={sendFriendRequest}
              onCancelRequest={cancelRequest}
              onAcceptRequest={acceptRequest}
              onRejectRequest={rejectRequest}
            />
          )}
        </div>
      </div>
    </div>
  )
}
