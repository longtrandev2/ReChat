import { create } from 'zustand'
import { messagesApi } from '../services/messages.api'
import type { Message } from '../types/message.types'

export interface MessagesState {
  messagesByConversation: Record<string, Message[]>
  hasMoreByConversation: Record<string, boolean>
  lastReadMessageIdByConversation: Record<string, string> // conversationId -> lastReadMessageId
  typingUsers: Record<string, Record<string, string>> // conversationId -> { [userId]: displayName }
  editingMessage: { id: string; content: string } | null
  replyingMessage: Message | null
  isLoadingMessages: boolean
  error: string | null

  // Actions
  fetchMessages: (conversationId: string, before?: string) => Promise<void>
  appendIncomingMessage: (conversationId: string, message: Message) => void
  setEditingMessage: (message: { id: string; content: string } | null) => void
  setReplyingMessage: (message: Message | null) => void
  handleMessageRecalled: (conversationId: string, messageId: string) => void
  handleMessageEdited: (
    conversationId: string,
    messageId: string,
    content: string,
    editedAt?: string
  ) => void
  handleReactionUpdated: (
    conversationId: string,
    messageId: string,
    emoji: string,
    action: 'ADDED' | 'REMOVED' | 'CHANGED',
    user: { id: string; displayName?: string; username?: string },
    currentUserId?: string
  ) => void
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
  editingMessage: null,
  replyingMessage: null,
  isLoadingMessages: false,
  error: null,

  setEditingMessage: (message) => {
    set({ editingMessage: message })
  },

  setReplyingMessage: (message) => {
    set({ replyingMessage: message })
  },

  handleMessageRecalled: (conversationId: string, messageId: string) => {
    set((state) => {
      const currentList = state.messagesByConversation[conversationId] || []
      const index = currentList.findIndex((m) => m.id === messageId)
      if (index === -1) return state

      const updated = [...currentList]
      updated[index] = {
        ...updated[index],
        isRecalled: true,
        content: '[Tin nhắn đã bị thu hồi]',
      }

      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: updated,
        },
      }
    })
  },

  handleMessageEdited: (
    conversationId: string,
    messageId: string,
    content: string,
    editedAt?: string
  ) => {
    set((state) => {
      const currentList = state.messagesByConversation[conversationId] || []
      const index = currentList.findIndex((m) => m.id === messageId)
      if (index === -1) return state

      const updated = [...currentList]
      updated[index] = {
        ...updated[index],
        content,
        isEdited: true,
        editedAt: editedAt || new Date().toISOString(),
      }

      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: updated,
        },
      }
    })
  },

  handleReactionUpdated: (
    conversationId: string,
    messageId: string,
    emoji: string,
    action: 'ADDED' | 'REMOVED' | 'CHANGED',
    user: { id: string; displayName?: string; username?: string },
    currentUserId?: string
  ) => {
    set((state) => {
      const currentList = state.messagesByConversation[conversationId] || []
      const index = currentList.findIndex((m) => m.id === messageId)
      if (index === -1) return state

      const msg = currentList[index]
      let reactions = [...(msg.reactions || [])]
      const userDisplay = user.displayName || user.username || 'User'
      const isMe = user.id === currentUserId

      if (action === 'ADDED') {
        const groupIndex = reactions.findIndex((r) => r.emoji === emoji)
        if (groupIndex !== -1) {
          const group = reactions[groupIndex]
          const userExists = group.users.some((u) => u.id === user.id)
          const newUsers = userExists
            ? group.users
            : [...group.users, { id: user.id, displayName: userDisplay }]
          reactions[groupIndex] = {
            ...group,
            count: userExists ? group.count : group.count + 1,
            users: newUsers,
            hasReacted: isMe ? true : group.hasReacted,
          }
        } else {
          reactions.push({
            emoji,
            count: 1,
            users: [{ id: user.id, displayName: userDisplay }],
            hasReacted: isMe,
          })
        }
      } else if (action === 'REMOVED') {
        reactions = reactions
          .map((group) => {
            if (group.emoji !== emoji) return group
            const newUsers = group.users.filter((u) => u.id !== user.id)
            return {
              ...group,
              count: Math.max(0, group.count - 1),
              users: newUsers,
              hasReacted: isMe ? false : group.hasReacted,
            }
          })
          .filter((group) => group.count > 0)
      } else if (action === 'CHANGED') {
        // Remove from any other group
        reactions = reactions
          .map((group) => {
            const hasUser = group.users.some((u) => u.id === user.id)
            if (!hasUser || group.emoji === emoji) return group
            return {
              ...group,
              count: Math.max(0, group.count - 1),
              users: group.users.filter((u) => u.id !== user.id),
              hasReacted: isMe ? false : group.hasReacted,
            }
          })
          .filter((group) => group.count > 0)

        // Add to new emoji group
        const groupIndex = reactions.findIndex((r) => r.emoji === emoji)
        if (groupIndex !== -1) {
          const group = reactions[groupIndex]
          const userExists = group.users.some((u) => u.id === user.id)
          reactions[groupIndex] = {
            ...group,
            count: userExists ? group.count : group.count + 1,
            users: userExists
              ? group.users
              : [...group.users, { id: user.id, displayName: userDisplay }],
            hasReacted: isMe ? true : group.hasReacted,
          }
        } else {
          reactions.push({
            emoji,
            count: 1,
            users: [{ id: user.id, displayName: userDisplay }],
            hasReacted: isMe,
          })
        }
      }

      const updated = [...currentList]
      updated[index] = {
        ...msg,
        reactions,
      }

      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: updated,
        },
      }
    })
  },

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
      editingMessage: null,
      replyingMessage: null,
      isLoadingMessages: false,
      error: null,
    })
  },
}))
