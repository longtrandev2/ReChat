import { useState } from 'react'
import {
  Check,
  CheckCheck,
  Smile,
  Reply,
  MoreHorizontal,
  Pencil,
  Trash2,
  Copy,
} from 'lucide-react'
import { format } from 'date-fns'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as Dialog from '@radix-ui/react-dialog'
import { toast } from 'sonner'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import type { Message } from '../types/message.types'
import { cn } from '@/lib/utils'

interface MessageBubbleProps {
  message: Message
  isOutgoing: boolean
  isGroup?: boolean
  showSenderName?: boolean
  showAvatar?: boolean
  isRead?: boolean
  onReply?: (message: Message) => void
  onReact?: (message: Message, emoji: string) => void
  onEdit?: (message: Message) => void
  onRecall?: (message: Message) => void
}

const QUICK_EMOJIS = ['❤️', '👍', '😂', '🔥', '😮', '😢']

/**
 * MessageBubble: Bong bóng tin nhắn Telegram chuẩn thiết kế
 * - Tin gửi đi: nền #EFFDDE (dark: #2B5278), đuôi nhọn ở góc dưới phải (rounded-br-xs)
 * - Tin nhận đến: nền #FFFFFF (dark: #182533), đuôi nhọn ở góc dưới trái (rounded-bl-xs) kèm Avatar người gửi
 * - Flex wrap inline meta: tin nhắn ngắn có thời gian và dấu tích nằm cùng hàng với nội dung
 * - Dấu tích phân biệt: 1 tích xám (Đã gửi) vs 2 tích xanh (Đã đọc)
 * - Micro-action toolbar nổi khi hover (Quick Reactions, Reply, More)
 * - Danh sách Reaction Pills nhóm emoji với số lượng và trạng thái đã tương tác
 * - Menu hành động: Sao chép, Chỉnh sửa (trong 15 phút), Thu hồi tin nhắn
 */
