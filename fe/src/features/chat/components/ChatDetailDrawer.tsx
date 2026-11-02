import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X,
  Bell,
  BellOff,
  Search,
  FileText,
  Image as ImageIcon,
  Users,
  ShieldCheck,
  Shield,
  Download,
  Loader2,
  Pin,
  Pencil,
  Camera,
  Smile,
  UserPlus,
  MoreVertical,
  LogOut,
  Ban,
  ChevronDown,
  Check,
} from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as Popover from '@radix-ui/react-popover'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage, PresenceDot } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { formatFileSize, cn } from '@/lib/utils'
import { isSafeHttpUrl, openSafeUrl } from '@/lib/safe-url'
import { useSharedMedia } from '../hooks/useSharedMedia'
import { useConversationActions } from '../hooks/useConversationActions'
import { BlockUserConfirmDialog } from './ConversationConfirmDialogs'
import { useConversationStore } from '@/features/conversations/stores/conversation.store'
import { useAuthStore } from '@/stores/auth.store'
import { conversationApi } from '@/features/conversations/services/conversation.api'
import { mediaApi } from '../services/media.api'
import { friendsApi, type FriendUser } from '@/features/friends/services/friends.api'
import { userApi, type SearchedUser } from '@/features/users/services/user.api'
import type {
  Conversation,
  ConversationMemberUser,
  ConversationMember,
} from '@/features/conversations/types/conversation.types'
import type { Message } from '../types/message.types'

export interface ChatDetailDrawerProps {
  isOpen: boolean
  onClose: () => void
  conversation: Conversation
  partner?: ConversationMemberUser | null
  isOnline?: boolean
  messages?: Message[]
  pinnedMessages?: Message[]
  onUnpinMessage?: (message: Message) => void
  onJumpToMessage?: (messageId: string) => void
  onImageClick?: (imageUrl: string, altText?: string) => void
  onSearchClick?: () => void
  onConversationUpdated?: (updated: Partial<Conversation>) => void
}

type TabType = 'media' | 'files'

const QUICK_EMOJIS_GRID = [
  '👍', '❤️', '🔥', '🎉', '👏', '😂',
  '😮', '🚀', '🏸', '⭐', '💡', '✨',
  '💯', '🙏', '🥳', '🥰',
]

/**
 * ChatDetailDrawer: Bảng thông tin chi tiết cuộc trò chuyện 5 Accordion chuẩn Messenger Web
 * - Accordion 1: Thông tin về đoạn chat (Xem tin nhắn đã ghim, modal chi tiết tin ghim)
 * - Accordion 2: Tùy chỉnh đoạn chat (Đổi tên nhóm, Đổi ảnh đại diện nhóm, Đổi biểu tượng cảm xúc Quick Emoji)
 * - Accordion 3: Thành viên trong đoạn chat (Chỉ hiện khi là Group - Thêm thành viên, Role badge, Phân quyền, Rời nhóm)
 * - Accordion 4: File phương tiện, file và liên kết (Ảnh & Tệp tin với infinite scroll)
 * - Accordion 5: Quyền riêng tư & hỗ trợ (Rời khỏi nhóm / Chặn người dùng)
 */
