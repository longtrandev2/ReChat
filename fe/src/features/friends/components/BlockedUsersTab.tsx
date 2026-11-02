import { useState, useMemo } from 'react'
import { ShieldCheck, Search, X } from 'lucide-react'
import { BlockedUserCard } from './BlockedUserCard'
import type { BlockedUser } from '../types/friends.types'

interface BlockedUsersTabProps {
  blockedUsers: BlockedUser[]
  isLoading: boolean
  onUnblock: (userId: string) => Promise<void>
}

/**
 * BlockedUsersTab: Quản lý danh sách người dùng đã chặn (FR-29)
 * - Vùng thanh tìm kiếm ghim cố định ở đầu trang (shrink-0)
 * - Vùng danh sách người dùng cuộn độc lập (flex-1 min-h-0 overflow-y-auto)
 * - Empty state trực quan và skeleton loading
 */
export function BlockedUsersTab({
  blockedUsers,
  isLoading,
  onUnblock,
}: BlockedUsersTabProps) {
  const [filterQuery, setFilterQuery] = useState('')

  // Lọc người dùng đã chặn theo từ khóa
  const filteredUsers = useMemo(() => {
    const q = filterQuery.trim().toLowerCase()
    if (!q) return blockedUsers
    return blockedUsers.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q)
    )
  }, [blockedUsers, filterQuery])

  return (
    <div
      className="flex-1 flex flex-col min-h-0 overflow-hidden"
      data-testid="blocked-users-tab"
    >
      {/* 1. Phần tiêu đề & Tìm kiếm nhanh ghim cố định ở đầu trang */}
      <div className="shrink-0 p-4 sm:p-6 border-b border-border/80 dark:border-border-dark bg-canvas dark:bg-canvas-dark">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 max-w-4xl mx-auto">
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-ink-primary dark:text-ink-primary-dark">
              Danh sách chặn ({blockedUsers.length})
            </h2>
            <p className="text-xs text-ink-secondary dark:text-ink-secondary-dark mt-0.5">
              Những người trong danh sách này không thể gửi tin nhắn hay xem trạng thái của bạn.
            </p>
          </div>

          {blockedUsers.length > 0 && (
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
              <input
                type="text"
                placeholder="Tìm trong danh sách chặn..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-white dark:bg-[#1C2733] border border-border dark:border-border-dark rounded-xl text-xs sm:text-sm text-ink-primary dark:text-white placeholder:text-ink-muted focus:outline-hidden focus:border-brand dark:focus:border-brand-accent transition-colors"
                data-testid="blocked-users-search-input"
              />
              {filterQuery && (
                <button
                  type="button"
                  onClick={() => setFilterQuery('')}
                  aria-label="Xóa từ khóa lọc"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-ink-muted hover:text-ink-primary dark:hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. Vùng cuộn độc lập cho danh sách người dùng */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          {isLoading && blockedUsers.length === 0 ? (
            <div
              className="grid grid-cols-1 md:grid-cols-2 gap-3"
              data-testid="blocked-users-skeleton"
            >
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="bg-surface dark:bg-[#17212B] border border-border/80 dark:border-border-dark rounded-2xl p-4 flex items-center justify-between gap-4 animate-pulse"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-black/5 dark:bg-white/5" />
                    <div className="space-y-2">
                      <div className="h-4 w-28 bg-black/5 dark:bg-white/5 rounded-md" />
                      <div className="h-3 w-16 bg-black/5 dark:bg-white/5 rounded-md" />
                    </div>
                  </div>
                  <div className="h-8 w-20 bg-black/5 dark:bg-white/5 rounded-xl" />
                </div>
              ))}
            </div>
          ) : blockedUsers.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center p-12 text-center"
              data-testid="blocked-users-empty"
            >
              <div className="w-16 h-16 rounded-full bg-surface-hover dark:bg-[#1C2733] flex items-center justify-center text-ink-muted mb-4">
                <ShieldCheck className="w-8 h-8 text-presence-online" />
              </div>
              <h3 className="text-base font-semibold text-ink-primary dark:text-white mb-1">
                Không có người dùng nào bị chặn
              </h3>
              <p className="text-xs text-ink-secondary dark:text-ink-secondary-dark max-w-sm">
                Bạn chưa chặn ai cả. Nếu bạn chặn ai đó, họ sẽ xuất hiện tại đây và bạn có thể mở chặn bất kỳ lúc nào.
              </p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12" data-testid="blocked-users-no-filter-match">
              <p className="text-xs text-ink-secondary dark:text-ink-secondary-dark">
                Không tìm thấy ai khớp với từ khóa "{filterQuery}".
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredUsers.map((user) => (
                <BlockedUserCard
                  key={user.id}
                  user={user}
                  onUnblock={onUnblock}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
