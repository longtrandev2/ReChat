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
  Download,
  Link2,
  FileText,
  FileSpreadsheet,
  FileArchive,
  FileCode,
  File,
} from 'lucide-react'
import { format } from 'date-fns'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as Dialog from '@radix-ui/react-dialog'
import { toast } from 'sonner'

interface FileDetails {
  icon: typeof FileText
  extLabel: string
  colorClass: string
  bgClass: string
}

function getFileDetails(fileName: string = ''): FileDetails {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  switch (ext) {
    case 'pdf':
      return {
        icon: FileText,
        extLabel: 'Tài liệu PDF',
        colorClass: 'text-rose-600 dark:text-rose-400',
        bgClass: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/50',
      }
    case 'doc':
    case 'docx':
      return {
        icon: FileText,
        extLabel: 'Tài liệu Word',
        colorClass: 'text-blue-600 dark:text-blue-400',
        bgClass: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/50',
      }
    case 'xls':
    case 'xlsx':
    case 'csv':
      return {
        icon: FileSpreadsheet,
        extLabel: 'Bảng tính Excel',
        colorClass: 'text-emerald-600 dark:text-emerald-400',
        bgClass: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50',
      }
    case 'zip':
    case 'rar':
    case '7z':
    case 'tar':
    case 'gz':
      return {
        icon: FileArchive,
        extLabel: 'Tệp nén',
        colorClass: 'text-amber-600 dark:text-amber-400',
        bgClass: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50',
      }
    case 'txt':
    case 'md':
      return {
        icon: FileText,
        extLabel: 'Tệp văn bản TXT',
        colorClass: 'text-slate-600 dark:text-slate-400',
        bgClass: 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800',
      }
    case 'js':
    case 'ts':
    case 'json':
    case 'html':
    case 'css':
      return {
        icon: FileCode,
        extLabel: 'Mã nguồn',
        colorClass: 'text-violet-600 dark:text-violet-400',
        bgClass: 'bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-900/50',
      }
    default:
      return {
        icon: File,
        extLabel: ext ? `Tệp .${ext.toUpperCase()}` : 'Tệp tin',
        colorClass: 'text-teal-600 dark:text-teal-400',
        bgClass: 'bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-900/50',
      }
  }
}

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import type { Message } from '../types/message.types'
import { cn, formatFileSize } from '@/lib/utils'

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
  onScrollToReply?: (replyToId: string) => void
  onImageClick?: (imageUrl: string, altText?: string) => void
}

const QUICK_EMOJIS = ['❤️', '👍', '😂', '🔥', '😮', '😢']