export function MessageBubble({
  message,
  isOutgoing,
  isGroup = false,
  showSenderName = false,
  showAvatar = true,
  isRead = false,
  onReply,
  onReact,
  onEdit,
  onRecall,
}: MessageBubbleProps) {
  const [isRecallDialogOpen, setIsRecallDialogOpen] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [canEdit, setCanEdit] = useState(false)

  const timeString = (() => {
    try {
      const d = new Date(message.createdAt)
      return isNaN(d.getTime()) ? '' : format(d, 'HH:mm')
    } catch {
      return ''
    }
  })()

  const initials =
    (message.sender?.displayName || message.sender?.username || 'U')
      .split(' ')
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U'

  // Kiểm tra điều kiện chỉnh sửa khi người dùng bấm mở menu
  const checkCanEdit = (open: boolean) => {
    if (!open) return
    if (!isOutgoing || message.isRecalled || message.type !== 'TEXT') {
      setCanEdit(false)
      return
    }
    try {
      const created = new Date(message.createdAt).getTime()
      const isRecent = Date.now() - created <= 15 * 60 * 1000 // 15 phút
      setCanEdit(isRecent)
    } catch {
      setCanEdit(false)
    }
  }

  const handleCopy = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content)
      toast.success('Đã sao chép tin nhắn')
    }
  }

  return (
    <div
      className={cn(
        'flex flex-col w-full mb-1 group select-text relative',
        isOutgoing ? 'items-end justify-end' : 'items-start justify-start'
      )}
      data-testid={`message-bubble-${message.id}`}
    >
      <div
        className={cn(
          'flex w-full items-end relative',
          isOutgoing ? 'justify-end' : 'justify-start'
        )}
      >
        {/* Avatar người gửi cho tin nhắn đến (Incoming) */}
        {!isOutgoing && (
          <div className="w-8 shrink-0 mr-2 self-end mb-0.5 select-none">
            {showAvatar ? (
              <Avatar className="w-8 h-8 rounded-full border border-border-light/50 dark:border-white/10 shadow-xs transition-transform duration-150 group-hover:scale-105">
                <AvatarImage
                  src={message.sender?.avatarUrl || undefined}
                  alt={message.sender?.displayName || message.sender?.username}
                />
                <AvatarFallback className="bg-brand-soft text-brand font-medium text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className="w-8 h-8" aria-hidden="true" />
            )}
          </div>
        )}

        {/* Thân bong bóng tin nhắn */}
        <div
          className={cn(
            'max-w-[85%] sm:max-w-[70%] px-3.5 py-2 shadow-subtle relative border border-black/5 dark:border-white/5 transition-all duration-150 hover:shadow-md',
            isOutgoing
              ? 'bg-bubble-out dark:bg-bubble-out-dark rounded-2xl rounded-br-xs text-ink-primary dark:text-white'
              : 'bg-bubble-in dark:bg-bubble-in-dark rounded-2xl rounded-bl-xs text-ink-primary dark:text-[#F5F5F7]'
          )}
        >
          {/* Floating Micro-Actions Toolbar on Hover */}
          {!message.isRecalled && (
            <div
              className={cn(
                'absolute -top-3.5 z-20 flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-surface-light dark:bg-[#1E2C3A] border border-border-light/80 dark:border-border-dark shadow-md opacity-0 group-hover:opacity-100 transition-all duration-150 pointer-events-none group-hover:pointer-events-auto backdrop-blur-sm',
                isOutgoing ? 'right-2' : 'left-2'
              )}
            >
              {/* Quick Emojis or Emoji Toggle Button */}
              {showEmojiPicker ? (
                <div className="flex items-center gap-1 px-1">
                  {QUICK_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        onReact?.(message, emoji)
                        setShowEmojiPicker(false)
                      }}
                      className="hover:scale-125 active:scale-95 transition-transform text-sm p-0.5"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  title="Thả cảm xúc"
                  aria-label="Thả cảm xúc"
                  onClick={() => setShowEmojiPicker(true)}
                  className="p-1 rounded-full text-ink-secondary dark:text-ink-secondary-dark hover:text-amber-500 hover:scale-115 active:scale-90 transition-all cursor-pointer"
                >
                  <Smile className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                title="Trả lời"
                aria-label="Trả lời tin nhắn"
                onClick={() => onReply?.(message)}
                className="p-1 rounded-full text-ink-secondary dark:text-ink-secondary-dark hover:text-brand hover:scale-115 active:scale-90 transition-all cursor-pointer"
              >
                <Reply className="w-3.5 h-3.5" />
              </button>

              {/* Radix Dropdown Menu for More Actions */}
              <DropdownMenu.Root onOpenChange={checkCanEdit}>
                <DropdownMenu.Trigger asChild>
                  <button
                    type="button"
                    title="Tùy chọn khác"
                    aria-label="Tùy chọn khác"
                    className="p-1 rounded-full text-ink-secondary dark:text-ink-secondary-dark hover:text-ink-primary dark:hover:text-white hover:scale-115 active:scale-90 transition-all cursor-pointer"
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </button>
                </DropdownMenu.Trigger>

                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align={isOutgoing ? 'end' : 'start'}
                    sideOffset={5}
                    className="z-50 min-w-[140px] bg-surface dark:bg-surface-dark border border-border dark:border-border-dark p-1 rounded-xl shadow-telegram animate-in fade-in-80 zoom-in-95 text-xs text-ink-primary dark:text-ink-primary-dark"
                  >
                    <DropdownMenu.Item
                      onClick={handleCopy}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-surface-hover dark:hover:bg-surface-dark-secondary outline-none transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Sao chép</span>
                    </DropdownMenu.Item>

                    {canEdit && (
                      <DropdownMenu.Item
                        onClick={() => onEdit?.(message)}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-surface-hover dark:hover:bg-surface-dark-secondary outline-none transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5 text-brand" />
                        <span>Chỉnh sửa</span>
                      </DropdownMenu.Item>
                    )}

                    {isOutgoing && (
                      <DropdownMenu.Item
                        onClick={() => setIsRecallDialogOpen(true)}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-coral-soft/50 dark:hover:bg-coral/10 text-coral outline-none transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Thu hồi</span>
                      </DropdownMenu.Item>
                    )}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
          )}

          {/* Tên người gửi trong Group Chat */}
          {!isOutgoing && isGroup && showSenderName && message.sender && (
            <div className="text-xs font-semibold text-brand dark:text-brand-accent mb-1 select-none">
              {message.sender.displayName || message.sender.username}
            </div>
          )}

          {/* Nội dung tin nhắn & Ảnh đính kèm */}
          {message.isRecalled ? (
            <p className="italic text-ink-muted text-sm select-none">
              [Tin nhắn đã bị thu hồi]
            </p>
          ) : (
            <div>
              {message.type === 'IMAGE' && message.fileUrl && (
                <div className="rounded-xl overflow-hidden mb-1.5 max-h-72">
                  <img
                    src={message.fileUrl}
                    alt="Hình ảnh đính kèm"
                    className="w-full h-full object-cover rounded-xl cursor-pointer hover:opacity-95 transition-opacity"
                    loading="lazy"
                    onClick={() => window.open(message.fileUrl || '', '_blank')}
                  />
                </div>
              )}

              {/* Layout Telegram Inline: chữ và thời gian cùng hàng nếu chữ ngắn */}
              <div className="flex flex-wrap items-end gap-x-2.5 gap-y-1">
                {message.content && (
                  <div className="flex-1 min-w-[40px] text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {message.content}
                  </div>
                )}

                {/* Thời gian, Trạng thái đã sửa & Trạng thái đã đọc */}
                <div className="inline-flex items-center gap-1 select-none text-[11px] text-ink-secondary dark:text-ink-secondary-dark ml-auto shrink-0 leading-none pb-0.5">
                  {message.isEdited && (
                    <span className="text-[10px] text-ink-muted italic mr-0.5">
                      (đã sửa)
                    </span>
                  )}
                  {timeString && <span>{timeString}</span>}
                  {isOutgoing && (
                    <span
                      className="inline-flex items-center"
                      aria-label={isRead ? 'Đã đọc' : 'Đã gửi'}
                    >
                      {isRead ? (
                        <CheckCheck className="w-3.5 h-3.5 text-[#4FAE4E] dark:text-[#5288C1]" />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-ink-muted dark:text-ink-secondary-dark" />
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Danh sách Reaction Pills dưới bubble */}
      {!message.isRecalled && message.reactions && message.reactions.length > 0 && (
        <div
          className={cn(
            'flex flex-wrap gap-1 mt-1 select-none z-10',
            isOutgoing ? 'justify-end pr-1' : 'justify-start pl-10'
          )}
        >
          {message.reactions.map((r) => (
            <button
              key={r.emoji}
              type="button"
              title={r.users.map((u) => u.displayName).join(', ')}
              onClick={() => onReact?.(message, r.emoji)}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all cursor-pointer border active:scale-95',
                r.hasReacted
                  ? 'bg-brand/15 border-brand/40 text-brand dark:text-brand-accent shadow-xs'
                  : 'bg-surface-light dark:bg-[#1E2C3A] border-border-light dark:border-white/10 text-ink-secondary dark:text-ink-secondary-dark hover:bg-black/5 dark:hover:bg-white/10'
              )}
            >
              <span>{r.emoji}</span>
              <span className="tabular-nums text-[11px] font-semibold">{r.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Modal xác nhận thu hồi tin nhắn */}
      <Dialog.Root open={isRecallDialogOpen} onOpenChange={setIsRecallDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 animate-in fade-in duration-150" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-surface dark:bg-surface-dark border border-border dark:border-border-dark p-6 rounded-2xl shadow-telegram z-50 animate-in zoom-in-95 duration-150 focus:outline-none">
            <Dialog.Title className="text-lg font-bold text-ink-primary dark:text-ink-primary-dark">
              Thu hồi tin nhắn?
            </Dialog.Title>
            <Dialog.Description className="text-sm text-ink-secondary dark:text-ink-secondary-dark mt-2 leading-relaxed">
              Tin nhắn này sẽ bị thu hồi đối với tất cả thành viên trong cuộc trò chuyện.
            </Dialog.Description>
            <div className="flex items-center justify-end gap-3 mt-6">
              <Dialog.Close asChild>
                <Button variant="ghost">Hủy</Button>
              </Dialog.Close>
              <Button
                variant="destructive"
                onClick={() => {
                  setIsRecallDialogOpen(false)
                  onRecall?.(message)
                }}
                className="bg-coral hover:bg-coral/90 text-white"
              >
                Thu hồi
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}

