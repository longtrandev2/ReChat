import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageSquare, MoreHorizontal, UserMinus, UserX, Loader2, ShieldAlert } from 'lucide-react'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as Dialog from '@radix-ui/react-dialog'
import { toast } from 'sonner'

import { Avatar, AvatarFallback, AvatarImage, PresenceDot } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { conversationApi } from '@/features/conversations/services/conversation.api'
import { useConversationStore } from '@/features/conversations/stores/conversation.store'
import type { FriendUser } from '../types/friends.types'

export interface FriendCardProps {
  friend: FriendUser
  isOnline: boolean
  onUnfriend: (friendId: string) => Promise<void>
  onBlock?: (friendId: string) => Promise<void>
}

/**
 * FriendCard: Thẻ hiển thị bạn bè chuẩn thiết kế Telegram & Messenger
 * - Avatar bo tròn kèm chấm trực tuyến thời gian thực
 * - Nút "Nhắn tin" mở ngay cuộc trò chuyện 1-1
 * - Menu tùy chọn 3 chấm với modal xác nhận Hủy kết bạn
 */
export function FriendCard({ friend, isOnline, onUnfriend, onBlock }: FriendCardProps) {
  const navigate = useNavigate()
  const [isStartingChat, setIsStartingChat] = useState(false)
  const [isUnfriendDialogOpen, setIsUnfriendDialogOpen] = useState(false)
  const [isUnfriending, setIsUnfriending] = useState(false)
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false)
  const [isBlocking, setIsBlocking] = useState(false)

  const initials = (friend.displayName || friend.username || 'U')
    .slice(0, 2)
    .toUpperCase()

  // Mở hoặc khởi tạo chat 1-1 với bạn bè
  const handleStartChat = async () => {
    try {
      setIsStartingChat(true)
      const conv = await conversationApi.createDirect({ targetUserId: friend.id })
      useConversationStore.getState().addOrUpdateConversation(conv)
      navigate(`/chat/${conv.id}`)
    } catch (err) {
      console.error('Không thể mở cuộc trò chuyện:', err)
      toast.error('Không thể mở cuộc trò chuyện với bạn bè')
    } finally {
      setIsStartingChat(false)
    }
  }

  // Xác nhận hủy kết bạn
  const handleConfirmUnfriend = async () => {
    try {
      setIsUnfriending(true)
      await onUnfriend(friend.id)
      toast.success(`Đã hủy kết bạn với ${friend.displayName}`)
      setIsUnfriendDialogOpen(false)
    } catch {
      toast.error('Không thể hủy kết bạn lúc này')
    } finally {
      setIsUnfriending(false)
    }
  }

  // Xác nhận chặn người dùng
  const handleConfirmBlock = async () => {
    if (!onBlock) return
    try {
      setIsBlocking(true)
      await onBlock(friend.id)
      toast.success(`Đã chặn ${friend.displayName}`)
      setIsBlockDialogOpen(false)
    } catch {
      toast.error('Không thể chặn người dùng lúc này')
    } finally {
      setIsBlocking(false)
    }
  }

  const formattedDate = friend.friendSince
    ? format(new Date(friend.friendSince), 'dd/MM/yyyy', { locale: vi })
    : null

  return (
    <>
      <div
        className="bg-surface dark:bg-[#17212B] border border-border/80 dark:border-border-dark rounded-2xl p-4 shadow-2xs hover:shadow-md hover:border-brand/40 dark:hover:border-brand-accent/40 transition-all flex flex-col justify-between gap-4 group"
        data-testid={`friend-card-${friend.id}`}
      >
        {/* Phần thông tin người bạn */}
        <div className="flex items-start gap-3.5">
          <div className="relative shrink-0">
            <Avatar size="lg" className="ring-2 ring-transparent group-hover:ring-brand/30 transition-all">
              {friend.avatarUrl && <AvatarImage src={friend.avatarUrl} alt={friend.displayName} />}
              <AvatarFallback className="bg-brand-soft text-brand font-semibold text-sm">
                {initials}
              </AvatarFallback>
            </Avatar>
            <PresenceDot isOnline={isOnline} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <h3
                className="font-semibold text-ink-primary dark:text-ink-primary-dark text-sm sm:text-base truncate"
                title={friend.displayName}
              >
                {friend.displayName}
              </h3>

              {/* Menu 3 chấm tác vụ */}
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    type="button"
                    title="Tùy chọn"
                    aria-label={`Tùy chọn cho ${friend.displayName}`}
                    className="p-1 rounded-lg text-ink-muted hover:text-ink-primary dark:hover:text-white hover:bg-surface-hover dark:hover:bg-white/10 transition-colors opacity-70 group-hover:opacity-100 cursor-pointer"
                    data-testid={`friend-options-${friend.id}`}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </DropdownMenu.Trigger>

                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    className="min-w-[170px] bg-white dark:bg-[#1C2733] rounded-xl p-1.5 shadow-xl border border-border/80 dark:border-border-dark text-xs z-50 animate-in fade-in-50 zoom-in-95 duration-150"
                    align="end"
                    sideOffset={5}
                  >
                    <DropdownMenu.Item
                      onSelect={() => setIsUnfriendDialogOpen(true)}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-coral dark:text-rose-400 hover:bg-coral-soft/50 dark:hover:bg-rose-950/30 cursor-pointer focus:outline-hidden font-medium"
                      data-testid={`unfriend-btn-${friend.id}`}
                    >
                      <UserMinus className="w-4 h-4 shrink-0" />
                      <span>Hủy kết bạn</span>
                    </DropdownMenu.Item>

                    {onBlock && (
                      <DropdownMenu.Item
                        onSelect={() => setIsBlockDialogOpen(true)}
                        className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-coral dark:text-rose-400 hover:bg-coral-soft/50 dark:hover:bg-rose-950/30 cursor-pointer focus:outline-hidden font-medium"
                        data-testid={`block-btn-${friend.id}`}
                      >
                        <ShieldAlert className="w-4 h-4 shrink-0" />
                        <span>Chặn người dùng</span>
                      </DropdownMenu.Item>
                    )}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>

            <p className="text-xs text-ink-secondary dark:text-ink-secondary-dark truncate">
              @{friend.username}
            </p>

            {/* Trạng thái hoạt động */}
            <div className="flex items-center gap-1.5 mt-2">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  isOnline
                    ? 'bg-presence-online animate-pulse'
                    : 'bg-presence-offline/60'
                }`}
                aria-hidden="true"
              />
              <span className="text-[11px] text-ink-muted select-none">
                {isOnline ? 'Đang hoạt động' : 'Ngoại tuyến'}
              </span>

              {formattedDate && (
                <>
                  <span className="text-ink-muted opacity-40 text-[10px]">•</span>
                  <span className="text-[11px] text-ink-muted select-none truncate">
                    Bạn từ {formattedDate}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Nút hành động nhanh: Nhắn tin */}
        <div className="pt-2 border-t border-border/40 dark:border-border-dark/60 flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleStartChat}
            disabled={isStartingChat}
            className="w-full flex items-center justify-center gap-2 rounded-xl border-border dark:border-border-dark hover:bg-brand-soft/70 hover:text-brand hover:border-brand/40 dark:hover:bg-brand/10 dark:hover:text-brand-accent transition-colors text-xs font-semibold h-8.5"
            data-testid={`start-chat-btn-${friend.id}`}
          >
            {isStartingChat ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <MessageSquare className="w-3.5 h-3.5" />
            )}
            <span>Nhắn tin</span>
          </Button>
        </div>
      </div>

      {/* Modal xác nhận Hủy kết bạn (Radix Dialog) */}
      <Dialog.Root open={isUnfriendDialogOpen} onOpenChange={setIsUnfriendDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm bg-white dark:bg-[#17212B] rounded-2xl p-6 shadow-2xl border border-border dark:border-border-dark animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-3 text-coral dark:text-rose-400">
              <div className="w-10 h-10 rounded-full bg-coral-soft dark:bg-rose-950/40 flex items-center justify-center shrink-0">
                <UserX className="w-5 h-5" />
              </div>
              <Dialog.Title className="text-base font-semibold text-ink-primary dark:text-ink-primary-dark">
                Hủy kết bạn
              </Dialog.Title>
            </div>

            <Dialog.Description className="text-xs sm:text-sm text-ink-secondary dark:text-ink-secondary-dark leading-relaxed mb-6">
              Bạn có chắc chắn muốn hủy kết bạn với{' '}
              <span className="font-semibold text-ink-primary dark:text-white">
                {friend.displayName}
              </span>
              ? Hai bạn sẽ không còn nhìn thấy nhau trong danh bạ bạn bè.
            </Dialog.Description>

            <div className="flex items-center justify-end gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsUnfriendDialogOpen(false)}
                disabled={isUnfriending}
                className="rounded-xl text-xs"
              >
                Hủy
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleConfirmUnfriend}
                disabled={isUnfriending}
                className="rounded-xl text-xs flex items-center gap-1.5"
                data-testid="confirm-unfriend-button"
              >
                {isUnfriending && <Loader2 className="w-3 h-3 animate-spin" />}
                <span>Xác nhận hủy</span>
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Modal xác nhận Chặn người dùng */}
      <Dialog.Root open={isBlockDialogOpen} onOpenChange={setIsBlockDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm bg-white dark:bg-[#17212B] rounded-2xl p-6 shadow-2xl border border-border dark:border-border-dark animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-3 text-coral dark:text-rose-400">
              <div className="w-10 h-10 rounded-full bg-coral-soft dark:bg-rose-950/40 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <Dialog.Title className="text-base font-semibold text-ink-primary dark:text-ink-primary-dark">
                Chặn người dùng
              </Dialog.Title>
            </div>

            <Dialog.Description className="text-xs sm:text-sm text-ink-secondary dark:text-ink-secondary-dark leading-relaxed mb-6">
              Bạn có chắc chắn muốn chặn{' '}
              <span className="font-semibold text-ink-primary dark:text-white">
                {friend.displayName}
              </span>
              ? Người này sẽ không thể gửi tin nhắn hay thấy trạng thái trực tuyến của bạn.
            </Dialog.Description>

            <div className="flex items-center justify-end gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsBlockDialogOpen(false)}
                disabled={isBlocking}
                className="rounded-xl text-xs"
              >
                Hủy
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleConfirmBlock}
                disabled={isBlocking}
                className="rounded-xl text-xs flex items-center gap-1.5"
                data-testid="confirm-block-button"
              >
                {isBlocking && <Loader2 className="w-3 h-3 animate-spin" />}
                <span>Xác nhận chặn</span>
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}

