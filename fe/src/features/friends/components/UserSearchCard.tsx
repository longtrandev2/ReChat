import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, UserCheck, MessageSquare, UserX, Check, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { conversationApi } from '@/features/conversations/services/conversation.api'
import { useConversationStore } from '@/features/conversations/stores/conversation.store'
import type { FriendUser } from '../types/friends.types'

export interface UserSearchCardProps {
  user: FriendUser
  relationStatus: 'FRIEND' | 'SENT_REQUEST' | 'RECEIVED_REQUEST' | 'NONE'
  requestId?: string
  isProcessing?: boolean
  onSendRequest: (userId: string) => Promise<void>
  onCancelRequest?: (requestId: string) => Promise<void>
  onAcceptRequest?: (requestId: string) => Promise<void>
  onRejectRequest?: (requestId: string) => Promise<void>
}

/**
 * UserSearchCard: Card hiển thị thông tin người dùng từ kết quả tìm kiếm
 * Tự động nhận diện quan hệ (Bạn bè, Đã gửi lời mời, Nhận được lời mời, Chưa kết bạn)
 * và cung cấp nút thao tác phù hợp
 */
export function UserSearchCard({
  user,
  relationStatus,
  requestId,
  isProcessing = false,
  onSendRequest,
  onCancelRequest,
  onAcceptRequest,
  onRejectRequest,
}: UserSearchCardProps) {
  const navigate = useNavigate()
  const [internalLoading, setInternalLoading] = useState(false)
  const loading = isProcessing || internalLoading

  const initials = user.displayName
    ? user.displayName
        .split(' ')
        .map((p) => p[0])
        .slice(-2)
        .join('')
        .toUpperCase()
    : 'U'

  // Mở hoặc tạo đoạn chat trực tiếp 1-1
  const handleStartChat = async () => {
    try {
      setInternalLoading(true)
      const conv = await conversationApi.createDirect({ targetUserId: user.id })
      useConversationStore.getState().addOrUpdateConversation(conv)
      navigate(`/chat/${conv.id}`)
    } catch (err) {
      console.error('Failed to start chat:', err)
    } finally {
      setInternalLoading(false)
    }
  }

  const handleSend = async () => {
    if (loading) return
    setInternalLoading(true)
    try {
      await onSendRequest(user.id)
    } finally {
      setInternalLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!requestId || !onCancelRequest || loading) return
    setInternalLoading(true)
    try {
      await onCancelRequest(requestId)
    } finally {
      setInternalLoading(false)
    }
  }

  const handleAccept = async () => {
    if (!requestId || !onAcceptRequest || loading) return
    setInternalLoading(true)
    try {
      await onAcceptRequest(requestId)
    } finally {
      setInternalLoading(false)
    }
  }

  const handleReject = async () => {
    if (!requestId || !onRejectRequest || loading) return
    setInternalLoading(true)
    try {
      await onRejectRequest(requestId)
    } finally {
      setInternalLoading(false)
    }
  }

  return (
    <div
      className="bg-white/80 dark:bg-[#17212B]/90 backdrop-blur-xs border border-border/70 dark:border-border-dark/80 rounded-2xl p-4 flex flex-col justify-between hover:shadow-md hover:border-brand/30 dark:hover:border-brand-accent/30 transition-all duration-200"
      data-testid={`user-search-card-${user.id}`}
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

        {/* Trạng thái quan hệ */}
        <div className="mt-3">
          {relationStatus === 'FRIEND' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
              <UserCheck className="w-3 h-3" />
              <span>Bạn bè</span>
            </span>
          )}
          {relationStatus === 'SENT_REQUEST' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
              <span>Đã gửi lời mời</span>
            </span>
          )}
          {relationStatus === 'RECEIVED_REQUEST' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-brand dark:text-brand-accent bg-brand/10 px-2 py-0.5 rounded-md">
              <span>Đã gửi lời mời cho bạn</span>
            </span>
          )}
          {relationStatus === 'NONE' && (
            <span className="inline-flex items-center text-[11px] text-ink-muted">
              Chưa kết nối
            </span>
          )}
        </div>
      </div>

      {/* Nút hành động */}
      <div className="mt-4 pt-3 border-t border-border/40 dark:border-border-dark/60">
        {relationStatus === 'FRIEND' && (
          <Button
            type="button"
            size="sm"
            disabled={loading}
            onClick={handleStartChat}
            className="w-full rounded-xl text-xs font-semibold h-8.5 bg-brand hover:bg-brand-hover text-white shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
            data-testid={`message-user-btn-${user.id}`}
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Nhắn tin</span>
              </>
            )}
          </Button>
        )}

        {relationStatus === 'SENT_REQUEST' && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={handleCancel}
            className="w-full rounded-xl text-xs font-medium h-8.5 hover:bg-danger/10 hover:border-danger/30 hover:text-danger text-ink-secondary dark:text-ink-secondary-dark flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            data-testid={`cancel-user-request-btn-${user.id}`}
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <UserX className="w-3.5 h-3.5" />
                <span>Hủy lời mời</span>
              </>
            )}
          </Button>
        )}

        {relationStatus === 'RECEIVED_REQUEST' && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={loading}
              onClick={handleAccept}
              className="flex-1 rounded-xl text-xs font-semibold h-8.5 bg-brand hover:bg-brand-hover text-white shadow-2xs cursor-pointer"
              data-testid={`accept-user-request-btn-${user.id}`}
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
              className="flex-1 rounded-xl text-xs font-medium h-8.5 hover:bg-black/5 dark:hover:bg-white/5 text-ink-secondary dark:text-ink-secondary-dark cursor-pointer"
              data-testid={`reject-user-request-btn-${user.id}`}
            >
              <X className="w-3.5 h-3.5 mr-1" />
              <span>Từ chối</span>
            </Button>
          </div>
        )}

        {relationStatus === 'NONE' && (
          <Button
            type="button"
            size="sm"
            disabled={loading}
            onClick={handleSend}
            className="w-full rounded-xl text-xs font-semibold h-8.5 bg-brand hover:bg-brand-hover text-white shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
            data-testid={`send-friend-request-btn-${user.id}`}
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <UserPlus className="w-3.5 h-3.5" />
                <span>Kết bạn</span>
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