/**
 * MessageBubble: Bong bóng tin nhắn Telegram chuẩn thiết kế
 * - Tin gửi đi: nền #EFFDDE (dark: #2B5278), đuôi nhọn ở góc dưới phải (rounded-br-xs)
 * - Tin nhận đến: nền #FFFFFF (dark: #182533), đuôi nhọn ở góc dưới trái (rounded-bl-xs) kèm Avatar người gửi
 * - Flex wrap inline meta: tin nhắn ngắn có thời gian và dấu tích nằm cùng hàng với nội dung
 * - Dấu tích phân biệt: 1 tích xám (Đã gửi) vs 2 tích xanh (Đã đọc)
 * - Micro-action toolbar nổi khi hover (Quick Reactions, Reply, More) nằm phía trên bubble không bị che chữ
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
  onScrollToReply,
  onImageClick,
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

  const handleDownloadFile = async (
    e: React.MouseEvent,
    fileUrl: string,
    fileName: string
  ) => {
    e.stopPropagation()
    try {
      let downloadUrl = fileUrl
      if (downloadUrl.includes('/upload/') && !downloadUrl.includes('/fl_attachment')) {
        downloadUrl = downloadUrl.replace('/upload/', '/upload/fl_attachment/')
      }
      const res = await fetch(downloadUrl)
      if (!res.ok) throw new Error('Fetch failed')
      const blob = await res.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(blobUrl)
      toast.success('Đang tải tệp xuống...')
    } catch {
      let fallbackUrl = fileUrl
      if (fallbackUrl.includes('/upload/') && !fallbackUrl.includes('/fl_attachment')) {
        fallbackUrl = fallbackUrl.replace('/upload/', '/upload/fl_attachment/')
      }
      window.open(fallbackUrl, '_blank')
    }
  }

  // Render thanh thao tác micro-actions đặt ở bên cạnh bong bóng (trái với outgoing, phải với incoming)
  const renderToolbar = () => {
    if (message.isRecalled) return null

    return (
      <div
        className={cn(
          'flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-white dark:bg-[#1E2C3A] border border-border/80 dark:border-white/10 shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-150 backdrop-blur-xs shrink-0 self-center z-20 pointer-events-none group-hover:pointer-events-auto',
          isOutgoing ? 'mr-2' : 'ml-2'
        )}
        data-testid={`message-toolbar-${message.id}`}
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
                className="hover:scale-125 active:scale-95 transition-transform text-sm p-0.5 cursor-pointer"
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
              side="top"
              sideOffset={6}
              className="z-50 min-w-[150px] bg-white dark:bg-[#17212B] text-ink-primary dark:text-[#F5F5F7] border border-border dark:border-white/10 p-1.5 rounded-xl shadow-2xl animate-in fade-in-80 zoom-in-95 text-xs"
            >
              <DropdownMenu.Item
                onClick={handleCopy}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 outline-none transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Sao chép</span>
              </DropdownMenu.Item>

              {message.type === 'FILE' && message.fileUrl && (
                <DropdownMenu.Item
                  onClick={(e) => {
                    e.stopPropagation()
                    navigator.clipboard.writeText(message.fileUrl || '')
                    toast.success('Đã sao chép liên kết tệp')
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 outline-none transition-colors"
                >
                  <Link2 className="w-3.5 h-3.5 text-brand" />
                  <span>Sao chép liên kết tệp</span>
                </DropdownMenu.Item>
              )}

              {canEdit && (
                <DropdownMenu.Item
                  onClick={() => onEdit?.(message)}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 outline-none transition-colors"
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
    )
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
          'flex w-full items-center relative',
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

        {/* Thanh thao tác micro-actions nằm BÊN TRÁI của bong bóng gửi đi (Outgoing) */}
        {isOutgoing && renderToolbar()}

        {/* Thân bong bóng tin nhắn */}
        <div
          className={cn(
            'max-w-[85%] sm:max-w-[70%] px-3.5 py-2 shadow-subtle relative border border-black/5 dark:border-white/5 transition-all duration-150 hover:shadow-md',
            isOutgoing
              ? 'bg-bubble-out dark:bg-bubble-out-dark rounded-2xl rounded-br-xs text-ink-primary dark:text-white'
              : 'bg-bubble-in dark:bg-bubble-in-dark rounded-2xl rounded-bl-xs text-ink-primary dark:text-[#F5F5F7]'
          )}
          data-message-box="true"
        >

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
              {/* Trích dẫn tin nhắn cha (Reply Context Telegram style) */}
              {message.replyTo && (
                <div
                  className="mb-1.5 px-2.5 py-1 rounded-lg border-l-[3px] border-l-brand text-xs cursor-pointer select-none transition-colors bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 relative z-10"
                  data-testid={`reply-preview-${message.id}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!message.replyTo?.id) return
                    if (onScrollToReply) {
                      onScrollToReply(message.replyTo.id)
                    } else {
                      const targetEl = document.querySelector(`[data-testid="message-bubble-${message.replyTo.id}"]`)
                      const bubbleBox = targetEl?.querySelector('[data-message-box="true"]') || targetEl
                      if (bubbleBox) {
                        bubbleBox.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        bubbleBox.classList.add(
                          'ring-2',
                          'ring-brand',
                          'ring-offset-2',
                          'ring-offset-surface-light',
                          'dark:ring-offset-surface-dark',
                          'transition-all',
                          'duration-500',
                          'bg-brand/15',
                          'dark:bg-brand/25'
                        )
                        setTimeout(() => {
                          bubbleBox.classList.remove(
                            'ring-2',
                            'ring-brand',
                            'ring-offset-2',
                            'ring-offset-surface-light',
                            'dark:ring-offset-surface-dark',
                            'bg-brand/15',
                            'dark:bg-brand/25'
                          )
                        }, 1600)
                      }
                    }
                  }}
                >
                  <p className="font-semibold text-brand text-[11px] truncate">
                    {message.replyTo.sender?.displayName || message.replyTo.sender?.username || 'Người dùng'}
                  </p>
                  <p className="text-[11px] text-ink-muted truncate">
                    {message.replyTo.isRecalled
                      ? '[Tin nhắn đã bị thu hồi]'
                      : message.replyTo.type === 'IMAGE'
                      ? '📷 [Hình ảnh]'
                      : message.replyTo.type === 'FILE'
                      ? `📎 [Tệp tin: ${message.replyTo.content}]`
                      : message.replyTo.content}
                  </p>
                </div>
              )}

              {(() => {
                const isImageFileName = (text?: string | null) => {
                  if (!text) return true
                  return /\.(jpe?g|png|webp|gif|svg|bmp)$/i.test(text.trim())
                }
                const hasImageCaption =
                  message.type === 'IMAGE' &&
                  Boolean(message.content) &&
                  !isImageFileName(message.content)

                return (
                  <>
                    {message.type === 'IMAGE' && message.fileUrl && (
                      <div
                        className="rounded-xl overflow-hidden mb-1.5 max-h-80 group/img relative cursor-pointer select-none"
                        data-testid={`image-attachment-${message.id}`}
                        onClick={() => {
                          if (onImageClick) {
                            onImageClick(message.fileUrl!, message.content || undefined)
                          } else {
                            window.open(message.fileUrl || '', '_blank')
                          }
                        }}
                      >
                        <img
                          src={message.fileUrl}
                          alt="Hình ảnh đính kèm"
                          className="w-full max-h-80 object-cover rounded-xl hover:scale-[1.01] transition-transform duration-150"
                          loading="lazy"
                        />
                      </div>
                    )}

                    {/* Tệp tin đính kèm (File Attachment Card Telegram style) */}
                    {message.type === 'FILE' && message.fileUrl && (
                      <div className="mb-1.5 min-w-[220px] max-w-sm">
                        <div
                          className={cn(
                            'flex items-center gap-3 p-2.5 rounded-xl border transition-all duration-150 cursor-pointer group/file select-none',
                            isOutgoing
                              ? 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 hover:bg-black/10 dark:hover:bg-white/10'
                              : 'bg-black/5 dark:bg-white/5 border-border-light dark:border-border-dark hover:bg-black/10 dark:hover:bg-white/10'
                          )}
                          data-testid={`file-attachment-${message.id}`}
                          onClick={(e) =>
                            handleDownloadFile(
                              e,
                              message.fileUrl!,
                              message.content || 'attachment'
                            )
                          }
                          title="Bấm để tải xuống tệp"
                        >
                          {/* Icon phân loại file */}
                          {(() => {
                            const details = getFileDetails(message.content)
                            const IconComponent = details.icon
                            return (
                              <div
                                className={cn(
                                  'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-xs transition-transform group-hover/file:scale-105',
                                  details.bgClass,
                                  details.colorClass
                                )}
                              >
                                <IconComponent className="w-5 h-5" />
                              </div>
                            )
                          })()}

                          {/* Thông tin tên file, loại file & dung lượng */}
                          <div className="flex-1 min-w-0 pr-1">
                            <p
                              className="text-xs font-semibold truncate text-ink-primary dark:text-ink-primary-dark group-hover/file:text-brand transition-colors"
                              title={message.content}
                            >
                              {message.content || 'Tệp đính kèm'}
                            </p>
                            <p className="text-[11px] text-ink-muted select-none mt-0.5 flex items-center gap-1.5">
                              <span>{getFileDetails(message.content).extLabel}</span>
                              {message.fileSize ? (
                                <>
                                  <span className="opacity-60">•</span>
                                  <span className="font-medium text-ink-secondary dark:text-ink-secondary-dark">
                                    {formatFileSize(message.fileSize)}
                                  </span>
                                </>
                              ) : null}
                            </p>
                          </div>

                          {/* Nút tải về máy (Download Action) */}
                          <button
                            type="button"
                            title="Tải tệp xuống"
                            aria-label="Tải tệp xuống"
                            className="w-8 h-8 rounded-full bg-brand text-white flex items-center justify-center shrink-0 hover:bg-brand-hover hover:scale-110 active:scale-95 transition-all shadow-xs cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDownloadFile(
                                e,
                                message.fileUrl!,
                                message.content || 'attachment'
                              )
                            }}
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Layout Telegram Inline: chữ và thời gian cùng hàng nếu chữ ngắn */}
                    <div className="flex flex-wrap items-end gap-x-2.5 gap-y-1">
                      {message.type !== 'FILE' &&
                        (message.type !== 'IMAGE' || hasImageCaption) &&
                        message.content && (
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
                  </>
                )
              })()}
            </div>
          )}
        </div>

        {/* Thanh thao tác micro-actions nằm BÊN PHẢI của bong bóng nhận đến (Incoming) */}
        {!isOutgoing && renderToolbar()}
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
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in duration-150" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white dark:bg-[#17212B] text-ink-primary dark:text-white border border-border dark:border-white/10 p-6 rounded-2xl shadow-2xl z-50 animate-in zoom-in-95 duration-150 focus:outline-none">
            <Dialog.Title className="text-lg font-bold text-ink-primary dark:text-white">
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
                className="bg-coral hover:bg-coral/90 text-white cursor-pointer"
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