export function ChatDetailDrawer({
  isOpen,
  onClose,
  conversation,
  partner,
  isOnline = false,
  messages = [],
  pinnedMessages = [],
  onUnpinMessage,
  onJumpToMessage,
  onImageClick,
  onSearchClick,
  onConversationUpdated,
}: ChatDetailDrawerProps) {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { addOrUpdateConversation, removeConversation } = useConversationStore()
  const { blockStatus, isBlocking, blockPartner, unblockPartner } = useConversationActions(
    conversation,
    partner?.id
  )
  // Khi hai bên đang chặn nhau, ẩn trạng thái hoạt động của đối phương (BR-38)
  const showOnline = isOnline && blockStatus === 'NONE'

  // State các Accordion mở/đóng
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    chat_info: true,
    customization: true,
    members: true,
    media_files: false,
    privacy: false,
  })

  const toggleSection = (sectionKey: string) => {
    setOpenSections((prev) => ({ ...prev, [sectionKey]: !prev[sectionKey] }))
  }

  // Quản lý Modal & Popovers
  const [isPinnedModalOpen, setIsPinnedModalOpen] = useState(false)
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false)
  const [newGroupName, setNewGroupName] = useState(conversation.name)
  const [isRenaming, setIsRenaming] = useState(false)

  // Upload Avatar
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [overrideAvatarUrl, setOverrideAvatarUrl] = useState<string | null>(null)
  const currentAvatarUrl = overrideAvatarUrl || conversation.avatarUrl

  // Quick Emoji Popover
  const [isEmojiPopoverOpen, setIsEmojiPopoverOpen] = useState(false)
  const [overrideQuickEmoji, setOverrideQuickEmoji] = useState<string | null>(null)
  const currentQuickEmoji = overrideQuickEmoji || conversation.quickEmoji || '👍'

  // Thêm thành viên nhóm Modal
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false)
  const [friendsList, setFriendsList] = useState<FriendUser[]>([])
  const [searchedUsers, setSearchedUsers] = useState<SearchedUser[]>([])
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([])
  const [friendsSearch, setFriendsSearch] = useState('')
  const [isLoadingFriends, setIsLoadingFriends] = useState(false)
  const [isAddingMembers, setIsAddingMembers] = useState(false)

  // Quản lý thành viên (Kick, Transfer Owner) Dialogs
  const [selectedMember, setSelectedMember] = useState<ConversationMember | null>(null)
  const [isKickConfirmOpen, setIsKickConfirmOpen] = useState(false)
  const [isTransferConfirmOpen, setIsTransferConfirmOpen] = useState(false)
  const [isLeaveGroupConfirmOpen, setIsLeaveGroupConfirmOpen] = useState(false)
  const [isBlockUserConfirmOpen, setIsBlockUserConfirmOpen] = useState(false)

  // Gallery tabs
  const [activeTab, setActiveTab] = useState<TabType>('media')

  // Mute notification state
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    if (typeof conversation.isMuted === 'boolean') {
      return conversation.isMuted
    }
    try {
      return localStorage.getItem(`rechat_muted_${conversation.id}`) === 'true'
    } catch {
      return false
    }
  })
  const [prevMutedProp, setPrevMutedProp] = useState(conversation.isMuted)

  if (conversation.isMuted !== prevMutedProp) {
    setPrevMutedProp(conversation.isMuted)
    if (typeof conversation.isMuted === 'boolean') {
      setIsMuted(conversation.isMuted)
    }
  }

  const isGroup = conversation.type === 'GROUP'
  const members = useMemo(() => conversation.members || [], [conversation.members])

  // Quyền hạn của user hiện tại trong nhóm (BR-14, BR-15, BR-16)
  const currentMember = members.find((m) => m.user?.id === user?.id)
  const isOwner = currentMember?.role === 'OWNER'
  const isAdmin = currentMember?.role === 'ADMIN'

  // Tra cứu ảnh & tệp tin độc lập qua useSharedMedia
  const {
    items: imageItems,
    isLoading: isMediaLoading,
    isLoadingMore: isMediaLoadingMore,
    hasMore: hasMoreMedia,
    loadMore: loadMoreMedia,
    prependItem: prependImage,
    removeItem: removeImage,
  } = useSharedMedia({
    conversationId: conversation.id,
    type: 'IMAGE',
    enabled: isOpen,
  })

  const {
    items: fileItems,
    isLoading: isFilesLoading,
    isLoadingMore: isFilesLoadingMore,
    hasMore: hasMoreFiles,
    loadMore: loadMoreFiles,
    prependItem: prependFile,
    removeItem: removeFile,
  } = useSharedMedia({
    conversationId: conversation.id,
    type: 'FILE',
    enabled: isOpen,
  })

  const validImages = imageItems.filter((img) => !img.isRecalled && Boolean(img.fileUrl))
  const validFiles = fileItems.filter((file) => !file.isRecalled && Boolean(file.fileUrl))

  // Đồng bộ real-time ảnh/tệp khi có tin nhắn mới
  useEffect(() => {
    if (messages.length === 0) return
    const latest = messages[messages.length - 1]
    if (latest.type === 'IMAGE' && !latest.isRecalled) {
      prependImage(latest)
    } else if (latest.type === 'FILE' && !latest.isRecalled) {
      prependFile(latest)
    }

    for (const msg of messages) {
      if (msg.isRecalled) {
        removeImage(msg.id)
        removeFile(msg.id)
      }
    }
  }, [messages, prependImage, prependFile, removeImage, removeFile])

  const initials = (isGroup ? conversation.name : partner?.displayName || conversation.name || 'U')
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U'

  const handleToggleMute = async () => {
    const next = !isMuted
    setIsMuted(next)
    try {
      localStorage.setItem(`rechat_muted_${conversation.id}`, String(next))
    } catch {
      // ignore
    }
    try {
      await conversationApi.toggleMute(conversation.id, next)
      useConversationStore.getState().updateConversation(conversation.id, { isMuted: next })
      toast.success(next ? 'Đã tắt thông báo cuộc trò chuyện' : 'Đã bật lại thông báo')
    } catch {
      setIsMuted(!next)
      toast.error('Không thể cập nhật trạng thái thông báo')
    }
  }

  const handleDownloadFile = async (e: React.MouseEvent, url: string, fileName: string) => {
    e.stopPropagation()
    if (!isSafeHttpUrl(url)) {
      toast.error('Liên kết tệp không hợp lệ')
      return
    }
    try {
      let downloadUrl = url
      if (downloadUrl.includes('/upload/') && !downloadUrl.includes('/fl_attachment')) {
        downloadUrl = downloadUrl.replace('/upload/', '/upload/fl_attachment/')
      }
      const res = await fetch(downloadUrl)
      if (!res.ok) throw new Error('Fetch failed')
      const blob = await res.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(blobUrl)
      toast.success('Đang tải tệp xuống...')
    } catch {
      openSafeUrl(url)
    }
  }

  // 1. Đổi tên nhóm
  const handleRenameGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newGroupName.trim()
    if (!trimmed || trimmed.length > 50) {
      toast.error('Tên nhóm phải từ 1 đến 50 ký tự')
      return
    }

    try {
      setIsRenaming(true)
      const updated = await conversationApi.updateGroup(conversation.id, { name: trimmed })
      addOrUpdateConversation(updated)
      onConversationUpdated?.({ name: trimmed })
      setIsRenameModalOpen(false)
      toast.success('Đã đổi tên đoạn chat thành công')
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } }
      toast.error(error.response?.data?.message || 'Không thể đổi tên nhóm')
    } finally {
      setIsRenaming(false)
    }
  }

  // 2. Thay đổi ảnh nhóm
  const handleAvatarFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setIsUploadingAvatar(true)
      const uploadRes = await mediaApi.uploadMedia(file)
      const avatarUrl = uploadRes.url || uploadRes.secure_url
      if (!avatarUrl) {
        throw new Error('Không nhận được URL ảnh từ máy chủ')
      }
      setOverrideAvatarUrl(avatarUrl)
      const updated = await conversationApi.updateGroup(conversation.id, {
        avatarUrl,
      })
      addOrUpdateConversation(updated)
      onConversationUpdated?.({ avatarUrl })
      toast.success('Đã cập nhật ảnh đại diện nhóm')
    } catch (err: unknown) {
      setOverrideAvatarUrl(null)
      const error = err as { response?: { data?: { message?: string } } }
      toast.error(error.response?.data?.message || 'Không thể tải ảnh lên')
    } finally {
      setIsUploadingAvatar(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  // 3. Đổi Quick Emoji
  const handleSelectQuickEmoji = async (emoji: string) => {
    try {
      setOverrideQuickEmoji(emoji)
      setIsEmojiPopoverOpen(false)
      await conversationApi.updateQuickEmoji(conversation.id, emoji)
      addOrUpdateConversation({ ...conversation, quickEmoji: emoji })
      onConversationUpdated?.({ quickEmoji: emoji })
      toast.success(`Đã đổi biểu tượng cảm xúc thành ${emoji}`)
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } }
      toast.error(error.response?.data?.message || 'Không thể đổi biểu tượng cảm xúc')
    }
  }

  // 4. Mở modal thêm thành viên & tải danh sách bạn bè
  const handleOpenAddMemberModal = async () => {
    setIsAddMemberModalOpen(true)
    setSelectedFriendIds([])
    setFriendsSearch('')
    setSearchedUsers([])
    try {
      setIsLoadingFriends(true)
      const friends = await friendsApi.getFriends({ limit: 50 })
      setFriendsList(friends)
    } catch {
      toast.error('Không thể tải danh sách bạn bè')
    } finally {
      setIsLoadingFriends(false)
    }
  }

  const handleToggleSelectFriend = (friendId: string) => {
    setSelectedFriendIds((prev) =>
      prev.includes(friendId) ? prev.filter((id) => id !== friendId) : [...prev, friendId]
    )
  }

  const handleAddMembersSubmit = async () => {
    if (selectedFriendIds.length === 0) return
    try {
      setIsAddingMembers(true)
      await conversationApi.addMembers(conversation.id, selectedFriendIds)
      setIsAddMemberModalOpen(false)
      // Tải lại chi tiết cuộc hội thoại để cập nhật danh sách thành viên mới
      const refreshed = await conversationApi.getConversationById(conversation.id)
      if (refreshed) {
        addOrUpdateConversation(refreshed)
        onConversationUpdated?.(refreshed)
      }
      toast.success(`Đã thêm ${selectedFriendIds.length} thành viên vào nhóm`)
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } }
      toast.error(error.response?.data?.message || 'Không thể thêm thành viên')
    } finally {
      setIsAddingMembers(false)
    }
  }

  // 5. Phân quyền Admin / Member
  const handleUpdateRole = async (targetUserId: string, newRole: 'ADMIN' | 'MEMBER') => {
    try {
      await conversationApi.updateMemberRole(conversation.id, targetUserId, newRole)
      const refreshed = await conversationApi.getConversationById(conversation.id)
      if (refreshed) {
        addOrUpdateConversation(refreshed)
        onConversationUpdated?.(refreshed)
      }
      toast.success(newRole === 'ADMIN' ? 'Đã thăng cấp thành Quản trị viên' : 'Đã giáng cấp thành Thành viên')
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } }
      toast.error(error.response?.data?.message || 'Không thể cập nhật quyền')
    }
  }

  // 6. Xóa thành viên (Kick)
  const handleKickConfirm = async () => {
    if (!selectedMember?.user?.id) return
    try {
      await conversationApi.kickMember(conversation.id, selectedMember.user.id)
      const refreshed = await conversationApi.getConversationById(conversation.id)
      if (refreshed) {
        addOrUpdateConversation(refreshed)
        onConversationUpdated?.(refreshed)
      }
      setIsKickConfirmOpen(false)
      setSelectedMember(null)
      toast.success('Đã xóa thành viên khỏi nhóm')
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } }
      toast.error(error.response?.data?.message || 'Không thể xóa thành viên')
    }
  }

  // 7. Chuyển quyền Trưởng nhóm (Transfer Owner)
  const handleTransferOwnerConfirm = async () => {
    if (!selectedMember?.user?.id) return
    try {
      await conversationApi.transferOwner(conversation.id, selectedMember.user.id)
      const refreshed = await conversationApi.getConversationById(conversation.id)
      if (refreshed) {
        addOrUpdateConversation(refreshed)
        onConversationUpdated?.(refreshed)
      }
      setIsTransferConfirmOpen(false)
      setSelectedMember(null)
      toast.success('Đã chuyển quyền Trưởng nhóm thành công')
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } }
      toast.error(error.response?.data?.message || 'Không thể chuyển quyền Trưởng nhóm')
    }
  }

  // 8. Rời khỏi nhóm
  const handleLeaveGroupConfirm = async () => {
    try {
      await conversationApi.leaveGroup(conversation.id)
      removeConversation(conversation.id)
      setIsLeaveGroupConfirmOpen(false)
      onClose()
      navigate('/chat')
      toast.success('Đã rời khỏi nhóm trò chuyện')
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } }
      toast.error(error.response?.data?.message || 'Không thể rời nhóm')
    }
  }

  // Tìm kiếm người dùng khi nhập từ khóa trong modal thêm thành viên (debounce 300ms)
  useEffect(() => {
    if (!friendsSearch.trim() || !isAddMemberModalOpen) {
      return
    }

    const timer = setTimeout(async () => {
      try {
        const users = await userApi.searchUsers(friendsSearch.trim())
        setSearchedUsers(users || [])
      } catch {
        setSearchedUsers([])
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [friendsSearch, isAddMemberModalOpen])

  // Lọc bạn bè và người dùng chưa tham gia nhóm
  const eligibleFriends = useMemo(() => {
    const existingMemberUserIds = new Set(members.map((m) => m.user?.id))
    const map = new Map<string, FriendUser>()

    for (const f of friendsList) {
      if (!existingMemberUserIds.has(f.id) && f.id !== user?.id) {
        map.set(f.id, f)
      }
    }

    for (const u of searchedUsers) {
      if (!existingMemberUserIds.has(u.id) && u.id !== user?.id && !map.has(u.id)) {
        map.set(u.id, {
          id: u.id,
          username: u.username,
          displayName: u.displayName || u.username,
          avatarUrl: u.avatarUrl,
        })
      }
    }

    return Array.from(map.values())
  }, [friendsList, searchedUsers, members, user?.id])

  const filteredFriends = useMemo(() => {
    if (!friendsSearch.trim()) return eligibleFriends
    const q = friendsSearch.toLowerCase()
    return eligibleFriends.filter(
      (f) =>
        f.displayName.toLowerCase().includes(q) ||
        f.username.toLowerCase().includes(q)
    )
  }, [eligibleFriends, friendsSearch])

  if (!isOpen) return null

  return (
    <aside
      className="w-80 md:w-92 border-l border-border-light/80 dark:border-border-dark bg-white dark:bg-[#17212B] flex flex-col h-full shrink-0 select-none z-30 shadow-lg transition-all animate-in slide-in-from-right duration-200"
      data-testid="chat-detail-drawer"
    >
      {/* Top Header Drawer */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-border-light/60 dark:border-border-dark shrink-0">
        <h3 className="font-semibold text-sm text-ink-primary dark:text-[#F5F5F7]">
          {isGroup ? 'Thông tin nhóm' : 'Thông tin cuộc trò chuyện'}
        </h3>
        <button
          type="button"
          aria-label="Đóng bảng thông tin"
          title="Đóng"
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-ink-secondary dark:text-ink-secondary-dark hover:text-ink-primary dark:hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Scroll Content */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col p-3.5 gap-3"
        data-testid="drawer-scroll-container"
      >
        {/* Profile Card Section */}
        <div className="flex flex-col items-center text-center pt-2 pb-3 border-b border-border-light/60 dark:border-white/10">
          <div className="relative mb-2.5">
            <Avatar className="w-20 h-20 border-2 border-border-light dark:border-white/15 shadow-md">
              <AvatarImage
                src={(isGroup ? currentAvatarUrl : partner?.avatarUrl || currentAvatarUrl) || undefined}
                alt={isGroup ? conversation.name : partner?.displayName || conversation.name}
              />
              <AvatarFallback className="bg-brand-soft text-brand font-bold text-xl">
                {isGroup ? <Users className="w-8 h-8" /> : initials}
              </AvatarFallback>
            </Avatar>
            {!isGroup && (
              <span className="absolute bottom-1 right-1">
                <PresenceDot isOnline={showOnline} />
              </span>
            )}
            {isUploadingAvatar && (
              <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-white" />
              </div>
            )}
          </div>

          <h2 className="text-base font-bold text-ink-primary dark:text-white truncate max-w-full px-2" title={isGroup ? conversation.name : partner?.displayName || conversation.name}>
            {isGroup ? conversation.name : partner?.displayName || conversation.name}
          </h2>

          <p className="text-xs text-ink-muted mt-0.5">
            {isGroup
              ? `${members.length || conversation.memberCount || 2} thành viên`
              : partner?.username
              ? `@${partner.username}`
              : showOnline
              ? 'Đang trực tuyến'
              : 'Ngoại tuyến'}
          </p>

          {/* Quick Actions (Mute, Search) */}
          <div className="flex items-center gap-3 mt-3">
            <button
              type="button"
              onClick={handleToggleMute}
              title={isMuted ? 'Bật thông báo' : 'Tắt thông báo'}
              aria-label={isMuted ? 'Bật thông báo' : 'Tắt thông báo'}
              className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-ink-secondary dark:text-ink-secondary-dark hover:text-brand transition-colors cursor-pointer"
            >
              <div className="w-9 h-9 rounded-full bg-surface-light-2 dark:bg-[#242F3D] flex items-center justify-center">
                {isMuted ? <BellOff className="w-4 h-4 text-coral" /> : <Bell className="w-4 h-4" />}
              </div>
              <span className="text-[11px] font-medium">{isMuted ? 'Đã tắt chuông' : 'Thông báo'}</span>
            </button>

            <button
              type="button"
              onClick={onSearchClick}
              title="Tìm kiếm tin nhắn"
              aria-label="Tìm kiếm tin nhắn"
              className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-ink-secondary dark:text-ink-secondary-dark hover:text-brand transition-colors cursor-pointer"
            >
              <div className="w-9 h-9 rounded-full bg-surface-light-2 dark:bg-[#242F3D] flex items-center justify-center">
                <Search className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-medium">Tìm kiếm</span>
            </button>
          </div>
        </div>

        {/* ----------------- ACCORDION 1: THÔNG TIN VỀ ĐOẠN CHAT ----------------- */}
        <div className="flex flex-col border-b border-border-light/60 dark:border-white/10 pb-2">
          <button
            type="button"
            onClick={() => toggleSection('chat_info')}
            className="w-full flex items-center justify-between py-2 px-1 text-left cursor-pointer group"
            data-testid="accordion-chat-info"
          >
            <span className="text-xs font-bold text-ink-secondary dark:text-ink-secondary-dark uppercase tracking-wider">
              Thông tin về đoạn chat
            </span>
            <ChevronDown
              className={cn(
                'w-4 h-4 text-ink-muted transition-transform duration-200',
                openSections.chat_info && 'rotate-180'
              )}
            />
          </button>

          {openSections.chat_info && (
            <div className="flex flex-col gap-1 mt-1">
              <button
                type="button"
                onClick={() => setIsPinnedModalOpen(true)}
                className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer text-left"
                data-testid="view-pinned-messages-button"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-brand/10 dark:bg-brand/20 text-brand flex items-center justify-center shrink-0">
                    <Pin className="w-4 h-4 rotate-45" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-ink-primary dark:text-white">
                      Xem tin nhắn đã ghim
                    </p>
                    <p className="text-[11px] text-ink-muted">
                      {pinnedMessages.length} tin nhắn đã ghim
                    </p>
                  </div>
                </div>
              </button>

              {/* Tìm kiếm trong cuộc trò chuyện (Messenger style) */}
              <button
                type="button"
                onClick={onSearchClick}
                className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer text-left"
                data-testid="search-in-conversation-accordion-button"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-brand/10 dark:bg-brand/20 text-brand flex items-center justify-center shrink-0">
                    <Search className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-ink-primary dark:text-white">
                      Tìm kiếm trong cuộc trò chuyện
                    </p>
                    <p className="text-[11px] text-ink-muted">
                      Tra cứu tin nhắn theo từ khóa
                    </p>
                  </div>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* ----------------- ACCORDION 2: TÙY CHỈNH ĐOẠN CHAT ----------------- */}
        <div className="flex flex-col border-b border-border-light/60 dark:border-white/10 pb-2">
          <button
            type="button"
            onClick={() => toggleSection('customization')}
            className="w-full flex items-center justify-between py-2 px-1 text-left cursor-pointer group"
            data-testid="accordion-customization"
          >
            <span className="text-xs font-bold text-ink-secondary dark:text-ink-secondary-dark uppercase tracking-wider">
              Tùy chỉnh đoạn chat
            </span>
            <ChevronDown
              className={cn(
                'w-4 h-4 text-ink-muted transition-transform duration-200',
                openSections.customization && 'rotate-180'
              )}
            />
          </button>

          {openSections.customization && (
            <div className="flex flex-col gap-1 mt-1">
              {/* Đổi tên nhóm (Group only) */}
              {isGroup && (
                <button
                  type="button"
                  onClick={() => setIsRenameModalOpen(true)}
                  className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer text-left"
                  data-testid="rename-group-button"
                >
                  <div className="w-8 h-8 rounded-lg bg-surface-light-2 dark:bg-[#242F3D] text-ink-secondary dark:text-ink-secondary-dark flex items-center justify-center shrink-0">
                    <Pencil className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-ink-primary dark:text-white">
                      Đổi tên đoạn chat
                    </p>
                    <p className="text-[11px] text-ink-muted truncate">
                      {conversation.name}
                    </p>
                  </div>
                </button>
              )}

              {/* Thay đổi ảnh nhóm (Group only) */}
              {isGroup && (
                <>
                  <input
                    type="file"
                    ref={avatarInputRef}
                    accept="image/*"
                    onChange={handleAvatarFileSelected}
                    className="hidden"
                    data-testid="avatar-file-input"
                  />
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer text-left disabled:opacity-50"
                    data-testid="change-avatar-button"
                  >
                    <div className="w-8 h-8 rounded-lg bg-surface-light-2 dark:bg-[#242F3D] text-ink-secondary dark:text-ink-secondary-dark flex items-center justify-center shrink-0">
                      {isUploadingAvatar ? (
                        <Loader2 className="w-4 h-4 animate-spin text-brand" />
                      ) : (
                        <Camera className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-ink-primary dark:text-white">
                        Thay đổi ảnh
                      </p>
                      <p className="text-[11px] text-ink-muted">
                        Cập nhật ảnh đại diện nhóm
                      </p>
                    </div>
                  </button>
                </>
              )}

              {/* Đổi biểu tượng cảm xúc Quick Emoji (Cả Direct & Group) */}
              <Popover.Root open={isEmojiPopoverOpen} onOpenChange={setIsEmojiPopoverOpen}>
                <Popover.Trigger asChild>
                  <button
                    type="button"
                    className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer text-left"
                    data-testid="change-quick-emoji-button"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-surface-light-2 dark:bg-[#242F3D] text-ink-secondary dark:text-ink-secondary-dark flex items-center justify-center shrink-0">
                        <Smile className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-ink-primary dark:text-white">
                          Đổi biểu tượng cảm xúc
                        </p>
                        <p className="text-[11px] text-ink-muted">
                          Biểu tượng cảm xúc nhanh
                        </p>
                      </div>
                    </div>
                    <span className="text-lg shrink-0 px-2 select-none" data-testid="current-quick-emoji-preview">
                      {currentQuickEmoji}
                    </span>
                  </button>
                </Popover.Trigger>

                <Popover.Portal>
                  <Popover.Content
                    side="left"
                    sideOffset={8}
                    align="center"
                    className="z-50 p-3 bg-white dark:bg-[#17212B] border border-border dark:border-white/10 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-150 w-64"
                    data-testid="quick-emoji-popover"
                  >
                    <p className="text-xs font-semibold text-ink-primary dark:text-white mb-2 select-none">
                      Chọn biểu tượng cảm xúc nhanh
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {QUICK_EMOJIS_GRID.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => handleSelectQuickEmoji(emoji)}
                          className={cn(
                            'h-10 text-xl flex items-center justify-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-transform hover:scale-125 active:scale-95 cursor-pointer',
                            currentQuickEmoji === emoji && 'bg-brand/15 border border-brand/30'
                          )}
                          data-testid={`select-emoji-${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
            </div>
          )}
        </div>

        {/* ----------------- ACCORDION 3: THÀNH VIÊN TRONG ĐOẠN CHAT (GROUP ONLY) ----------------- */}
        {isGroup && (
          <div className="flex flex-col border-b border-border-light/60 dark:border-white/10 pb-2">
            <button
              type="button"
              onClick={() => toggleSection('members')}
              className="w-full flex items-center justify-between py-2 px-1 text-left cursor-pointer group"
              data-testid="accordion-members"
            >
              <span className="text-xs font-bold text-ink-secondary dark:text-ink-secondary-dark uppercase tracking-wider">
                Thành viên trong đoạn chat ({members.length})
              </span>
              <ChevronDown
                className={cn(
                  'w-4 h-4 text-ink-muted transition-transform duration-200',
                  openSections.members && 'rotate-180'
                )}
              />
            </button>

            {openSections.members && (
              <div className="flex flex-col gap-2 mt-1">
                {/* Nút Thêm thành viên */}
                <button
                  type="button"
                  onClick={handleOpenAddMemberModal}
                  className="w-full flex items-center gap-2 p-2 rounded-xl bg-brand/10 dark:bg-brand/20 text-brand font-semibold text-xs hover:bg-brand/15 dark:hover:bg-brand/25 transition-colors cursor-pointer"
                  data-testid="add-member-button"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>+ Thêm thành viên</span>
                </button>

                {/* Danh sách thành viên */}
                <div className="flex flex-col gap-1 max-h-56 overflow-y-auto pr-0.5">
                  {members.map((member) => {
                    const isTargetSelf = member.user?.id === user?.id
                    const isTargetOwner = member.role === 'OWNER'
                    const isTargetAdmin = member.role === 'ADMIN'

                    // Kiểm tra xem user hiện tại có thể tác động lên target này không (BR-14, BR-16)
                    const canKick =
                      (isOwner && !isTargetSelf) ||
                      (isAdmin && !isTargetSelf && member.role === 'MEMBER')
                    const canChangeRole = isOwner && !isTargetSelf
                    const canTransfer = isOwner && !isTargetSelf

                    const hasActions = canKick || canChangeRole || canTransfer

                    return (
                      <div
                        key={member.id}
                        className="flex items-center justify-between gap-2 p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors group/member"
                        data-testid={`member-item-${member.user?.id}`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar className="w-8 h-8 rounded-full border border-border-light dark:border-white/10 shrink-0">
                            <AvatarImage src={member.user?.avatarUrl || undefined} />
                            <AvatarFallback className="bg-brand-soft text-brand text-[11px] font-semibold">
                              {(member.user?.displayName || member.user?.username || 'U')[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-ink-primary dark:text-[#F5F5F7] truncate">
                              {member.user?.displayName || member.user?.username}
                              {isTargetSelf && <span className="text-[10px] text-ink-muted ml-1">(Bạn)</span>}
                            </p>
                            <div className="flex items-center gap-1 mt-0.5">
                              {isTargetOwner ? (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-brand bg-brand/10 px-1.5 py-0.2 rounded-md">
                                  <ShieldCheck className="w-3 h-3" /> Trưởng nhóm
                                </span>
                              ) : isTargetAdmin ? (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.2 rounded-md">
                                  <Shield className="w-3 h-3" /> Quản trị viên
                                </span>
                              ) : (
                                <span className="text-[10px] text-ink-muted">Thành viên</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Menu thao tác trên thành viên */}
                        {hasActions && (
                          <DropdownMenu.Root>
                            <DropdownMenu.Trigger asChild>
                              <button
                                type="button"
                                title="Thao tác thành viên"
                                aria-label="Thao tác thành viên"
                                className="p-1 rounded-full text-ink-muted hover:text-ink-primary dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                                data-testid={`member-actions-${member.user?.id}`}
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </DropdownMenu.Trigger>

                            <DropdownMenu.Portal>
                              <DropdownMenu.Content
                                align="end"
                                side="bottom"
                                className="z-50 min-w-[170px] bg-white dark:bg-[#17212B] text-ink-primary dark:text-[#F5F5F7] border border-border dark:border-white/10 p-1.5 rounded-xl shadow-2xl animate-in zoom-in-95 text-xs"
                              >
                                {canChangeRole && isTargetAdmin && (
                                  <DropdownMenu.Item
                                    onClick={() => handleUpdateRole(member.user!.id, 'MEMBER')}
                                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 outline-none transition-colors"
                                    data-testid={`demote-member-${member.user?.id}`}
                                  >
                                    <Shield className="w-3.5 h-3.5 text-ink-secondary" />
                                    <span>Gỡ quyền Quản trị viên</span>
                                  </DropdownMenu.Item>
                                )}

                                {canChangeRole && !isTargetAdmin && (
                                  <DropdownMenu.Item
                                    onClick={() => handleUpdateRole(member.user!.id, 'ADMIN')}
                                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 outline-none transition-colors"
                                    data-testid={`promote-member-${member.user?.id}`}
                                  >
                                    <ShieldCheck className="w-3.5 h-3.5 text-brand" />
                                    <span>Chỉ định Quản trị viên</span>
                                  </DropdownMenu.Item>
                                )}

                                {canTransfer && (
                                  <DropdownMenu.Item
                                    onClick={() => {
                                      setSelectedMember(member)
                                      setIsTransferConfirmOpen(true)
                                    }}
                                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 outline-none transition-colors"
                                    data-testid={`transfer-owner-${member.user?.id}`}
                                  >
                                    <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                                    <span>Chuyển quyền Trưởng nhóm</span>
                                  </DropdownMenu.Item>
                                )}

                                {canKick && (
                                  <DropdownMenu.Item
                                    onClick={() => {
                                      setSelectedMember(member)
                                      setIsKickConfirmOpen(true)
                                    }}
                                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-coral-soft/50 dark:hover:bg-coral/10 text-coral outline-none transition-colors"
                                    data-testid={`kick-member-${member.user?.id}`}
                                  >
                                    <LogOut className="w-3.5 h-3.5" />
                                    <span>Xóa khỏi nhóm</span>
                                  </DropdownMenu.Item>
                                )}
                              </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                          </DropdownMenu.Root>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ----------------- ACCORDION 4: FILE PHƯƠNG TIỆN, FILE VÀ LIÊN KẾT ----------------- */}
        <div className="flex flex-col border-b border-border-light/60 dark:border-white/10 pb-2">
          <button
            type="button"
            onClick={() => toggleSection('media_files')}
            className="w-full flex items-center justify-between py-2 px-1 text-left cursor-pointer group"
            data-testid="accordion-media-files"
          >
            <span className="text-xs font-bold text-ink-secondary dark:text-ink-secondary-dark uppercase tracking-wider">
              File phương tiện & tệp ({validImages.length + validFiles.length})
            </span>
            <ChevronDown
              className={cn(
                'w-4 h-4 text-ink-muted transition-transform duration-200',
                openSections.media_files && 'rotate-180'
              )}
            />
          </button>

          {openSections.media_files && (
            <div className="flex flex-col gap-2 mt-2">
              {/* Tab Selector */}
              <div className="flex items-center p-0.5 rounded-xl bg-surface-light-2 dark:bg-[#242F3D]">
                <button
                  type="button"
                  onClick={() => setActiveTab('media')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer',
                    activeTab === 'media'
                      ? 'bg-white dark:bg-[#17212B] text-brand shadow-xs'
                      : 'text-ink-secondary dark:text-ink-secondary-dark hover:text-ink-primary dark:hover:text-white'
                  )}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Ảnh ({validImages.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('files')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer',
                    activeTab === 'files'
                      ? 'bg-white dark:bg-[#17212B] text-brand shadow-xs'
                      : 'text-ink-secondary dark:text-ink-secondary-dark hover:text-ink-primary dark:hover:text-white'
                  )}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Tệp ({validFiles.length})</span>
                </button>
              </div>

              {/* Tab 1: Grid Hình ảnh */}
              {activeTab === 'media' && (
                <div className="flex-1 mt-1">
                  {isMediaLoading && validImages.length === 0 ? (
                    <div className="grid grid-cols-3 gap-1.5 animate-pulse" data-testid="media-skeleton">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="aspect-square rounded-lg bg-black/10 dark:bg-white/10" />
                      ))}
                    </div>
                  ) : validImages.length === 0 ? (
                    <div className="py-6 text-center text-xs text-ink-muted">
                      Chưa có hình ảnh nào được chia sẻ
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-1.5 max-h-56 overflow-y-auto pr-0.5" data-testid="shared-media-grid">
                      {validImages.map((img) => (
                        <div
                          key={img.id}
                          onClick={() => onImageClick?.(img.fileUrl!, img.content || 'Hình ảnh')}
                          className="aspect-square rounded-lg overflow-hidden bg-black/5 dark:bg-black/20 cursor-pointer group/thumb relative border border-black/5 dark:border-white/5"
                        >
                          <img
                            src={img.fileUrl!}
                            alt={img.content || 'Hình ảnh'}
                            className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-150"
                            loading="lazy"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {isMediaLoadingMore && (
                    <div className="py-2 flex justify-center text-xs text-ink-muted">
                      <Loader2 className="w-4 h-4 animate-spin text-brand" />
                    </div>
                  )}
                  {hasMoreMedia && (
                    <button
                      type="button"
                      onClick={() => loadMoreMedia()}
                      className="w-full mt-2 py-1.5 text-xs text-brand font-medium hover:underline text-center"
                    >
                      Tải thêm ảnh...
                    </button>
                  )}
                </div>
              )}

              {/* Tab 2: Danh sách Tệp tin */}
              {activeTab === 'files' && (
                <div className="flex-1 mt-1">
                  {isFilesLoading && validFiles.length === 0 ? (
                    <div className="flex flex-col gap-1.5 animate-pulse" data-testid="files-skeleton">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-12 rounded-xl bg-black/10 dark:bg-white/10" />
                      ))}
                    </div>
                  ) : validFiles.length === 0 ? (
                    <div className="py-6 text-center text-xs text-ink-muted">
                      Chưa có tệp tin nào được chia sẻ
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-0.5" data-testid="shared-files-list">
                      {validFiles.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center gap-2.5 p-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors group/file cursor-pointer"
                          onClick={(e) => handleDownloadFile(e, file.fileUrl!, file.content || 'attachment')}
                        >
                          <div className="w-8 h-8 rounded-lg bg-brand/10 dark:bg-brand/20 text-brand flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-ink-primary dark:text-[#F5F5F7] truncate">
                              {file.content || 'Tệp đính kèm'}
                            </p>
                            <p className="text-[10px] text-ink-muted">
                              {file.fileSize ? formatFileSize(file.fileSize) : 'Tài liệu'}
                            </p>
                          </div>
                          <button
                            type="button"
                            title="Tải tệp xuống"
                            aria-label="Tải tệp xuống"
                            className="p-1 rounded-full text-ink-secondary dark:text-ink-secondary-dark hover:text-brand transition-colors shrink-0"
                            onClick={(e) => handleDownloadFile(e, file.fileUrl!, file.content || 'attachment')}
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {isFilesLoadingMore && (
                    <div className="py-2 flex justify-center text-xs text-ink-muted">
                      <Loader2 className="w-4 h-4 animate-spin text-brand" />
                    </div>
                  )}
                  {hasMoreFiles && (
                    <button
                      type="button"
                      onClick={() => loadMoreFiles()}
                      className="w-full mt-2 py-1.5 text-xs text-brand font-medium hover:underline text-center"
                    >
                      Tải thêm tệp tin...
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ----------------- ACCORDION 5: QUYỀN RIÊNG TƯ & HỖ TRỢ ----------------- */}
        <div className="flex flex-col pb-4">
          <button
            type="button"
            onClick={() => toggleSection('privacy')}
            className="w-full flex items-center justify-between py-2 px-1 text-left cursor-pointer group"
            data-testid="accordion-privacy"
          >
            <span className="text-xs font-bold text-ink-secondary dark:text-ink-secondary-dark uppercase tracking-wider">
              Quyền riêng tư & hỗ trợ
            </span>
            <ChevronDown
              className={cn(
                'w-4 h-4 text-ink-muted transition-transform duration-200',
                openSections.privacy && 'rotate-180'
              )}
            />
          </button>

          {openSections.privacy && (
            <div className="flex flex-col gap-1 mt-1">
              {isGroup ? (
                <button
                  type="button"
                  onClick={() => setIsLeaveGroupConfirmOpen(true)}
                  className="w-full flex items-center gap-2.5 p-2 rounded-xl text-coral hover:bg-coral-soft/40 dark:hover:bg-coral/10 transition-colors cursor-pointer text-left"
                  data-testid="leave-group-button"
                >
                  <div className="w-8 h-8 rounded-lg bg-coral/10 flex items-center justify-center shrink-0">
                    <LogOut className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold">Rời khỏi nhóm</p>
                    <p className="text-[10px] text-ink-muted">Bạn sẽ không nhận được tin nhắn từ nhóm này nữa</p>
                  </div>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isBlocking}
                  onClick={() =>
                    blockStatus === 'BLOCKED_BY_ME' ? void unblockPartner() : setIsBlockUserConfirmOpen(true)
                  }
                  className="w-full flex items-center gap-2.5 p-2 rounded-xl text-coral hover:bg-coral-soft/40 dark:hover:bg-coral/10 transition-colors cursor-pointer text-left disabled:opacity-50"
                  data-testid="block-user-button"
                >
                  <div className="w-8 h-8 rounded-lg bg-coral/10 flex items-center justify-center shrink-0">
                    <Ban className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold">
                      {blockStatus === 'BLOCKED_BY_ME' ? 'Bỏ chặn người dùng' : 'Chặn người dùng'}
                    </p>
                    <p className="text-[10px] text-ink-muted">
                      {blockStatus === 'BLOCKED_BY_ME'
                        ? 'Cho phép hai bên nhắn tin trở lại'
                        : 'Chặn người này gửi tin nhắn hoặc gọi điện cho bạn'}
                    </p>
                  </div>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ===================== MODALS & DIALOGS ===================== */}

      {/* Modal 1: Danh sách tất cả tin nhắn đã ghim */}
      <Dialog.Root open={isPinnedModalOpen} onOpenChange={setIsPinnedModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 animate-in fade-in duration-150" />
          <Dialog.Content
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-[#17212B] text-ink-primary dark:text-white border border-border dark:border-white/10 p-5 rounded-2xl shadow-2xl z-50 animate-in zoom-in-95 duration-150 focus:outline-none flex flex-col max-h-[80vh]"
            data-testid="pinned-messages-dialog"
          >
            <div className="flex items-center justify-between pb-3 border-b border-border dark:border-white/10">
              <div className="flex items-center gap-2">
                <Pin className="w-4 h-4 text-brand rotate-45" />
                <Dialog.Title className="text-base font-bold">
                  Tin nhắn đã ghim ({pinnedMessages.length})
                </Dialog.Title>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="p-1 rounded-full text-ink-muted hover:text-ink-primary dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </Dialog.Close>
            </div>

            <div className="flex-1 overflow-y-auto py-3 flex flex-col gap-2">
              {pinnedMessages.length === 0 ? (
                <div className="py-12 text-center text-xs text-ink-muted">
                  Không có tin nhắn nào được ghim
                </div>
              ) : (
                pinnedMessages.map((msg) => (
                  <div
                    key={msg.id}
                    onClick={() => {
                      onJumpToMessage?.(msg.id)
                      setIsPinnedModalOpen(false)
                    }}
                    className="flex items-start justify-between gap-3 p-3 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-brand/10 dark:hover:bg-brand/20 border border-black/5 dark:border-white/5 transition-colors cursor-pointer group"
                    data-testid={`pinned-dialog-item-${msg.id}`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <Avatar className="w-7 h-7 rounded-full shrink-0">
                        <AvatarImage src={msg.sender?.avatarUrl || undefined} />
                        <AvatarFallback className="bg-brand-soft text-brand text-[10px] font-bold">
                          {(msg.sender?.displayName || msg.sender?.username || 'U')[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-ink-primary dark:text-white">
                            {msg.sender?.displayName || msg.sender?.username}
                          </span>
                        </div>
                        <p className="text-xs text-ink-secondary dark:text-ink-secondary-dark mt-0.5 break-words line-clamp-2">
                          {msg.type === 'IMAGE' ? '[Hình ảnh] ' : msg.type === 'FILE' ? '[Tệp tin] ' : ''}
                          {msg.content || ''}
                        </p>
                      </div>
                    </div>

                    {onUnpinMessage && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onUnpinMessage(msg)
                        }}
                        title="Bỏ ghim tin nhắn"
                        className="p-1.5 rounded-full text-ink-muted hover:text-coral hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
                        data-testid={`dialog-unpin-btn-${msg.id}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Modal 2: Đổi tên đoạn chat (Group) */}
      <Dialog.Root open={isRenameModalOpen} onOpenChange={setIsRenameModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 animate-in fade-in duration-150" />
          <Dialog.Content
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white dark:bg-[#17212B] text-ink-primary dark:text-white border border-border dark:border-white/10 p-5 rounded-2xl shadow-2xl z-50 animate-in zoom-in-95 duration-150 focus:outline-none"
            data-testid="rename-group-dialog"
          >
            <Dialog.Title className="text-base font-bold text-ink-primary dark:text-white">
              Đổi tên đoạn chat
            </Dialog.Title>
            <Dialog.Description className="text-xs text-ink-muted mt-1">
              Mọi người trong cuộc trò chuyện đều sẽ nhìn thấy tên này.
            </Dialog.Description>

            <form onSubmit={handleRenameGroup} className="mt-4 flex flex-col gap-4">
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                maxLength={50}
                placeholder="Nhập tên đoạn chat..."
                className="w-full px-3.5 py-2 rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-[#242F3D] text-sm text-ink-primary dark:text-white focus:outline-none focus:border-brand transition-colors"
                autoFocus
                data-testid="rename-group-input"
              />

              <div className="flex items-center justify-end gap-2">
                <Dialog.Close asChild>
                  <Button type="button" variant="ghost" disabled={isRenaming}>
                    Hủy
                  </Button>
                </Dialog.Close>
                <Button
                  type="submit"
                  disabled={isRenaming || !newGroupName.trim()}
                  className="bg-brand hover:bg-brand-hover text-white cursor-pointer"
                  data-testid="rename-group-submit"
                >
                  {isRenaming ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Lưu'}
                </Button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Modal 3: Thêm thành viên vào nhóm (Group) */}
      <Dialog.Root open={isAddMemberModalOpen} onOpenChange={setIsAddMemberModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 animate-in fade-in duration-150" />
          <Dialog.Content
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-[#17212B] text-ink-primary dark:text-white border border-border dark:border-white/10 p-5 rounded-2xl shadow-2xl z-50 animate-in zoom-in-95 duration-150 focus:outline-none flex flex-col max-h-[80vh]"
            data-testid="add-member-dialog"
          >
            <div className="flex items-center justify-between pb-3 border-b border-border dark:border-white/10">
              <Dialog.Title className="text-base font-bold">
                Thêm thành viên vào nhóm
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="p-1 rounded-full text-ink-muted hover:text-ink-primary dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </Dialog.Close>
            </div>

            {/* Tìm kiếm bạn bè */}
            <div className="pt-3 pb-2">
              <div className="relative">
                <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={friendsSearch}
                  onChange={(e) => {
                    const val = e.target.value
                    setFriendsSearch(val)
                    if (!val.trim()) {
                      setSearchedUsers([])
                    }
                  }}
                  placeholder="Tìm bạn bè hoặc username..."
                  className="w-full pl-9 pr-3.5 py-1.5 rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-[#242F3D] text-xs text-ink-primary dark:text-white focus:outline-none focus:border-brand transition-colors"
                  data-testid="friends-search-input"
                />
              </div>
            </div>

            {/* Danh sách bạn bè có thể thêm */}
            <div className="flex-1 overflow-y-auto py-2 flex flex-col gap-1">
              {isLoadingFriends ? (
                <div className="py-8 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-brand" />
                </div>
              ) : filteredFriends.length === 0 ? (
                <div className="py-8 text-center text-xs text-ink-muted">
                  {friendsSearch
                    ? `Không tìm thấy người dùng "${friendsSearch}"`
                    : friendsList.length === 0
                    ? 'Bạn chưa có bạn bè nào. Nhập tên hoặc username ở trên để tìm.'
                    : eligibleFriends.length === 0
                    ? 'Tất cả bạn bè của bạn đã có mặt trong nhóm'
                    : 'Không tìm thấy người dùng phù hợp'}
                </div>
              ) : (
                filteredFriends.map((friend) => {
                  const isSelected = selectedFriendIds.includes(friend.id)
                  return (
                    <div
                      key={friend.id}
                      onClick={() => handleToggleSelectFriend(friend.id)}
                      className={cn(
                        'flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors',
                        isSelected
                          ? 'bg-brand/10 dark:bg-brand/20'
                          : 'hover:bg-black/5 dark:hover:bg-white/5'
                      )}
                      data-testid={`friend-option-${friend.id}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Avatar className="w-8 h-8 rounded-full border border-border-light dark:border-white/10">
                          <AvatarImage src={friend.avatarUrl || undefined} />
                          <AvatarFallback className="bg-brand-soft text-brand text-xs font-semibold">
                            {friend.displayName[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-xs font-medium text-ink-primary dark:text-white">
                            {friend.displayName}
                          </p>
                          <p className="text-[10px] text-ink-muted">@{friend.username}</p>
                        </div>
                      </div>

                      <div
                        className={cn(
                          'w-5 h-5 rounded-md border flex items-center justify-center transition-all',
                          isSelected
                            ? 'bg-brand border-brand text-white'
                            : 'border-border-light dark:border-border-dark'
                        )}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border dark:border-white/10">
              <Dialog.Close asChild>
                <Button type="button" variant="ghost" disabled={isAddingMembers}>
                  Hủy
                </Button>
              </Dialog.Close>
              <Button
                type="button"
                onClick={handleAddMembersSubmit}
                disabled={isAddingMembers || selectedFriendIds.length === 0}
                className="bg-brand hover:bg-brand-hover text-white cursor-pointer"
                data-testid="add-members-submit-button"
              >
                {isAddingMembers ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  `Thêm (${selectedFriendIds.length})`
                )}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Modal 4: Xác nhận xóa thành viên (Kick) */}
      <Dialog.Root open={isKickConfirmOpen} onOpenChange={setIsKickConfirmOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 animate-in fade-in duration-150" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white dark:bg-[#17212B] text-ink-primary dark:text-white border border-border dark:border-white/10 p-5 rounded-2xl shadow-2xl z-50 animate-in zoom-in-95 duration-150 focus:outline-none">
            <Dialog.Title className="text-base font-bold text-ink-primary dark:text-white">
              Xóa thành viên khỏi nhóm?
            </Dialog.Title>
            <Dialog.Description className="text-xs text-ink-muted mt-2 leading-relaxed">
              Bạn có chắc chắn muốn xóa{' '}
              <strong className="text-ink-primary dark:text-white">
                {selectedMember?.user?.displayName || selectedMember?.user?.username}
              </strong>{' '}
              khỏi nhóm trò chuyện này không?
            </Dialog.Description>
            <div className="flex items-center justify-end gap-2 mt-5">
              <Dialog.Close asChild>
                <Button variant="ghost">Hủy</Button>
              </Dialog.Close>
              <Button
                variant="destructive"
                onClick={handleKickConfirm}
                className="bg-coral hover:bg-coral/90 text-white cursor-pointer"
                data-testid="confirm-kick-submit"
              >
                Xóa khỏi nhóm
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Modal 5: Xác nhận chuyển quyền Trưởng nhóm (Transfer Owner) */}
      <Dialog.Root open={isTransferConfirmOpen} onOpenChange={setIsTransferConfirmOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 animate-in fade-in duration-150" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white dark:bg-[#17212B] text-ink-primary dark:text-white border border-border dark:border-white/10 p-5 rounded-2xl shadow-2xl z-50 animate-in zoom-in-95 duration-150 focus:outline-none">
            <Dialog.Title className="text-base font-bold text-ink-primary dark:text-white">
              Chuyển quyền Trưởng nhóm?
            </Dialog.Title>
            <Dialog.Description className="text-xs text-ink-muted mt-2 leading-relaxed">
              Bạn sẽ chuyển quyền Trưởng nhóm cho{' '}
              <strong className="text-ink-primary dark:text-white">
                {selectedMember?.user?.displayName || selectedMember?.user?.username}
              </strong>
              . Bạn sẽ trở thành Quản trị viên của nhóm này.
            </Dialog.Description>
            <div className="flex items-center justify-end gap-2 mt-5">
              <Dialog.Close asChild>
                <Button variant="ghost">Hủy</Button>
              </Dialog.Close>
              <Button
                onClick={handleTransferOwnerConfirm}
                className="bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
                data-testid="confirm-transfer-submit"
              >
                Chuyển giao quyền
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Modal 6: Xác nhận Rời khỏi nhóm */}
      <Dialog.Root open={isLeaveGroupConfirmOpen} onOpenChange={setIsLeaveGroupConfirmOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 animate-in fade-in duration-150" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white dark:bg-[#17212B] text-ink-primary dark:text-white border border-border dark:border-white/10 p-5 rounded-2xl shadow-2xl z-50 animate-in zoom-in-95 duration-150 focus:outline-none">
            <Dialog.Title className="text-base font-bold text-ink-primary dark:text-white">
              Rời khỏi nhóm trò chuyện?
            </Dialog.Title>
            <Dialog.Description className="text-xs text-ink-muted mt-2 leading-relaxed">
              {isOwner && members.length > 1
                ? 'Bạn đang là Trưởng nhóm. Quyền Trưởng nhóm sẽ tự động được chuyển giao cho Quản trị viên hoặc thành viên tham gia lâu nhất.'
                : 'Bạn sẽ không thể gửi hoặc xem tin nhắn mới từ nhóm này nữa.'}
            </Dialog.Description>
            <div className="flex items-center justify-end gap-2 mt-5">
              <Dialog.Close asChild>
                <Button variant="ghost">Hủy</Button>
              </Dialog.Close>
              <Button
                variant="destructive"
                onClick={handleLeaveGroupConfirm}
                className="bg-coral hover:bg-coral/90 text-white cursor-pointer"
                data-testid="confirm-leave-group-submit"
              >
                Rời nhóm
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Modal 7: Xác nhận Chặn người dùng (Direct) - dùng chung với menu header */}
      <BlockUserConfirmDialog
        open={isBlockUserConfirmOpen}
        onOpenChange={setIsBlockUserConfirmOpen}
        name={partner?.displayName || conversation.name}
        onConfirm={blockPartner}
        isLoading={isBlocking}
      />
    </aside>
  )
}
