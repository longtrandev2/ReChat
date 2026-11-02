import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, ChevronUp, ChevronDown, X, Loader2 } from 'lucide-react'
import { conversationApi } from '@/features/conversations/services/conversation.api'
import type { Message } from '../types/message.types'

export interface InChatSearchBarProps {
  conversationId: string
  onJumpToMessage: (messageId: string) => void
  onClose: () => void
  onQueryChange?: (query: string) => void
}

/**
 * InChatSearchBar: Thanh tìm kiếm tin nhắn nổi chuẩn Telegram / Messenger
 * - Đặt cố định phía trên Message Feed
 * - Debounce 300ms gọi API searchMessages
 * - Hiển thị "X / Y" kết quả tìm thấy
 * - Nút Prev/Next hoặc Enter/Shift+Enter để duyệt qua lại các kết quả
 * - Nút X hoặc phím ESC để đóng
 */
export function InChatSearchBar({
  conversationId,
  onJumpToMessage,
  onClose,
  onQueryChange,
}: InChatSearchBarProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Message[]>([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [isSearching, setIsSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Tự động focus vào ô input khi component xuất hiện & cleanup search khi unmount
  useEffect(() => {
    inputRef.current?.focus()
    return () => {
      onQueryChange?.('')
    }
  }, [onQueryChange])

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    onQueryChange?.(val)
    if (!val.trim()) {
      setResults([])
      setCurrentIndex(-1)
      setIsSearching(false)
    }
  }

  // Xử lý tìm kiếm debounce 300ms
  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const data = await conversationApi.searchMessages(conversationId, trimmed)
        setResults(data)
        if (data.length > 0) {
          // Mặc định chọn kết quả mới nhất (ở cuối danh sách nếu ASC, hoặc đầu danh sách)
          const targetIndex = data.length - 1
          setCurrentIndex(targetIndex)
          onJumpToMessage(data[targetIndex].id)
        } else {
          setCurrentIndex(-1)
        }
      } catch (err) {
        console.error('Lỗi tìm kiếm tin nhắn:', err)
        setResults([])
        setCurrentIndex(-1)
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [conversationId, query, onJumpToMessage])

  // Điều hướng kết quả trước (cũ hơn trong lịch sử)
  const handlePrev = useCallback(() => {
    if (results.length === 0) return
    const nextIdx = (currentIndex - 1 + results.length) % results.length
    setCurrentIndex(nextIdx)
    onJumpToMessage(results[nextIdx].id)
  }, [currentIndex, results, onJumpToMessage])

  // Điều hướng kết quả tiếp theo (mới hơn trong lịch sử)
  const handleNext = useCallback(() => {
    if (results.length === 0) return
    const nextIdx = (currentIndex + 1) % results.length
    setCurrentIndex(nextIdx)
    onJumpToMessage(results[nextIdx].id)
  }, [currentIndex, results, onJumpToMessage])

  // Bắt phím tắt ESC, Enter, Shift+Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onQueryChange?.('')
      onClose()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) {
        handlePrev()
      } else {
        handleNext()
      }
    }
  }

  const handleClear = () => {
    setQuery('')
    setResults([])
    setCurrentIndex(-1)
    onQueryChange?.('')
    inputRef.current?.focus()
  }

  return (
    <div
      className="sticky top-0 z-20 px-3 py-2 bg-surface-light/95 dark:bg-[#17212B]/95 backdrop-blur-md border-b border-border-light/60 dark:border-border-dark shadow-xs flex items-center justify-between gap-2 transition-all animate-in slide-in-from-top-2 duration-200"
      data-testid="in-chat-search-bar"
    >
      <div className="flex-1 flex items-center gap-2 bg-surface-light-2 dark:bg-[#242F3D] rounded-xl px-3 py-1.5 border border-transparent focus-within:border-brand/40 dark:focus-within:border-brand-accent/40 transition-colors">
        {isSearching ? (
          <Loader2 className="w-4 h-4 text-brand animate-spin shrink-0" data-testid="in-chat-search-loading" />
        ) : (
          <Search className="w-4 h-4 text-ink-secondary dark:text-ink-secondary-dark shrink-0" />
        )}

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleQueryChange}
          onKeyDown={handleKeyDown}
          placeholder="Tìm kiếm trong cuộc trò chuyện..."
          aria-label="Tìm kiếm trong cuộc trò chuyện"
          className="flex-1 bg-transparent text-xs sm:text-sm text-ink-primary dark:text-white placeholder:text-ink-muted focus:outline-hidden min-w-0"
          data-testid="in-chat-search-input"
        />

        {query && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Xóa từ khóa tìm kiếm"
            className="p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-ink-muted hover:text-ink-primary dark:hover:text-white transition-colors cursor-pointer"
            data-testid="in-chat-search-clear"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {/* Kết quả đếm */}
        {query.trim() && (
          <div
            className="px-2 py-1 text-xs text-ink-secondary dark:text-ink-secondary-dark select-none"
            data-testid="in-chat-search-counter"
          >
            {results.length > 0 ? (
              <span>
                {currentIndex + 1} / {results.length}
              </span>
            ) : !isSearching ? (
              <span className="text-ink-muted">Không tìm thấy</span>
            ) : null}
          </div>
        )}

        {/* Nút lùi về kết quả trước */}
        <button
          type="button"
          onClick={handlePrev}
          disabled={results.length === 0}
          title="Kết quả trước (Shift+Enter)"
          aria-label="Kết quả trước"
          className="p-1.5 rounded-lg text-ink-secondary dark:text-ink-secondary-dark hover:bg-surface-hover dark:hover:bg-white/10 hover:text-ink-primary dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          data-testid="in-chat-search-prev"
        >
          <ChevronUp className="w-4 h-4" />
        </button>

        {/* Nút tiến tới kết quả kế tiếp */}
        <button
          type="button"
          onClick={handleNext}
          disabled={results.length === 0}
          title="Kết quả tiếp theo (Enter)"
          aria-label="Kết quả tiếp theo"
          className="p-1.5 rounded-lg text-ink-secondary dark:text-ink-secondary-dark hover:bg-surface-hover dark:hover:bg-white/10 hover:text-ink-primary dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          data-testid="in-chat-search-next"
        >
          <ChevronDown className="w-4 h-4" />
        </button>

        {/* Nút đóng thanh tìm kiếm */}
        <button
          type="button"
          onClick={() => {
            onQueryChange?.('')
            onClose()
          }}
          title="Đóng tìm kiếm (ESC)"
          aria-label="Đóng tìm kiếm"
          className="p-1.5 rounded-lg text-ink-secondary dark:text-ink-secondary-dark hover:bg-surface-hover dark:hover:bg-white/10 hover:text-ink-primary dark:hover:text-white transition-colors"
          data-testid="in-chat-search-close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
