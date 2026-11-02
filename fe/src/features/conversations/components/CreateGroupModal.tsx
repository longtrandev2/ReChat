import React, { useEffect, useState, useMemo } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Users, X, Search, Check, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { conversationApi } from '../services/conversation.api'
import { friendsApi, type FriendUser } from '@/features/friends/services/friends.api'
import { userApi, type SearchedUser } from '@/features/users/services/user.api'
import { useConversationStore } from '../stores/conversation.store'
import { useAuthStore } from '@/stores/auth.store'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'

export interface CreateGroupModalProps {
  isOpen: boolean
  onClose: () => void
}

type SelectableUser = {
  id: string
  username: string
  displayName: string
  avatarUrl?: string | null
}

export function CreateGroupModal({ isOpen, onClose }: CreateGroupModalProps) {
  const navigate = useNavigate()
  const currentUser = useAuthStore((s) => s.user)
  const addOrUpdateConversation = useConversationStore((s) => s.addOrUpdateConversation)

  const [groupName, setGroupName] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])

  const [friends, setFriends] = useState<FriendUser[]>([])
  const [searchedUsers, setSearchedUsers] = useState<SearchedUser[]>([])
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleClose = () => {
    setGroupName('')
    setSearchQuery('')
    setSelectedUserIds([])
    setSearchedUsers([])
    onClose()
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSearchQuery(val)
    if (!val.trim()) {
      setSearchedUsers([])
    }
  }

  // Load danh sách bạn bè khi mở Modal
  useEffect(() => {
    if (!isOpen) return

    let isMounted = true
    const fetchFriends = async () => {
      try {
        setIsLoadingCandidates(true)
        const res = await friendsApi.getFriends({ limit: 50 })
        if (isMounted) {
          setFriends(res || [])
        }
      } catch {
        if (isMounted) {
          setFriends([])
        }
      } finally {
        if (isMounted) {
          setIsLoadingCandidates(false)
        }
      }
    }

    fetchFriends()
    return () => {
      isMounted = false
    }
  }, [isOpen])

  // Tìm kiếm người dùng trong hệ thống khi nhập từ khóa (debounce 300ms)
  useEffect(() => {
    if (!isOpen || !searchQuery.trim()) return

    const timer = setTimeout(async () => {
      try {
        const users = await userApi.searchUsers(searchQuery.trim())
        // Lọc bỏ tài khoản chính mình
        const filtered = (users || []).filter((u) => u.id !== currentUser?.id)
        setSearchedUsers(filtered)
      } catch {
        setSearchedUsers([])
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, isOpen, currentUser?.id])

  // Gộp danh sách bạn bè và kết quả tìm kiếm (loại trừ trùng lặp và chính mình)
  const candidateList = useMemo(() => {
    const map = new Map<string, SelectableUser>()

    // Ưu tiên bạn bè
    for (const f of friends) {
      if (f.id !== currentUser?.id) {
        map.set(f.id, {
          id: f.id,
          username: f.username,
          displayName: f.displayName || f.username,
          avatarUrl: f.avatarUrl,
        })
      }
    }

    // Thêm kết quả search nếu có
    for (const u of searchedUsers) {
      if (u.id !== currentUser?.id && !map.has(u.id)) {
        map.set(u.id, {
          id: u.id,
          username: u.username,
          displayName: u.displayName || u.username,
          avatarUrl: u.avatarUrl,
        })
      }
    }

    const all = Array.from(map.values())
    if (!searchQuery.trim()) {
      return all
    }

    const q = searchQuery.toLowerCase()
    return all.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q)
    )
  }, [friends, searchedUsers, searchQuery, currentUser?.id])

  // Danh sách các user đã được chọn
  const selectedUsers = useMemo(() => {
    const list: SelectableUser[] = []
    const map = new Map<string, SelectableUser>()

    for (const u of candidateList) {
      map.set(u.id, u)
    }

    for (const id of selectedUserIds) {
      const user = map.get(id)
      if (user) {
        list.push(user)
      } else {
        // Dự phòng nếu user chọn trước khi filter
        list.push({ id, username: id, displayName: 'Thành viên' })
      }
    }
    return list
  }, [candidateList, selectedUserIds])

  const handleToggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  const handleRemoveSelected = (userId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedUserIds((prev) => prev.filter((id) => id !== userId))
  }

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = groupName.trim()

    if (!trimmedName) {
      toast.error('Vui lòng nhập tên nhóm chat')
      return
    }

    if (trimmedName.length > 50) {
      toast.error('Tên nhóm không được vượt quá 50 ký tự')
      return
    }

    if (selectedUserIds.length < 1) {
      toast.error('Vui lòng chọn ít nhất 1 thành viên khác vào nhóm')
      return
    }

    try {
      setIsSubmitting(true)
      const newGroup = await conversationApi.createGroup({
        name: trimmedName,
        memberIds: selectedUserIds,
      })

      addOrUpdateConversation(newGroup)
      toast.success(`Đã tạo nhóm "${newGroup.name}" thành công!`)
      handleClose()
      navigate(`/chat/${newGroup.id}`)
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } }
      toast.error(error.response?.data?.message || 'Không thể tạo nhóm chat')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          data-testid="create-group-modal-overlay"
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 animate-in fade-in duration-150"
        />
        <Dialog.Content
          data-testid="create-group-modal-content"
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-surface-dark text-ink-primary dark:text-ink-primary-dark border border-border-light dark:border-border-dark p-6 rounded-2xl shadow-2xl z-50 animate-in zoom-in-95 duration-150 focus:outline-none flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-border-light dark:border-border-dark shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <Dialog.Title className="text-base font-bold text-ink-primary dark:text-ink-primary-dark">
                  Tạo nhóm chat mới
                </Dialog.Title>
                <Dialog.Description className="text-xs text-ink-secondary dark:text-ink-secondary-dark">
                  Kết nối nhiều bạn bè vào cùng một cuộc trò chuyện
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                data-testid="close-create-group-modal"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-secondary dark:text-ink-secondary-dark hover:bg-surface-hover dark:hover:bg-surface-dark-secondary transition-colors"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleCreateGroup} className="flex-1 flex flex-col min-h-0 pt-4">
            {/* Input Tên nhóm */}
            <div className="space-y-1.5 shrink-0">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="group-name-input"
                  className="text-xs font-semibold text-ink-secondary dark:text-ink-secondary-dark uppercase tracking-wider"
                >
                  Tên nhóm <span className="text-coral">*</span>
                </label>
                <span className="text-[11px] text-ink-muted">
                  {groupName.length}/50
                </span>
              </div>
              <input
                id="group-name-input"
                data-testid="group-name-input"
                type="text"
                autoFocus
                maxLength={50}
                placeholder="Nhập tên nhóm..."
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-light-2 dark:bg-[#242F3D] text-sm text-ink-primary dark:text-white border border-border-light dark:border-white/10 focus:outline-none focus:border-brand transition-colors"
              />
            </div>

            {/* Chips các thành viên đã chọn */}
            {selectedUsers.length > 0 && (
              <div
                data-testid="selected-members-container"
                className="flex items-center gap-1.5 flex-wrap pt-3 pb-1 shrink-0 max-h-24 overflow-y-auto"
              >
                {selectedUsers.map((u) => (
                  <span
                    key={u.id}
                    data-testid={`selected-chip-${u.id}`}
                    className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-full text-xs font-medium bg-brand/10 text-brand border border-brand/20 dark:border-brand/30"
                  >
                    <Avatar className="w-4 h-4">
                      {u.avatarUrl && <AvatarImage src={u.avatarUrl} alt={u.displayName} />}
                      <AvatarFallback className="text-[9px] font-bold">
                        {u.displayName.slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="max-w-[100px] truncate">{u.displayName}</span>
                    <button
                      type="button"
                      onClick={(e) => handleRemoveSelected(u.id, e)}
                      className="hover:text-coral transition-colors ml-0.5"
                      title="Gỡ thành viên"
                      aria-label={`Gỡ ${u.displayName}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Ô tìm kiếm thành viên */}
            <div className="pt-3 pb-2 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  data-testid="member-search-input"
                  placeholder="Tìm bạn bè hoặc username..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-surface-light-2 dark:bg-[#242F3D] text-xs text-ink-primary dark:text-white border border-border-light dark:border-white/10 focus:outline-none focus:border-brand transition-colors"
                />
              </div>
            </div>

            {/* Danh sách người dùng để chọn */}
            <div
              data-testid="member-candidates-list"
              className="flex-1 overflow-y-auto min-h-[160px] max-h-[240px] divide-y divide-border-light/50 dark:divide-border-dark/50 border border-border-light dark:border-border-dark rounded-xl"
            >
              {isLoadingCandidates ? (
                <div className="h-full flex items-center justify-center p-6 text-ink-muted gap-2 text-xs">
                  <Loader2 className="w-4 h-4 animate-spin text-brand" />
                  <span>Đang tải danh sách...</span>
                </div>
              ) : candidateList.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center text-xs text-ink-muted">
                  <Users className="w-8 h-8 stroke-1 text-ink-muted/50 mb-1.5" />
                  <p>
                    {searchQuery
                      ? `Không tìm thấy người dùng "${searchQuery}"`
                      : 'Chưa có bạn bè nào'}
                  </p>
                  <p className="text-[11px] text-ink-muted/80 mt-0.5">
                    Hãy nhập tên hoặc username ở trên để tìm kiếm
                  </p>
                </div>
              ) : (
                candidateList.map((user) => {
                  const isSelected = selectedUserIds.includes(user.id)
                  const initials = user.displayName
                    .split(' ')
                    .map((w) => w[0])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join('')
                    .toUpperCase() || 'U'

                  return (
                    <div
                      key={user.id}
                      data-testid={`candidate-user-${user.id}`}
                      onClick={() => handleToggleUser(user.id)}
                      className={`flex items-center justify-between p-2.5 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-brand/5 dark:bg-brand/10'
                          : 'hover:bg-surface-hover dark:hover:bg-surface-dark-secondary'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar className="w-8 h-8 shrink-0">
                          {user.avatarUrl && (
                            <AvatarImage src={user.avatarUrl} alt={user.displayName} />
                          )}
                          <AvatarFallback className="text-xs font-semibold">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-ink-primary dark:text-white truncate">
                            {user.displayName}
                          </p>
                          <p className="text-[11px] text-ink-muted truncate">
                            @{user.username}
                          </p>
                        </div>
                      </div>

                      <div
                        data-testid={`candidate-checkbox-${user.id}`}
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                          isSelected
                            ? 'bg-brand border-brand text-white'
                            : 'border-border-light dark:border-border-dark bg-transparent'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Validation note & Action Buttons */}
            <div className="pt-4 flex items-center justify-between shrink-0">
              <span className="text-xs text-ink-secondary dark:text-ink-secondary-dark">
                Đã chọn:{' '}
                <strong className={selectedUserIds.length >= 1 ? 'text-brand' : 'text-coral'}>
                  {selectedUserIds.length}
                </strong>{' '}
                thành viên
              </span>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="cursor-pointer"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  data-testid="submit-create-group"
                  disabled={!groupName.trim() || selectedUserIds.length < 1 || isSubmitting}
                  className="bg-brand hover:bg-brand-hover text-white px-4 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      Đang tạo...
                    </>
                  ) : (
                    'Tạo nhóm'
                  )}
                </Button>
              </div>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
