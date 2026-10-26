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
      set({
        conversations: sortByRecency(data),
        isLoading: false,
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
        conversations: sortByRecency(nextList),
      }
    })
  },

  handleNewMessage: (conversationId: string, message: LastMessage, isSelf = false) => {
    set((state) => {
      const target = state.conversations.find((c) => c.id === conversationId)
      if (!target) return state

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
        conversations: [updated, ...rest],
      }
    })
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
