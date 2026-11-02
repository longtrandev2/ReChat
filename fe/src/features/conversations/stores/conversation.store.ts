import { create } from 'zustand'
import { conversationApi } from '../services/conversation.api'
import type { Conversation, LastMessage } from '../types/conversation.types'

export type FilterTab = 'all' | 'unread' | 'group'

export interface ConversationState {
  conversations: Conversation[]
  activeConversationId: string | null
  searchQuery: string
  filterTab: FilterTab
  isLoading: boolean
  error: string | null

  // Actions
  fetchInbox: () => Promise<void>
  setActiveConversation: (id: string | null) => void
  setSearchQuery: (query: string) => void
  setFilterTab: (tab: FilterTab) => void
  addOrUpdateConversation: (conversation: Conversation) => void
  updateConversation: (id: string, partial: Partial<Conversation>) => void
  removeConversation: (conversationId: string) => void
  setPinned: (conversationId: string, isPinned: boolean) => Promise<void>
  handleNewMessage: (conversationId: string, message: LastMessage, isSelf?: boolean) => void
  markConversationAsRead: (conversationId: string) => Promise<void>
  getFilteredConversations: () => Conversation[]
  reset: () => void
}

const sortByRecency = (convs: Conversation[]): Conversation[] => {
  return [...convs].sort((a, b) => {
    const timeA = new Date(a.lastMessageAt || a.updatedAt || a.createdAt).getTime()
    const timeB = new Date(b.lastMessageAt || b.updatedAt || b.createdAt).getTime()
    return timeB - timeA
  })
}

/** Ghim lên đầu (mới ghim trước), phần còn lại giữ thứ tự hiện có (FR-48) */
const pinnedFirst = (convs: Conversation[]): Conversation[] => {
  const pinned = convs
    .filter((c) => c.isPinned)
    .sort((a, b) => new Date(b.pinnedAt || 0).getTime() - new Date(a.pinnedAt || 0).getTime())
  return [...pinned, ...convs.filter((c) => !c.isPinned)]
}

const sortConversations = (convs: Conversation[]): Conversation[] =>
  pinnedFirst(sortByRecency(convs))

const restoringIds = new Set<string>()

