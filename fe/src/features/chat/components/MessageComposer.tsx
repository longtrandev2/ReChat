import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Paperclip, Smile } from 'lucide-react'
import { socketClient } from '@/services/socket.client'

interface MessageComposerProps {
  conversationId: string
  onSendMessage: (content: string) => void | Promise<void>
  disabled?: boolean
}

/**
 * MessageComposer: Thanh soạn thảo tin nhắn Telegram với Textarea co giãn tự động và Debounce Typing
 * - Enter để gửi, Shift+Enter để xuống dòng
 * - Co giãn tự động 1-5 dòng (max 120px)
 * - Tự động phát socket 'typing' kèm debounce 2.5s
 */
export function MessageComposer({
  conversationId,
  onSendMessage,
  disabled = false,
}: MessageComposerProps) {
  const [content, setContent] = useState('')
  const [isSending, setIsSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>(-1 as unknown as ReturnType<typeof setTimeout>)
  const isTypingActiveRef = useRef<boolean>(false)

  // Điều chỉnh chiều cao textarea theo nội dung gõ
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const maxHeight = 120 // ~5 dòng
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
  }, [])

  // Xử lý gửi tin nhắn
  const handleSend = async () => {
    const trimmed = content.trim()
    if (!trimmed || isSending || disabled) return

    // Hủy trạng thái typing ngay khi ấn gửi
    if (typingTimeoutRef.current !== -1) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = -1 as unknown as ReturnType<typeof setTimeout>
    }
    if (isTypingActiveRef.current) {
      isTypingActiveRef.current = false
      socketClient.getSocket()?.emit('typing', { conversationId, isTyping: false })
    }

    setContent('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.focus()
    }

    try {
      setIsSending(true)
      await onSendMessage(trimmed)
    } finally {
      setIsSending(false)
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

  const canSend = content.trim().length > 0 && !isSending && !disabled

  return (
    <div
      className="p-3 md:pb-4 max-w-3xl mx-auto w-full flex items-end gap-2 shrink-0 z-10 select-none"
      data-testid="message-composer"
    >
      {/* Khung nhập văn bản dạng con nhộng (Pill Capsule) */}
      <div className="flex-1 flex items-end rounded-3xl bg-surface-light dark:bg-[#17212B] px-3.5 py-1.5 border border-border-light/80 dark:border-border-dark shadow-xs focus-within:ring-2 focus-within:ring-brand/30 focus-within:border-brand focus-within:shadow-[0_0_0_3px_rgba(42,171,238,0.12)] transition-all">
        {/* Nút đính kèm tệp */}
        <button
          type="button"
          aria-label="Đính kèm tệp"
          title="Đính kèm tệp hoặc ảnh"
          disabled={disabled}
          className="p-1.5 text-ink-secondary dark:text-ink-secondary-dark hover:text-brand dark:hover:text-brand-accent hover:bg-brand-soft/50 dark:hover:bg-white/5 rounded-full transition-all duration-150 hover:rotate-12 hover:scale-110 active:scale-90 disabled:opacity-40 mb-0.5 cursor-pointer"
        >
          <Paperclip className="w-5 h-5 transition-transform" />
        </button>

        {/* Textarea nhập tin nhắn co giãn */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Soạn tin nhắn..."
          rows={1}
          className="flex-1 bg-transparent text-sm resize-none outline-none text-ink-primary dark:text-ink-primary-dark placeholder:text-ink-muted max-h-[140px] leading-relaxed py-1.5 px-2 select-text"
          aria-label="Nội dung tin nhắn"
        />

        {/* Nút biểu tượng cảm xúc */}
        <button
          type="button"
          aria-label="Chọn biểu tượng cảm xúc"
          title="Biểu tượng cảm xúc"
          disabled={disabled}
          className="p-1.5 text-ink-secondary dark:text-ink-secondary-dark hover:text-amber-500 dark:hover:text-amber-400 hover:scale-115 active:scale-90 transition-all duration-150 disabled:opacity-40 mb-0.5 cursor-pointer"
        >
          <Smile className="w-5 h-5 transition-transform" />
        </button>
      </div>

      {/* Nút gửi tin nhắn hình tròn (Telegram Brand Blue Circle) */}
      <button
        type="button"
        aria-label="Gửi tin nhắn"
        title="Gửi tin nhắn (Enter)"
        onClick={handleSend}
        disabled={!canSend}
        className="w-11 h-11 rounded-full bg-brand text-white flex items-center justify-center shrink-0 hover:bg-brand-hover hover:scale-105 active:scale-95 transition-all duration-150 shadow-md hover:shadow-brand/25 disabled:opacity-40 disabled:hover:bg-brand disabled:hover:scale-100 disabled:active:scale-100 disabled:shadow-none group cursor-pointer"
      >
        <Send className="w-5 h-5 ml-0.5 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </button>
    </div>
  )
}
