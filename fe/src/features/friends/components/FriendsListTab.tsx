import { useMemo, useEffect, useRef } from 'react'
import { Search, X, Users, UserPlus, Loader2 } from 'lucide-react'
import { FriendCard } from './FriendCard'
import { Button } from '@/components/ui/button'
import { useSocket } from '@/hooks/useSocket'
import type { FriendUser } from '../types/friends.types'

export interface FriendsListTabProps {
  friends: FriendUser[]
  isLoading: boolean
  isLoadingMore?: boolean
  hasMore?: boolean
  totalFriends?: number
  searchQuery: string
  activeFilter: 'all' | 'online'
  onSearchChange: (query: string) => void
  onFilterChange: (filter: 'all' | 'online') => void
  onLoadMore?: () => void
  onUnfriend: (friendId: string) => Promise<void>
  onBlock?: (friendId: string) => Promise<void>
  onSwitchToFindTab?: () => void
}

/**
 * FriendsListTab: Tab hiển thị danh sách tất cả bạn bè chuẩn Telegram & Messenger
 * - Ghim cố định Header và Bộ lọc trên cùng (shrink-0), chỉ cho phép vùng thẻ bạn bè cuộn (flex-1 min-h-0 overflow-y-auto)
 * - Cuộn vô hạn (Infinite Scroll) tự động tải thêm trang tiếp theo khi tới cuối danh sách
 * - Lọc thời gian thực theo tên hiển thị và username
 * - Bộ lọc nhanh "Tất cả" vs "Đang hoạt động"
 * - Đồng bộ trạng thái trực tuyến qua socket presence
 */
