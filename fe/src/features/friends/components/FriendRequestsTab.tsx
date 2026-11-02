import { Inbox, Send, UserPlus } from 'lucide-react'
import { FriendRequestCard } from './FriendRequestCard'
import { Button } from '@/components/ui/button'
import type { FriendRequest } from '../types/friends.types'

export interface FriendRequestsTabProps {
  receivedRequests: FriendRequest[]
  sentRequests: FriendRequest[]
  subTab: 'received' | 'sent'
  isLoading: boolean
  isActionInProgress?: Record<string, boolean>
  onSubTabChange: (subTab: 'received' | 'sent') => void
  onAccept: (requestId: string) => Promise<void>
  onReject: (requestId: string) => Promise<void>
  onCancel: (requestId: string) => Promise<void>
  onSwitchToFindTab?: () => void
}

/**
 * FriendRequestsTab: Tab quản lý lời mời kết bạn (Đã nhận & Đã gửi)
 * - Ghim cố định Bộ lọc Sub-tabs trên cùng (shrink-0), chỉ vùng danh sách card cuộn (flex-1 min-h-0 overflow-y-auto)
 * - Hiển thị badge số lượng realtime
 * - Tương thích chuẩn thẩm mỹ Telegram & Messenger
 */
export function FriendRequestsTab({
  receivedRequests,
  sentRequests,
  subTab,
  isLoading,
  isActionInProgress = {},
  onSubTabChange,
  onAccept,
  onReject,
  onCancel,
  onSwitchToFindTab,
}: FriendRequestsTabProps) {
  const currentRequests = subTab === 'received' ? receivedRequests : sentRequests

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden" data-testid="friend-requests-tab">
      {/* Thanh điều khiển Sub-tabs - GHIM CỐ ĐỊNH Ở TRÊN (shrink-0) */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/60 dark:border-border-dark/60">
        <div className="flex items-center gap-1.5 p-1 bg-surface-light-2 dark:bg-[#17212B] rounded-xl border border-border/40 dark:border-border-dark self-start">
          <button
            type="button"
            onClick={() => onSubTabChange('received')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              subTab === 'received'
                ? 'bg-white dark:bg-[#242F3D] text-brand dark:text-brand-accent shadow-xs font-semibold'
                : 'text-ink-secondary dark:text-ink-secondary-dark hover:text-ink-primary dark:hover:text-white'
            }`}
            data-testid="subtab-received-button"
          >
            <Inbox className="w-3.5 h-3.5 shrink-0" />
            <span>Đã nhận ({receivedRequests.length})</span>
          </button>

          <button
            type="button"
            onClick={() => onSubTabChange('sent')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              subTab === 'sent'
                ? 'bg-white dark:bg-[#242F3D] text-brand dark:text-brand-accent shadow-xs font-semibold'
                : 'text-ink-secondary dark:text-ink-secondary-dark hover:text-ink-primary dark:hover:text-white'
            }`}
            data-testid="subtab-sent-button"
          >
            <Send className="w-3.5 h-3.5 shrink-0" />
            <span>Đã gửi ({sentRequests.length})</span>
          </button>
        </div>

        <p className="text-xs text-ink-muted hidden sm:block">
          {subTab === 'received'
            ? 'Lời mời kết bạn gửi đến tài khoản của bạn'
            : 'Lời mời bạn đã gửi và đang chờ đối phương phản hồi'}
        </p>
      </div>

      {/* VÙNG DUY NHẤT CUỘN NỘI DUNG: flex-1 min-h-0 overflow-y-auto */}
      <div
        className="flex-1 min-h-0 overflow-y-auto pt-4 pr-1 scrollbar-thin"
        data-testid="requests-scroll-container"
      >
        {isLoading ? (
          /* Skeleton Loading Cards */
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            data-testid="requests-loading-skeleton"
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
        ) : currentRequests.length > 0 ? (
          /* Danh sách Request Cards */
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            data-testid="requests-grid"
          >
            {currentRequests.map((req) => (
              <FriendRequestCard
                key={req.id}
                request={req}
                type={subTab}
                isProcessing={Boolean(isActionInProgress[req.id])}
                onAccept={onAccept}
                onReject={onReject}
                onCancel={onCancel}
              />
            ))}
          </div>
        ) : (
          /* Empty State */
          <div
            className="flex flex-col items-center justify-center p-8 text-center my-auto min-h-[300px]"
            data-testid="requests-empty-state"
          >
            {subTab === 'received' ? (
              <>
                <div className="w-16 h-16 rounded-full bg-brand-soft dark:bg-brand/10 flex items-center justify-center text-brand dark:text-brand-accent mb-4">
                  <Inbox className="w-8 h-8" />
                </div>
                <h4 className="text-base font-semibold text-ink-primary dark:text-white mb-1">
                  Không có lời mời kết bạn nào
                </h4>
                <p className="text-xs text-ink-secondary dark:text-ink-secondary-dark max-w-sm mb-5 leading-relaxed">
                  Khi có người dùng gửi lời mời kết bạn tới bạn, họ sẽ xuất hiện tại đây để bạn xem và phản hồi.
                </p>
                {onSwitchToFindTab && (
                  <Button
                    type="button"
                    onClick={onSwitchToFindTab}
                    className="rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                    data-testid="requests-empty-find-btn"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Khám phá bạn bè mới</span>
                  </Button>
                )}
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-surface-hover dark:bg-[#1C2733] flex items-center justify-center text-ink-muted mb-4">
                  <Send className="w-8 h-8" />
                </div>
                <h4 className="text-base font-semibold text-ink-primary dark:text-white mb-1">
                  Bạn chưa gửi lời mời nào
                </h4>
                <p className="text-xs text-ink-secondary dark:text-ink-secondary-dark max-w-sm mb-5 leading-relaxed">
                  Hãy tìm kiếm bạn bè hoặc đồng nghiệp trên ReChat và gửi lời mời để mở rộng danh bạ kết nối.
                </p>
                {onSwitchToFindTab && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onSwitchToFindTab}
                    className="rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                    data-testid="requests-empty-find-btn"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Tìm kiếm người dùng</span>
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
