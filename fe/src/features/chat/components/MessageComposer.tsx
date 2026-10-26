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
      className="px-4 py-3 border-t border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark flex items-end gap-2 shrink-0 z-10 select-none"
      data-testid="message-composer"
    >
      {/* Nút đính kèm tệp */}
      <button
        type="button"
        aria-label="Đính kèm tệp"
        disabled={disabled}
        className="p-2 text-ink-secondary dark:text-ink-secondary-dark hover:bg-surface-hover dark:hover:bg-surface-dark-secondary rounded-xl transition-colors disabled:opacity-40"
      >
        <Paperclip className="w-5 h-5" />
      </button>

      {/* Khung nhập văn bản */}
      <div className="flex-1 flex items-end rounded-2xl bg-canvas-light dark:bg-canvas-dark px-3 py-1.5 border border-border-light/60 dark:border-border-dark focus-within:border-brand dark:focus-within:border-brand-accent transition-colors">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Soạn tin nhắn..."
          rows={1}
          className="flex-1 bg-transparent text-sm resize-none outline-none text-ink-primary dark:text-ink-primary-dark placeholder:text-ink-muted max-h-[120px] leading-relaxed py-1 select-text"
          aria-label="Nội dung tin nhắn"
        />
        <button
          type="button"
          aria-label="Chọn biểu tượng cảm xúc"
          disabled={disabled}
          className="p-1 text-ink-secondary dark:text-ink-secondary-dark hover:text-brand dark:hover:text-brand-accent transition-colors disabled:opacity-40 mb-0.5"
        >
          <Smile className="w-5 h-5" />
        </button>
      </div>

      {/* Nút gửi tin nhắn (Telegram Brand Blue) */}
      <button
        type="button"
        aria-label="Gửi tin nhắn"
        onClick={handleSend}
        disabled={!canSend}
        className="w-9 h-9 rounded-full bg-brand text-white flex items-center justify-center shrink-0 hover:bg-brand-hover active:scale-95 transition-all shadow-subtle disabled:opacity-40 disabled:hover:bg-brand disabled:active:scale-100"
      >
        <Send className="w-4 h-4 ml-0.5" />
      </button>
    </div>
  )
}
