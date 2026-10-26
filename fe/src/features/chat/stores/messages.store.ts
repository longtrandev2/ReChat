import { create } from 'zustand'
import { messagesApi } from '../services/messages.api'
import type { Message } from '../types/message.types'

export interface MessagesState {
  messagesByConversation: Record<string, Message[]>
  hasMoreByConversation: Record<string, boolean>
  lastReadMessageIdByConversation: Record<string, string> // conversationId -> lastReadMessageId
  typingUsers: Record<string, Record<string, string>> // conversationId -> { [userId]: displayName }
  isLoadingMessages: boolean
  error: string | null

  // Actions
  fetchMessages: (conversationId: string, before?: string) => Promise<void>
  appendIncomingMessage: (conversationId: string, message: Message) => void
  setTypingStatus: (
    conversationId: string,
    userId: string,
    displayName: string,
    isTyping: boolean
  ) => void
  setLastReadMessageId: (conversationId: string, messageId: string) => void
  clearConversationMessages: (conversationId: string) => void
  reset: () => void
}

const DEFAULT_LIMIT = 30
const TYPING_TIMEOUT_MS = 3000

// Internal timer tracking for auto-clearing typing indicators
const typingTimers: Record<string, ReturnType<typeof setTimeout>> = {}

export const useMessagesStore = create<MessagesState>((set, get) => ({
  messagesByConversation: {},
  hasMoreByConversation: {},
  lastReadMessageIdByConversation: {},
  typingUsers: {},
  isLoadingMessages: false,
  error: null,

  fetchMessages: async (conversationId: string, before?: string) => {
    try {
      set({ isLoadingMessages: true, error: null })
      const fetched = await messagesApi.getMessages(conversationId, {
        before,
        limit: DEFAULT_LIMIT,
      })

      set((state) => {
        const prev = state.messagesByConversation[conversationId] || []
        let updated: Message[]

        if (before) {
          // Prepend older messages while deduplicating by ID
          const existingIds = new Set(prev.map((m) => m.id))
          const uniqueFetched = fetched.filter((m) => !existingIds.has(m.id))
          updated = [...uniqueFetched, ...prev]
        } else {
          // Initial or refresh load: replace
          updated = fetched
        }

        return {
          messagesByConversation: {
            ...state.messagesByConversation,
            [conversationId]: updated,
          },
          hasMoreByConversation: {
            ...state.hasMoreByConversation,
            [conversationId]: fetched.length >= DEFAULT_LIMIT,
          },
          isLoadingMessages: false,
        }
      })
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : 'Không thể tải tin nhắn'
      set({
        error: errorMsg,
        isLoadingMessages: false,
      })
    }
  },

  appendIncomingMessage: (conversationId: string, message: Message) => {
    set((state) => {
      const currentList = state.messagesByConversation[conversationId] || []
      const existingIndex = currentList.findIndex((m) => m.id === message.id)

      let nextList: Message[]
      if (existingIndex !== -1) {
        // Update existing message in place (e.g. optimistic to confirmed, or edit)
        nextList = [...currentList]
        nextList[existingIndex] = message
      } else {
        // Append new message at the end
        nextList = [...currentList, message]
      }

      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: nextList,
        },
      }
    })
  },

  setTypingStatus: (
    conversationId: string,
    userId: string,
    displayName: string,
    isTyping: boolean
  ) => {
    const timerKey = `${conversationId}:${userId}`

    // Clear existing timer if any
    if (typingTimers[timerKey]) {
      clearTimeout(typingTimers[timerKey])
      delete typingTimers[timerKey]
    }

    if (isTyping) {
      // Add user to typing list
      set((state) => {
        const convTyping = { ...(state.typingUsers[conversationId] || {}) }
        convTyping[userId] = displayName
        return {
          typingUsers: {
            ...state.typingUsers,
            [conversationId]: convTyping,
          },
        }
      })

      // Auto-clear after timeout in case stop event is missed
      typingTimers[timerKey] = setTimeout(() => {
        delete typingTimers[timerKey]
        get().setTypingStatus(conversationId, userId, displayName, false)
      }, TYPING_TIMEOUT_MS)
    } else {
      // Remove user from typing list
      set((state) => {
        const convTyping = { ...(state.typingUsers[conversationId] || {}) }
        delete convTyping[userId]
        return {
          typingUsers: {
            ...state.typingUsers,
            [conversationId]: convTyping,
          },
        }
      })
    }
  },

  setLastReadMessageId: (conversationId: string, messageId: string) => {
    set((state) => ({
      lastReadMessageIdByConversation: {
        ...state.lastReadMessageIdByConversation,
        [conversationId]: messageId,
      },
    }))
  },

  clearConversationMessages: (conversationId: string) => {
    // Clear any timers for this conversation
    Object.keys(typingTimers).forEach((key) => {
      if (key.startsWith(`${conversationId}:`)) {
        clearTimeout(typingTimers[key])
        delete typingTimers[key]
      }
    })

    set((state) => {
      const nextMessages = { ...state.messagesByConversation }
      const nextHasMore = { ...state.hasMoreByConversation }
      const nextLastRead = { ...state.lastReadMessageIdByConversation }
      const nextTyping = { ...state.typingUsers }

      delete nextMessages[conversationId]
      delete nextHasMore[conversationId]
      delete nextLastRead[conversationId]
      delete nextTyping[conversationId]

      return {
        messagesByConversation: nextMessages,
        hasMoreByConversation: nextHasMore,
        lastReadMessageIdByConversation: nextLastRead,
        typingUsers: nextTyping,
      }
    })
  },

  reset: () => {
    // Clear all typing timers
    Object.keys(typingTimers).forEach((key) => {
      clearTimeout(typingTimers[key])
      delete typingTimers[key]
    })

    set({
      messagesByConversation: {},
      hasMoreByConversation: {},
      lastReadMessageIdByConversation: {},
      typingUsers: {},
      isLoadingMessages: false,
      error: null,
    })
  },
}))
