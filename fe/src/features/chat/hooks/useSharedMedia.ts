import { useState, useEffect, useCallback } from 'react'
import { messagesApi } from '../services/messages.api'
import type { Message, MessageType } from '../types/message.types'

export interface UseSharedMediaOptions {
  conversationId: string
  type: MessageType
  enabled?: boolean
  limit?: number
}

export interface UseSharedMediaResult {
  items: Message[]
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  error: string | null
  loadMore: () => Promise<void>
  refetch: () => Promise<void>
  prependItem: (item: Message) => void
}

/**
 * useSharedMedia: Hook phân trang độc lập cho Shared Media / Files trong Chat Detail Drawer
 * - Không phụ thuộc vào luồng chat 30 tin chính
 * - Tự động tải theo cursor `before` khi cuộn (Infinite Scroll)
 * - Hiển thị thứ tự mới nhất ở trên cùng
 * - Tuân thủ nghiêm ngặt chuẩn React 19 (không synchronous setState trong effect, không ref trong render)
 */
export function useSharedMedia({
  conversationId,
  type,
  enabled = true,
  limit = 30,
}: UseSharedMediaOptions): UseSharedMediaResult {
  const [items, setItems] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(() => enabled && Boolean(conversationId))
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false)
  const [hasMore, setHasMore] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Tải dữ liệu ban đầu khi mở hoặc khi đổi phòng/filter
  const fetchInitial = useCallback(async () => {
    if (!enabled || !conversationId) return

    setIsLoading(true)
    setError(null)
    try {
      const data = await messagesApi.getMessages(conversationId, {
        type,
        limit,
      })

      const safeData = Array.isArray(data) ? data : []
      // Backend trả về ASC (cũ -> mới). Trong Gallery cần hiển thị Mới nhất -> Cũ dần.
      const reversed = [...safeData].reverse()
      setItems(reversed)
      setHasMore(safeData.length >= limit)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Lỗi tải dữ liệu')
      setHasMore(false)
    } finally {
      setIsLoading(false)
    }
  }, [conversationId, type, enabled, limit])

  useEffect(() => {
    let isCancelled = false

    if (!enabled || !conversationId) {
      setIsLoading(false)
      setItems([])
      return
    }

    const load = async () => {
      try {
        const data = await messagesApi.getMessages(conversationId, {
          type,
          limit,
        })
        if (isCancelled) return

        const safeData = Array.isArray(data) ? data : []
        const reversed = [...safeData].reverse()
        setItems(reversed)
        setHasMore(safeData.length >= limit)
        setError(null)
      } catch (err: unknown) {
        if (isCancelled) return
        setError(err instanceof Error ? err.message : 'Lỗi tải dữ liệu')
        setHasMore(false)
        setItems([])
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      isCancelled = true
    }
  }, [conversationId, type, enabled, limit])

  // Lấy các trang cũ hơn khi người dùng cuộn xuống dưới
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading || isLoadingMore || items.length === 0 || !conversationId) {
      return
    }

    const oldestItem = items[items.length - 1]
    if (!oldestItem) return

    setIsLoadingMore(true)
    try {
      const olderData = await messagesApi.getMessages(conversationId, {
        type,
        limit,
        before: oldestItem.id,
      })

      const safeOlder = Array.isArray(olderData) ? olderData : []
      if (safeOlder.length > 0) {
        const reversedOlder = [...safeOlder].reverse()
        setItems((prev) => [...prev, ...reversedOlder])
      }

      setHasMore(safeOlder.length >= limit)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Lỗi tải thêm dữ liệu')
    } finally {
      setIsLoadingMore(false)
    }
  }, [hasMore, isLoading, isLoadingMore, items, conversationId, type, limit])

  // Bổ sung tức thì tin nhắn mới nhận qua WebSocket
  const prependItem = useCallback(
    (newItem: Message) => {
      if (newItem.type === type && !newItem.isRecalled) {
        setItems((prev) => {
          if (prev.some((m) => m.id === newItem.id)) return prev
          return [newItem, ...prev]
        })
      }
    },
    [type]
  )

  return {
    items,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
    refetch: fetchInitial,
    prependItem,
  }
}