/** Tải chi tiết hội thoại chưa có trong store và chèn vào inbox với tin nhắn mới nhất (BR-42) */
async function restoreMissingConversation(
  conversationId: string,
  message: LastMessage,
  isSelf: boolean,
  get: () => ConversationState,
  set: (fn: (s: ConversationState) => Partial<ConversationState>) => void
): Promise<void> {
  if (restoringIds.has(conversationId)) return
  restoringIds.add(conversationId)
  try {
    const detail = await conversationApi.getConversationById(conversationId)
    if (!detail) return
    const isActive = get().activeConversationId === conversationId
    set((state) => {
      const entry: Conversation = {
        ...detail,
        lastMessage: message,
        lastMessageAt: message.createdAt,
        unreadCount: isSelf || isActive ? 0 : Math.max(1, detail.unreadCount ?? 0),
      }
      const exists = state.conversations.some((c) => c.id === conversationId)
      const next = exists
        ? state.conversations.map((c) => (c.id === conversationId ? { ...c, ...entry } : c))
        : [entry, ...state.conversations]
      return { conversations: sortConversations(next) }
    })
  } catch {
    // Không tải được chi tiết: bỏ qua, inbox sẽ đồng bộ ở lần fetch kế tiếp
  } finally {
    restoringIds.delete(conversationId)
  }
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  searchQuery: '',
  filterTab: 'all',
  isLoading: false,
  error: null,

  fetchInbox: async () => {
    try {
      set({ isLoading: true, error: null })
      const data = await conversationApi.getInbox()
      set((state) => {
        const existingById = new Map(state.conversations.map((c) => [c.id, c]))
        // Merge thay vì replace: giữ trường chi tiết (members...) mà inbox không có (tránh race với getConversationById)
        const merged = data.map((item) => {
          const existing = existingById.get(item.id)
          const next: Conversation = existing
            ? { ...existing, ...item, members: item.members ?? existing.members }
            : item
          // Phòng đang mở luôn coi là đã đọc, kể cả khi inbox trả số cũ (BR-10)
          return item.id === state.activeConversationId ? { ...next, unreadCount: 0 } : next
        })
        return { conversations: sortConversations(merged), isLoading: false }
      })
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Không thể tải danh sách cuộc trò chuyện'
      set({
        error: errorMsg,
        isLoading: false,
      })
    }
  },

  setActiveConversation: (id: string | null) => {
    set({ activeConversationId: id })
    if (id) {
      // Khi người dùng chọn phòng chat, tự động đánh dấu đã đọc
      get().markConversationAsRead(id)
    }
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query })
  },

  setFilterTab: (tab: FilterTab) => {
    set({ filterTab: tab })
  },

  addOrUpdateConversation: (incoming: Conversation) => {
    set((state) => {
      const existing = state.conversations.find((c) => c.id === incoming.id)
      let nextList: Conversation[]

      if (existing) {
        nextList = state.conversations.map((c) =>
          c.id === incoming.id ? { ...c, ...incoming } : c
        )
      } else {
        nextList = [incoming, ...state.conversations]
      }

      return {
        conversations: sortConversations(nextList),
      }
    })
  },

  updateConversation: (id: string, partial: Partial<Conversation>) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, ...partial } : c
      ),
    }))
  },

  removeConversation: (conversationId: string) => {
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== conversationId),
      activeConversationId:
        state.activeConversationId === conversationId ? null : state.activeConversationId,
    }))
  },

  handleNewMessage: (conversationId: string, message: LastMessage, isSelf = false) => {
    set((state) => {
      const target = state.conversations.find((c) => c.id === conversationId)
      if (!target) {
        // Hội thoại chưa có trong inbox (vd đã "Xóa đoạn chat" - BR-42): tải chi tiết rồi chèn lại
        void restoreMissingConversation(conversationId, message, isSelf, get, set)
        return state
      }

      const isActive = state.activeConversationId === conversationId
      const newUnreadCount = isSelf || isActive ? target.unreadCount : target.unreadCount + 1

      const updated: Conversation = {
        ...target,
        lastMessage: message,
        lastMessageAt: message.createdAt,
        unreadCount: newUnreadCount,
      }

      const rest = state.conversations.filter((c) => c.id !== conversationId)
      return {
        conversations: pinnedFirst([updated, ...rest]),
      }
    })
  },

  /**
   * Ghim/bỏ ghim lạc quan: cập nhật UI ngay, rollback khi API lỗi (vd 400 khi quá 5 ghim) và ném lại lỗi
   */
  setPinned: async (conversationId: string, isPinned: boolean) => {
    const previous = get().conversations
    const target = previous.find((c) => c.id === conversationId)
    if (!target) return

    const optimisticPinnedAt = isPinned ? new Date().toISOString() : null
    set({
      conversations: sortConversations(
        previous.map((c) =>
          c.id === conversationId ? { ...c, isPinned, pinnedAt: optimisticPinnedAt } : c
        )
      ),
    })

    try {
      const res = await conversationApi.togglePin(conversationId, isPinned)
      set((state) => ({
        conversations: sortConversations(
          state.conversations.map((c) =>
            c.id === conversationId
              ? { ...c, isPinned: res.isPinned, pinnedAt: res.pinnedAt }
              : c
          )
        ),
      }))
    } catch (err) {
      // Rollback đúng trạng thái ghim cũ của hội thoại này (giữ nguyên thay đổi khác từ socket)
      set((state) => ({
        conversations: sortConversations(
          state.conversations.map((c) =>
            c.id === conversationId
              ? { ...c, isPinned: target.isPinned, pinnedAt: target.pinnedAt }
              : c
          )
        ),
      }))
      throw err
    }
  },

  markConversationAsRead: async (conversationId: string) => {
    const target = get().conversations.find((c) => c.id === conversationId)
    // Nếu cuộc trò chuyện đã có unreadCount === 0 thì không gọi lại API HTTP để tránh spam
    if (target && target.unreadCount === 0) {
      return
    }

    // 1. Optimistic UI update: Reset unread count ngay lập tức
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, unreadCount: 0 } : c
      ),
    }))

    // 2. Đồng bộ lên Backend
    try {
      await conversationApi.markAsRead(conversationId)
    } catch {
      // Có thể giữ hoặc rollback nếu cần; thường markAsRead không cần chặn UI
    }
  },

  getFilteredConversations: () => {
    const { conversations, searchQuery, filterTab } = get()
    const query = searchQuery.trim().toLowerCase()

    return conversations.filter((c) => {
      // Lọc theo Tab
      if (filterTab === 'unread' && c.unreadCount <= 0) {
        return false
      }
      if (filterTab === 'group' && c.type !== 'GROUP') {
        return false
      }

      // Lọc theo từ khóa tìm kiếm
      if (query) {
        const matchName = c.name.toLowerCase().includes(query)
        const matchMessage = c.lastMessage?.content.toLowerCase().includes(query)
        return matchName || Boolean(matchMessage)
      }

      return true
    })
  },

  reset: () => {
    set({
      conversations: [],
      activeConversationId: null,
      searchQuery: '',
      filterTab: 'all',
      isLoading: false,
      error: null,
    })
  },
}))
