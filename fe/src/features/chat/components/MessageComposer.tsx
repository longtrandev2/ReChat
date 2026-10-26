import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Paperclip, Smile, X, Pencil, Loader2, Check, Reply } from 'lucide-react'
import { toast } from 'sonner'
import { socketClient } from '@/services/socket.client'
import { mediaApi } from '../services/media.api'
import { useMessagesStore } from '../stores/messages.store'

interface MessageComposerProps {
  conversationId: string
  onSendMessage: (content: string, replyToId?: string) => void | Promise<void>
  onEditMessage?: (messageId: string, content: string) => void | Promise<void>
  disabled?: boolean
}

/**
 * MessageComposer: Thanh soạn thảo tin nhắn Telegram với Textarea co giãn tự động và Debounce Typing
 * - Enter để gửi, Shift+Enter để xuống dòng
 * - Co giãn tự động 1-5 dòng (max 120px)
 * - Tự động phát socket 'typing' kèm debounce 2.5s
 * - Nút đính kèm ảnh (max 5MB) và tệp tin (max 25MB) lên Cloudinary
 * - Chế độ Chỉnh sửa tin nhắn (Edit Mode) kèm Banner và nút Hủy
 */
export function MessageComposer({
  conversationId,
  onSendMessage,
  onEditMessage,
  disabled = false,
}: MessageComposerProps) {
  const [content, setContent] = useState('')
  const [prevEditingId, setPrevEditingId] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadPercent, setUploadPercent] = useState(0)

  const {
    editingMessage,
    setEditingMessage,
    replyingMessage,
    setReplyingMessage,
  } = useMessagesStore()

  // Đồng bộ nội dung tin nhắn sửa trong quá trình render (React 19 idiomatic pattern)
  if (editingMessage && editingMessage.id !== prevEditingId) {
    setPrevEditingId(editingMessage.id)
    setContent(editingMessage.content)
  } else if (!editingMessage && prevEditingId !== null) {
    setPrevEditingId(null)
  }

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Tự động focus textarea khi bấm trả lời
  useEffect(() => {
    if (replyingMessage) {
      textareaRef.current?.focus()
    }
  }, [replyingMessage])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>(
    -1 as unknown as ReturnType<typeof setTimeout>
  )
  const isTypingActiveRef = useRef<boolean>(false)

  // Điều chỉnh chiều cao textarea theo nội dung gõ
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const maxHeight = 120 // ~5 dòng
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
  }, [])

  // Auto focus & auto resize textarea khi chuyển sang chế độ sửa
  useEffect(() => {
    if (editingMessage) {
      adjustHeight()
      textareaRef.current?.focus()
    }
  }, [editingMessage, adjustHeight])

  const handleCancelEdit = () => {
    setEditingMessage(null)
    setContent('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  // Xử lý gửi tin nhắn hoặc lưu chỉnh sửa
  const handleSend = async () => {
    const trimmed = content.trim()
    if (!trimmed || isSending || disabled || isUploading) return

    // Hủy trạng thái typing ngay khi ấn gửi
    if (typingTimeoutRef.current !== -1) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = -1 as unknown as ReturnType<typeof setTimeout>
    }
    if (isTypingActiveRef.current) {
      isTypingActiveRef.current = false
      socketClient.getSocket()?.emit('typing', { conversationId, isTyping: false })
    }

    if (editingMessage) {
      const msgId = editingMessage.id
      setEditingMessage(null)
      setContent('')
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
      if (onEditMessage) {
        await onEditMessage(msgId, trimmed)
      }
      return
    }

    const replyId = replyingMessage?.id
    if (replyingMessage) {
      setReplyingMessage(null)
    }

    setContent('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.focus()
    }

    try {
      setIsSending(true)
      if (replyId) {
        await onSendMessage(trimmed, replyId)
      } else {
        await onSendMessage(trimmed)
      }
    } finally {
      setIsSending(false)
    }
  }

  // Xử lý chọn tệp đính kèm và upload lên Cloudinary
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const isImage = file.type.startsWith('image/')
    const maxSizeBytes = isImage ? 5 * 1024 * 1024 : 25 * 1024 * 1024
    if (file.size > maxSizeBytes) {
      toast.error(
        isImage
          ? 'Kích thước ảnh không được vượt quá 5MB'
          : 'Kích thước tệp không được vượt quá 25MB'
      )
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    try {
      setIsUploading(true)
      setUploadPercent(0)
      await mediaApi.uploadMedia(file, conversationId, (percent) => {
        setUploadPercent(percent)
      })
      toast.success(isImage ? 'Đã tải ảnh lên thành công' : 'Đã gửi tệp đính kèm')
    } catch {
      toast.error('Không thể tải tệp lên. Vui lòng thử lại.')
    } finally {
      setIsUploading(false)
      setUploadPercent(0)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Lắng nghe thay đổi nội dung và phát socket typing (debounce 2.5s)
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value)
    adjustHeight()

    const socket = socketClient.getSocket()
    if (!socket || !conversationId) return

    if (!isTypingActiveRef.current) {
      isTypingActiveRef.current = true
      socket.emit('typing', { conversationId, isTyping: true })
    }

    if (typingTimeoutRef.current !== -1) {
      clearTimeout(typingTimeoutRef.current)
    }

    typingTimeoutRef.current = setTimeout(() => {
      isTypingActiveRef.current = false
      socket.emit('typing', { conversationId, isTyping: false })
      typingTimeoutRef.current = -1 as unknown as ReturnType<typeof setTimeout>
    }, 2500)
  }

  // Xử lý phím tắt Enter vs Shift+Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Dọn dẹp timer typing khi đổi phòng chat hoặc unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current !== -1) {
        clearTimeout(typingTimeoutRef.current)
        const socket = socketClient.getSocket()
        if (socket && conversationId && isTypingActiveRef.current) {
          socket.emit('typing', { conversationId, isTyping: false })
        }
      }
    }
  }, [conversationId])

  const canSend =
    content.trim().length > 0 && !isSending && !disabled && !isUploading

  return (
    <div
      className="p-3 md:pb-4 max-w-3xl mx-auto w-full flex flex-col gap-1 shrink-0 z-10 select-none"
      data-testid="message-composer"
    >
      {/* Banner chế độ trả lời tin nhắn */}
      {replyingMessage && !editingMessage && (
        <div
          className="flex items-center justify-between px-4 py-2 rounded-xl bg-surface-light dark:bg-[#1E2C3A] border-l-4 border-l-brand border border-border-light dark:border-border-dark text-xs text-ink-primary dark:text-ink-primary-dark shadow-xs animate-in fade-in slide-in-from-bottom-1 duration-150"
          data-testid="reply-banner"
        >
          <div className="flex items-center gap-2 truncate">
            <Reply className="w-3.5 h-3.5 text-brand shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-brand text-[11px]">
                Đang trả lời {replyingMessage.sender?.displayName || replyingMessage.sender?.username}
              </span>
              <span className="truncate text-ink-secondary dark:text-ink-secondary-dark text-[11px]">
                {replyingMessage.type === 'IMAGE'
                  ? '📷 [Hình ảnh]'
                  : replyingMessage.type === 'FILE'
                  ? `📎 [Tệp tin: ${replyingMessage.content}]`
                  : replyingMessage.content}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setReplyingMessage(null)}
            title="Hủy bỏ trả lời"
            aria-label="Hủy bỏ trả lời"
            className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-ink-muted hover:text-coral transition-colors shrink-0 ml-2 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Banner chế độ chỉnh sửa tin nhắn */}
      {editingMessage && (
        <div className="flex items-center justify-between px-4 py-1.5 rounded-xl bg-brand/10 dark:bg-brand/20 border border-brand/30 text-xs text-ink-primary dark:text-ink-primary-dark animate-in fade-in slide-in-from-bottom-1 duration-150">
          <div className="flex items-center gap-2 truncate">
            <Pencil className="w-3.5 h-3.5 text-brand shrink-0" />
            <span className="font-semibold text-brand">Đang chỉnh sửa:</span>
            <span className="truncate italic text-ink-secondary dark:text-ink-secondary-dark">
              {editingMessage.content}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCancelEdit}
            title="Hủy bỏ chỉnh sửa"
            aria-label="Hủy bỏ chỉnh sửa"
            className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-ink-muted hover:text-coral transition-colors shrink-0 ml-2 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2 w-full">
        {/* Input file ẩn */}
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileChange}
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.txt"
          className="hidden"
          data-testid="file-upload-input"
        />

        {/* Khung nhập văn bản dạng con nhộng (Pill Capsule) */}
        <div className="flex-1 flex items-end rounded-3xl bg-surface-light dark:bg-[#17212B] px-3.5 py-1.5 border border-border-light/80 dark:border-border-dark shadow-xs focus-within:ring-2 focus-within:ring-brand/30 focus-within:border-brand focus-within:shadow-[0_0_0_3px_rgba(42,171,238,0.12)] transition-all">
          {/* Nút đính kèm tệp */}
          <button
            type="button"
            aria-label="Đính kèm tệp"
            title={
              isUploading
                ? `Đang tải lên ${uploadPercent}%...`
                : 'Đính kèm tệp hoặc ảnh'
            }
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isUploading}
            className="p-1.5 text-ink-secondary dark:text-ink-secondary-dark hover:text-brand dark:hover:text-brand-accent hover:bg-brand-soft/50 dark:hover:bg-white/5 rounded-full transition-all duration-150 hover:rotate-12 hover:scale-110 active:scale-90 disabled:opacity-40 mb-0.5 cursor-pointer"
          >
            {isUploading ? (
              <Loader2 className="w-5 h-5 animate-spin text-brand" />
            ) : (
              <Paperclip className="w-5 h-5 transition-transform" />
            )}
          </button>

          {/* Textarea nhập tin nhắn co giãn */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={disabled || isUploading}
            placeholder={
              editingMessage
                ? 'Nhập nội dung chỉnh sửa...'
                : 'Soạn tin nhắn...'
            }
            rows={1}
            className="flex-1 bg-transparent text-sm resize-none outline-none text-ink-primary dark:text-ink-primary-dark placeholder:text-ink-muted max-h-[140px] leading-relaxed py-1.5 px-2 select-text"
            aria-label="Nội dung tin nhắn"
          />

          {/* Nút biểu tượng cảm xúc */}
          <button
            type="button"
            aria-label="Chọn biểu tượng cảm xúc"
            title="Biểu tượng cảm xúc"
            disabled={disabled || isUploading}
            onClick={() => setContent((prev) => prev + ' 😊')}
            className="p-1.5 text-ink-secondary dark:text-ink-secondary-dark hover:text-amber-500 dark:hover:text-amber-400 hover:scale-115 active:scale-90 transition-all duration-150 disabled:opacity-40 mb-0.5 cursor-pointer"
          >
            <Smile className="w-5 h-5 transition-transform" />
          </button>
        </div>

        {/* Nút gửi tin nhắn / lưu chỉnh sửa */}
        <button
          type="button"
          aria-label={editingMessage ? 'Lưu chỉnh sửa' : 'Gửi tin nhắn'}
          title={
            editingMessage
              ? 'Lưu chỉnh sửa (Enter)'
              : 'Gửi tin nhắn (Enter)'
          }
          onClick={handleSend}
          disabled={!canSend}
          className="w-11 h-11 rounded-full bg-brand text-white flex items-center justify-center shrink-0 hover:bg-brand-hover hover:scale-105 active:scale-95 transition-all duration-150 shadow-md hover:shadow-brand/25 disabled:opacity-40 disabled:hover:bg-brand disabled:hover:scale-100 disabled:active:scale-100 disabled:shadow-none group cursor-pointer"
        >
          {editingMessage ? (
            <Check className="w-5 h-5 transition-transform duration-150 group-hover:scale-110" />
          ) : (
            <Send className="w-5 h-5 ml-0.5 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          )}
        </button>
      </div>
    </div>
  )
}

