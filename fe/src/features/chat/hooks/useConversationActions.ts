import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'
import { useConversationStore } from '@/features/conversations/stores/conversation.store'
import { conversationApi } from '@/features/conversations/services/conversation.api'
import { useFriendsStore } from '@/features/friends/stores/friends.store'
import { useMessagesStore } from '../stores/messages.store'
import type { Conversation } from '@/features/conversations/types/conversation.types'

/**
 * useConversationActions: Gom các hành động cấp hội thoại dùng chung giữa Header menu và Drawer (FR-48, FR-29, BR-38)
 * - Ghim / bỏ ghim (lạc quan, rollback trong store)
 * - Xóa lịch sử đoạn chat phía mình -> dọn store cục bộ -> điều hướng /chat
 * - Chặn / bỏ chặn đối phương (chỉ DIRECT)
 */
export function useConversationActions(conversation: Conversation | undefined, partnerIdOverride?: string | null) {
  const navigate = useNavigate()
  const currentUserId = useAuthStore((s) => s.user?.id)
  const [isClearing, setIsClearing] = useState(false)
  const [isBlocking, setIsBlocking] = useState(false)

  const partnerId =
    partnerIdOverride ||
    conversation?.partnerId ||
    conversation?.members?.find((m) => m.user?.id !== currentUserId)?.user?.id ||
    null

  const conversationId = conversation?.id ?? ''
  const isPinned = Boolean(conversation?.isPinned)
  const blockStatus = conversation?.blockStatus ?? 'NONE'

  const togglePin = useCallback(async () => {
    if (!conversationId) return
    const next = !isPinned
    try {
      await useConversationStore.getState().setPinned(conversationId, next)
      toast.success(next ? 'Đã ghim cuộc trò chuyện' : 'Đã bỏ ghim cuộc trò chuyện')
    } catch (err) {
      toast.error(
        getApiErrorMessage(err, next ? 'Không thể ghim cuộc trò chuyện' : 'Không thể bỏ ghim cuộc trò chuyện')
      )
    }
  }, [conversationId, isPinned])

  const clearHistory = useCallback(async (): Promise<boolean> => {
    if (!conversationId) return false
    setIsClearing(true)
    try {
      await conversationApi.clearHistory(conversationId)
      useMessagesStore.getState().clearConversationMessages(conversationId)
      useConversationStore.getState().removeConversation(conversationId)
      toast.success('Đã xóa đoạn chat')
      navigate('/chat')
      return true
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Không thể xóa đoạn chat'))
      return false
    } finally {
      setIsClearing(false)
    }
  }, [conversationId, navigate])

  const blockPartner = useCallback(async (): Promise<boolean> => {
    if (!partnerId || !conversationId) {
      toast.error('Không xác định được người dùng cần chặn')
      return false
    }
    setIsBlocking(true)
    try {
      await useFriendsStore.getState().blockUser(partnerId)
      useConversationStore.getState().updateConversation(conversationId, {
        blockStatus: 'BLOCKED_BY_ME',
        isOnline: false,
      })
      toast.success('Đã chặn người dùng thành công')
      return true
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Không thể chặn người dùng lúc này'))
      return false
    } finally {
      setIsBlocking(false)
    }
  }, [partnerId, conversationId])

  const unblockPartner = useCallback(async (): Promise<boolean> => {
    if (!partnerId || !conversationId) return false
    setIsBlocking(true)
    try {
      await useFriendsStore.getState().unblockUser(partnerId)
      useConversationStore.getState().updateConversation(conversationId, { blockStatus: 'NONE' })
      toast.success('Đã bỏ chặn người dùng')
      return true
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Không thể bỏ chặn người dùng lúc này'))
      return false
    } finally {
      setIsBlocking(false)
    }
  }, [partnerId, conversationId])

  return {
    isPinned,
    blockStatus,
    isClearing,
    isBlocking,
    togglePin,
    clearHistory,
    blockPartner,
    unblockPartner,
  }
}
