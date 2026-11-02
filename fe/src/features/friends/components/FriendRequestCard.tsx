import { useState } from 'react'
import { Check, X, UserX, Clock, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { FriendRequest } from '../types/friends.types'

export interface FriendRequestCardProps {
  request: FriendRequest
  type: 'received' | 'sent'
  isProcessing?: boolean
  onAccept?: (requestId: string) => Promise<void>
  onReject?: (requestId: string) => Promise<void>
  onCancel?: (requestId: string) => Promise<void>
}

/**
 * Format relative time helper không phụ thuộc thư viện ngoài
 */
function formatRelativeTime(dateString: string): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return ''

  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diffSec < 60) return 'Vừa xong'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} phút trước`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} giờ trước`
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)} ngày trước`
  return date.toLocaleDateString('vi-VN')
}

/**
 * FriendRequestCard: Card hiển thị từng lời mời kết bạn (Đã nhận hoặc Đã gửi)
 * Tuân thủ Telegram Blue (#2481CC), hỗ trợ Dark/Light mode và loading state riêng biệt
 */
export function FriendRequestCard({
  request,
  type,
  isProcessing = false,
  onAccept,
  onReject,
  onCancel,
}: FriendRequestCardProps) {
  const [internalLoading, setInternalLoading] = useState(false)
  const user = type === 'received' ? request.requester : request.addressee
  const loading = isProcessing || internalLoading

  if (!user) return null

  const initials = user.displayName
    ? user.displayName
        .split(' ')
        .map((p) => p[0])
        .slice(-2)
        .join('')
        .toUpperCase()
    : 'U'

  const handleAccept = async () => {
    if (!onAccept || loading) return
    setInternalLoading(true)
    try {
      await onAccept(request.id)
    } finally {
      setInternalLoading(false)
    }
  }

  const handleReject = async () => {
    if (!onReject || loading) return
    setInternalLoading(true)
    try {
      await onReject(request.id)
    } finally {
      setInternalLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!onCancel || loading) return
    setInternalLoading(true)
    try {
      await onCancel(request.id)
    } finally {
      setInternalLoading(false)
    }
  }

  return (
    <div
      className="bg-white/80 dark:bg-[#17212B]/90 backdrop-blur-xs border border-border/70 dark:border-border-dark/80 rounded-2xl p-4 flex flex-col justify-between hover:shadow-md hover:border-brand/30 dark:hover:border-brand-accent/30 transition-all duration-200"
      data-testid={`request-card-${request.id}`}
    >
      {/* Thông tin người dùng */}
      <div>
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.displayName}
                className="w-12 h-12 rounded-full object-cover ring-2 ring-white/50 dark:ring-black/20"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand/20 to-brand/40 dark:from-brand/30 dark:to-brand/50 text-brand dark:text-brand-accent flex items-center justify-center font-bold text-sm ring-2 ring-white/50 dark:ring-black/20">
                {initials}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h4
              className="font-semibold text-sm text-ink-primary dark:text-white truncate"
              title={user.displayName}
            >
              {user.displayName}
            </h4>
            <p className="text-xs text-ink-secondary dark:text-ink-secondary-dark truncate">
              @{user.username}
            </p>
          </div>
        </div>

        {/* Thời gian gửi lời mời */}
        <div className="flex items-center gap-1.5 mt-3 text-[11px] text-ink-muted">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>{type === 'received' ? 'Đã gửi' : 'Gửi lúc'} {formatRelativeTime(request.createdAt)}</span>
        </div>
      </div>

      {/* Hành động tương ứng theo loại tab */}
      <div className="mt-4 pt-3 border-t border-border/40 dark:border-border-dark/60">
        {type === 'received' ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={loading}
              onClick={handleAccept}
              className="flex-1 rounded-xl text-xs font-semibold h-8.5 bg-brand hover:bg-brand-hover text-white shadow-2xs cursor-pointer"
              data-testid={`accept-btn-${request.id}`}
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 mr-1" />
                  <span>Chấp nhận</span>
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={handleReject}
              className="flex-1 rounded-xl text-xs font-medium h-8.5 hover:bg-black/5 dark:hover:bg-white/5 text-ink-secondary dark:text-ink-secondary-dark hover:text-ink-primary dark:hover:text-white cursor-pointer"
              data-testid={`reject-btn-${request.id}`}
            >
              <X className="w-3.5 h-3.5 mr-1" />
              <span>Từ chối</span>
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg">
              Đang chờ phản hồi
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={handleCancel}
              className="rounded-xl text-xs font-medium h-8 hover:bg-danger/10 hover:border-danger/30 hover:text-danger text-ink-secondary dark:text-ink-secondary-dark cursor-pointer transition-colors"
              data-testid={`cancel-btn-${request.id}`}
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <UserX className="w-3.5 h-3.5 mr-1" />
                  <span>Hủy lời mời</span>
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