export function FriendsListTab({
  friends,
  isLoading,
  isLoadingMore = false,
  hasMore = false,
  totalFriends,
  searchQuery,
  activeFilter,
  onSearchChange,
  onFilterChange,
  onLoadMore,
  onUnfriend,
  onBlock,
  onSwitchToFindTab,
}: FriendsListTabProps) {
  const { isUserOnline } = useSocket()
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Infinite Scroll: Kích hoạt khi sentinel xuất hiện ở gần cuối vùng cuộn
  useEffect(() => {
    if (!onLoadMore || !hasMore || isLoading || isLoadingMore) return

    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMore()
        }
      },
      { root: null, rootMargin: '250px', threshold: 0.1 }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [onLoadMore, hasMore, isLoading, isLoadingMore])

  // Danh sách bạn bè sau khi lọc theo search query và activeFilter (all vs online)
  const filteredFriends = useMemo(() => {
    return friends.filter((friend) => {
      // 1. Kiểm tra filter trực tuyến
      const online = typeof isUserOnline === 'function' ? isUserOnline(friend.id) : Boolean(friend.isOnline)
      if (activeFilter === 'online' && !online) {
        return false
      }

      // 2. Kiểm tra từ khóa tìm kiếm
      const trimmed = searchQuery.trim().toLowerCase()
      if (!trimmed) return true

      const nameMatch = friend.displayName.toLowerCase().includes(trimmed)
      const userMatch = friend.username.toLowerCase().includes(trimmed)
      return nameMatch || userMatch
    })
  }, [friends, searchQuery, activeFilter, isUserOnline])

  // Đếm số bạn bè đang trực tuyến
  const onlineCount = useMemo(() => {
    return friends.filter((f) =>
      typeof isUserOnline === 'function' ? isUserOnline(f.id) : Boolean(f.isOnline)
    ).length
  }, [friends, isUserOnline])

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden" data-testid="friends-list-tab">
      {/* Thanh điều khiển trên cùng: Tìm kiếm & Bộ lọc nhanh - GHIM CỐ ĐỊNH Ở TRÊN (shrink-0) */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/60 dark:border-border-dark/60">
        {/* Bộ lọc trạng thái */}
        <div className="flex items-center gap-1.5 p-1 bg-surface-light-2 dark:bg-[#17212B] rounded-xl border border-border/40 dark:border-border-dark self-start">
          <button
            type="button"
            onClick={() => onFilterChange('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-white dark:bg-[#242F3D] text-brand dark:text-brand-accent shadow-xs font-semibold'
                : 'text-ink-secondary dark:text-ink-secondary-dark hover:text-ink-primary dark:hover:text-white'
            }`}
            data-testid="filter-all-button"
          >
            Tất cả ({totalFriends && totalFriends > friends.length ? totalFriends : friends.length})
          </button>
          <button
            type="button"
            onClick={() => onFilterChange('online')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
              activeFilter === 'online'
                ? 'bg-white dark:bg-[#242F3D] text-brand dark:text-brand-accent shadow-xs font-semibold'
                : 'text-ink-secondary dark:text-ink-secondary-dark hover:text-ink-primary dark:hover:text-white'
            }`}
            data-testid="filter-online-button"
          >
            <span className="w-2 h-2 rounded-full bg-presence-online animate-pulse" />
            <span>Đang hoạt động ({onlineCount})</span>
          </button>
        </div>

        {/* Ô tìm kiếm bạn bè nhanh */}
        <div className="relative w-full sm:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink-muted">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Tìm kiếm bạn bè..."
            aria-label="Tìm kiếm bạn bè"
            className="w-full pl-9 pr-8 py-2 bg-white dark:bg-[#17212B] border border-border/80 dark:border-border-dark rounded-xl text-xs sm:text-sm text-ink-primary dark:text-ink-primary-dark placeholder:text-ink-muted focus:outline-hidden focus:border-brand/40 dark:focus:border-brand-accent/40 shadow-2xs transition-colors"
            data-testid="friends-search-input"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Xóa từ khóa"
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-ink-muted hover:text-ink-primary dark:hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* VÙNG DUY NHẤT CUỘN NỘI DUNG: flex-1 min-h-0 overflow-y-auto */}
      <div
        className="flex-1 min-h-0 overflow-y-auto pt-4 pr-1 scrollbar-thin"
        data-testid="friends-scroll-container"
      >
        {isLoading ? (
          /* Skeleton Loading Cards */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-testid="friends-loading-skeleton">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="bg-white/60 dark:bg-[#17212B]/60 border border-border/50 dark:border-border-dark/50 rounded-2xl p-4 animate-pulse flex flex-col justify-between h-40"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-border/60 dark:bg-border-dark" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-border/60 dark:bg-border-dark rounded w-3/4" />
                    <div className="h-3 bg-border/40 dark:bg-border-dark/70 rounded w-1/2" />
                  </div>
                </div>
                <div className="h-8 bg-border/40 dark:bg-border-dark/60 rounded-xl w-full" />
              </div>
            ))}
          </div>
        ) : filteredFriends.length > 0 ? (
          <>
            {/* Grid danh sách bạn bè */}
            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
              data-testid="friends-grid"
            >
              {filteredFriends.map((friend) => {
                const online =
                  typeof isUserOnline === 'function'
                    ? isUserOnline(friend.id)
                    : Boolean(friend.isOnline)

                return (
                  <FriendCard
                    key={friend.id}
                    friend={friend}
                    isOnline={online}
                    onUnfriend={onUnfriend}
                    onBlock={onBlock}
                  />
                )
              })}
            </div>

            {/* Sentinel kích hoạt Infinite Scroll */}
            {hasMore && (
              <div
                ref={sentinelRef}
                className="h-8 w-full pointer-events-none"
                data-testid="infinite-scroll-sentinel"
              />
            )}

            {/* Loading spinner khi đang kéo thêm trang mới */}
            {isLoadingMore && (
              <div
                className="flex items-center justify-center py-6 gap-2 text-ink-muted text-xs"
                data-testid="friends-loading-more"
              >
                <Loader2 className="w-4 h-4 animate-spin text-brand dark:text-brand-accent" />
                <span>Đang tải thêm bạn bè...</span>
              </div>
            )}

            {/* Thông báo đã hiển thị toàn bộ bạn bè khi không còn trang tiếp theo */}
            {!hasMore && friends.length >= 20 && !searchQuery && (
              <div
                className="text-center py-6 text-xs text-ink-muted dark:text-ink-muted-dark"
                data-testid="friends-all-loaded"
              >
                Đã hiển thị toàn bộ {totalFriends ?? friends.length} bạn bè
              </div>
            )}
          </>
        ) : (
          /* Empty States */
          <div
            className="flex flex-col items-center justify-center p-8 text-center my-auto min-h-[300px]"
            data-testid="friends-empty-state"
          >
            {searchQuery ? (
              <>
                <div className="w-14 h-14 rounded-full bg-surface-hover dark:bg-[#1C2733] flex items-center justify-center text-ink-muted mb-3">
                  <Search className="w-7 h-7" />
                </div>
                <h4 className="text-base font-semibold text-ink-primary dark:text-ink-primary-dark mb-1">
                  Không tìm thấy bạn bè
                </h4>
                <p className="text-xs text-ink-secondary dark:text-ink-secondary-dark max-w-xs mb-4">
                  Không có kết quả nào khớp với từ khóa &ldquo;{searchQuery}&rdquo;.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onSearchChange('')}
                  className="rounded-xl text-xs"
                >
                  Xóa bộ lọc
                </Button>
              </>
            ) : activeFilter === 'online' ? (
              <>
                <div className="w-14 h-14 rounded-full bg-surface-hover dark:bg-[#1C2733] flex items-center justify-center text-ink-muted mb-3">
                  <Users className="w-7 h-7" />
                </div>
                <h4 className="text-base font-semibold text-ink-primary dark:text-ink-primary-dark mb-1">
                  Không có bạn bè đang online
                </h4>
                <p className="text-xs text-ink-secondary dark:text-ink-secondary-dark max-w-xs mb-4">
                  Hiện tại không có người bạn nào đang trực tuyến.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onFilterChange('all')}
                  className="rounded-xl text-xs"
                >
                  Xem tất cả bạn bè
                </Button>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-brand-soft dark:bg-brand/10 flex items-center justify-center text-brand dark:text-brand-accent mb-4">
                  <Users className="w-8 h-8" />
                </div>
                <h4 className="text-base font-semibold text-ink-primary dark:text-ink-primary-dark mb-1">
                  Chưa có bạn bè nào
                </h4>
                <p className="text-xs text-ink-secondary dark:text-ink-secondary-dark max-w-sm mb-5 leading-relaxed">
                  Hãy kết nối và trò chuyện với mọi người trên ReChat để bắt đầu những cuộc trò chuyện thú vị!
                </p>
                {onSwitchToFindTab && (
                  <Button
                    type="button"
                    onClick={onSwitchToFindTab}
                    className="rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                    data-testid="find-friends-action-button"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Tìm kiếm bạn bè</span>
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
