import { useMemo } from 'react'
import { Search, X, Compass, UserSearch } from 'lucide-react'
import { UserSearchCard } from './UserSearchCard'
import type { FriendUser, FriendRequest } from '../types/friends.types'

export interface FindFriendsTabProps {
  searchQuery: string
  searchResults: FriendUser[]
  friends: FriendUser[]
  sentRequests: FriendRequest[]
  receivedRequests: FriendRequest[]
  isSearching: boolean
  isActionInProgress?: Record<string, boolean>
  onSearchChange: (query: string) => void
  onSendRequest: (userId: string) => Promise<void>
  onCancelRequest?: (requestId: string) => Promise<void>
  onAcceptRequest?: (requestId: string) => Promise<void>
  onRejectRequest?: (requestId: string) => Promise<void>
}

/**
 * FindFriendsTab: Tab tìm kiếm & kết bạn mới (/friends?tab=find)
 * - Ô tìm kiếm ghim cố định ở trên cùng (shrink-0), chỉ vùng kết quả tìm kiếm cuộn (flex-1 min-h-0 overflow-y-auto)
 * - Tự động nhận diện quan hệ với từng kết quả tìm kiếm (Bạn bè, Đã gửi lời mời, Nhận lời mời, Chưa kết bạn)
 */
export function FindFriendsTab({
  searchQuery,
  searchResults,
  friends,
  sentRequests,
  receivedRequests,
  isSearching,
  isActionInProgress = {},
  onSearchChange,
  onSendRequest,
  onCancelRequest,
  onAcceptRequest,
  onRejectRequest,
}: FindFriendsTabProps) {
  // Bản đồ ID để tra cứu nhanh quan hệ
  const friendsMap = useMemo(() => new Set(friends.map((f) => f.id)), [friends])

  const sentRequestsMap = useMemo(() => {
    const map = new Map<string, string>() // targetUserId -> requestId
    for (const req of sentRequests) {
      if (req.addressee?.id) {
        map.set(req.addressee.id, req.id)
      }
    }
    return map
  }, [sentRequests])

  const receivedRequestsMap = useMemo(() => {
    const map = new Map<string, string>() // senderUserId -> requestId
    for (const req of receivedRequests) {
      if (req.requester?.id) {
        map.set(req.requester.id, req.id)
      }
    }
    return map
  }, [receivedRequests])

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden" data-testid="find-friends-tab">
      {/* Thanh tìm kiếm - GHIM CỐ ĐỊNH Ở TRÊN (shrink-0) */}
      <div className="shrink-0 pb-4 border-b border-border/60 dark:border-border-dark/60">
        <div className="relative max-w-xl w-full">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ink-muted">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Tìm theo username hoặc tên hiển thị..."
            aria-label="Tìm kiếm người dùng"
            className="w-full pl-10 pr-9 py-2.5 bg-white dark:bg-[#17212B] border border-border/80 dark:border-border-dark rounded-xl text-xs sm:text-sm text-ink-primary dark:text-ink-primary-dark placeholder:text-ink-muted focus:outline-hidden focus:border-brand/40 dark:focus:border-brand-accent/40 shadow-2xs transition-colors"
            data-testid="find-users-input"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Xóa từ khóa"
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-ink-muted hover:text-ink-primary dark:hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* VÙNG DUY NHẤT CUỘN NỘI DUNG: flex-1 min-h-0 overflow-y-auto */}
      <div
        className="flex-1 min-h-0 overflow-y-auto pt-4 pr-1 scrollbar-thin"
        data-testid="find-friends-scroll-container"
      >
        {isSearching ? (
          /* Skeleton Loading Cards */
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            data-testid="find-users-loading-skeleton"
          >
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={idx}
                className="bg-white/60 dark:bg-[#17212B]/60 border border-border/50 dark:border-border-dark/50 rounded-2xl p-4 animate-pulse flex flex-col justify-between h-44"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-border/60 dark:bg-border-dark" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-border/60 dark:bg-border-dark rounded w-3/4" />
                    <div className="h-3 bg-border/40 dark:bg-border-dark/70 rounded w-1/2" />
                  </div>
                </div>
                <div className="h-8 bg-border/40 dark:bg-border-dark/60 rounded-xl w-full mt-4" />
              </div>
            ))}
          </div>
        ) : searchQuery.trim().length === 0 ? (
          /* Trạng thái chưa nhập từ khóa tìm kiếm */
          <div
            className="flex flex-col items-center justify-center p-8 text-center my-auto min-h-[300px]"
            data-testid="find-prompt-state"
          >
            <div className="w-16 h-16 rounded-full bg-brand-soft dark:bg-brand/10 flex items-center justify-center text-brand dark:text-brand-accent mb-4">
              <Compass className="w-8 h-8" />
            </div>
            <h4 className="text-base font-semibold text-ink-primary dark:text-white mb-1">
              Khám phá & Kết bạn trên ReChat
            </h4>
            <p className="text-xs text-ink-secondary dark:text-ink-secondary-dark max-w-sm mb-4 leading-relaxed">
              Nhập tên hiển thị hoặc username (ví dụ: &ldquo;nguyenvana&rdquo;) vào thanh tìm kiếm ở trên để bắt đầu tìm kiếm bạn bè.
            </p>
          </div>
        ) : searchResults.length > 0 ? (
          /* Danh sách kết quả tìm kiếm */
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            data-testid="find-users-grid"
          >
            {searchResults.map((user) => {
              let status: 'FRIEND' | 'SENT_REQUEST' | 'RECEIVED_REQUEST' | 'NONE' = 'NONE'
              let reqId: string | undefined

              if (friendsMap.has(user.id)) {
                status = 'FRIEND'
              } else if (sentRequestsMap.has(user.id)) {
                status = 'SENT_REQUEST'
                reqId = sentRequestsMap.get(user.id)
              } else if (receivedRequestsMap.has(user.id)) {
                status = 'RECEIVED_REQUEST'
                reqId = receivedRequestsMap.get(user.id)
              }

              return (
                <UserSearchCard
                  key={user.id}
                  user={user}
                  relationStatus={status}
                  requestId={reqId}
                  isProcessing={reqId ? Boolean(isActionInProgress[reqId]) : false}
                  onSendRequest={onSendRequest}
                  onCancelRequest={onCancelRequest}
                  onAcceptRequest={onAcceptRequest}
                  onRejectRequest={onRejectRequest}
                />
              )
            })}
          </div>
        ) : (
          /* Trạng thái không tìm thấy kết quả */
          <div
            className="flex flex-col items-center justify-center p-8 text-center my-auto min-h-[300px]"
            data-testid="find-users-no-results"
          >
            <div className="w-14 h-14 rounded-full bg-surface-hover dark:bg-[#1C2733] flex items-center justify-center text-ink-muted mb-3">
              <UserSearch className="w-7 h-7" />
            </div>
            <h4 className="text-base font-semibold text-ink-primary dark:text-white mb-1">
              Không tìm thấy người dùng
            </h4>
            <p className="text-xs text-ink-secondary dark:text-ink-secondary-dark max-w-xs">
              Không có người dùng nào khớp với từ khóa &ldquo;{searchQuery}&rdquo;. Hãy thử kiểm tra lại chính tả hoặc tìm theo username khác.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
