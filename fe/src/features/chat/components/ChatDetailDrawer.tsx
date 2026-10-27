import { useState, useMemo } from 'react'
import {
  X,
  Bell,
  BellOff,
  Search,
  FileText,
  Image as ImageIcon,
  Users,
  ShieldCheck,
  Download,
} from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage, PresenceDot } from '@/components/ui/avatar'
import { formatFileSize, cn } from '@/lib/utils'
import type { Conversation, ConversationMemberUser } from '@/features/conversations/types/conversation.types'
import type { Message } from '../types/message.types'

interface ChatDetailDrawerProps {
  isOpen: boolean
  onClose: () => void
  conversation: Conversation
  partner?: ConversationMemberUser | null
  isOnline?: boolean
  messages: Message[]
  onImageClick?: (imageUrl: string, altText?: string) => void
  onSearchClick?: () => void
}

type TabType = 'media' | 'files'

/**
 * ChatDetailDrawer: Bảng thông tin chi tiết cuộc trò chuyện chuẩn Telegram Web / Messenger
 * - Mở rộng bên phải màn hình (Right Panel) lấp đầy khoảng trống desktop một cách chuyên nghiệp
 * - Hiển thị Avatar lớn, Tên, Username, Trạng thái online, Danh sách thành viên (Group)
 * - Thư viện nội dung đã chia sẻ: Tab Ảnh (Grid thumbnail) & Tab Tệp tin (Download)
 * - Tương thích mượt mà cả chế độ Light và Dark mode
 */
export function ChatDetailDrawer({
  isOpen,
  onClose,
  conversation,
  partner,
  isOnline = false,
  messages,
  onImageClick,
  onSearchClick,
}: ChatDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('media')
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    try {
      return localStorage.getItem(`rechat_muted_${conversation.id}`) === 'true'
    } catch {
      return false
    }
  })

  const isGroup = conversation.type === 'GROUP'

  // Bóc tách danh sách ảnh đã chia sẻ trong cuộc trò chuyện
  const sharedImages = useMemo(() => {
    return messages
      .filter((m) => m.type === 'IMAGE' && m.fileUrl && !m.isRecalled)
      .map((m) => ({
        id: m.id,
        url: m.fileUrl!,
        caption: m.content || 'Hình ảnh',
        createdAt: m.createdAt,
      }))
  }, [messages])

  // Bóc tách danh sách tệp tin đã chia sẻ
  const sharedFiles = useMemo(() => {
    return messages
      .filter((m) => m.type === 'FILE' && m.fileUrl && !m.isRecalled)
      .map((m) => ({
        id: m.id,
        url: m.fileUrl!,
        name: m.content || 'Tệp đính kèm',
        size: m.fileSize,
        createdAt: m.createdAt,
      }))
  }, [messages])

  const initials = (isGroup ? conversation.name : partner?.displayName || conversation.name || 'U')
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U'

  const handleToggleMute = () => {
    const next = !isMuted
    setIsMuted(next)
    try {
      localStorage.setItem(`rechat_muted_${conversation.id}`, String(next))
    } catch {
      // ignore storage quota error
    }
    toast.success(next ? 'Đã tắt thông báo cuộc trò chuyện' : 'Đã bật lại thông báo')
  }

  const handleDownloadFile = async (e: React.MouseEvent, url: string, fileName: string) => {
    e.stopPropagation()
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
      window.open(url, '_blank')
    }
  }

  if (!isOpen) return null

  return (
    <aside
      className="w-80 md:w-88 border-l border-border-light/80 dark:border-border-dark bg-white dark:bg-[#17212B] flex flex-col h-full shrink-0 select-none z-30 shadow-lg transition-all animate-in slide-in-from-right duration-200"
      data-testid="chat-detail-drawer"
    >
      {/* Top Header Drawer */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-border-light/60 dark:border-border-dark shrink-0">
        <h3 className="font-semibold text-sm text-ink-primary dark:text-[#F5F5F7]">
          {isGroup ? 'Thông tin nhóm' : 'Thông tin người dùng'}
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

      <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col p-4 gap-5">
        {/* Profile Card Section */}
        <div className="flex flex-col items-center text-center pt-2">
          <div className="relative mb-3">
            <Avatar className="w-24 h-24 border-2 border-border-light dark:border-white/15 shadow-md">
              <AvatarImage
                src={(isGroup ? conversation.avatarUrl : partner?.avatarUrl || conversation.avatarUrl) || undefined}
                alt={isGroup ? conversation.name : partner?.displayName || conversation.name}
              />
              <AvatarFallback className="bg-brand-soft text-brand font-bold text-2xl">
                {isGroup ? <Users className="w-10 h-10" /> : initials}
              </AvatarFallback>
            </Avatar>
            {!isGroup && (
              <span className="absolute bottom-1 right-1">
                <PresenceDot status={isOnline ? 'online' : 'offline'} />
              </span>
            )}
          </div>

          <h2 className="text-base font-bold text-ink-primary dark:text-white truncate max-w-full">
            {isGroup ? conversation.name : partner?.displayName || conversation.name}
          </h2>

          <p className="text-xs text-ink-muted mt-0.5">
            {isGroup
              ? `${conversation.memberCount || conversation.members?.length || 2} thành viên`
              : partner?.username
              ? `@${partner.username}`
              : isOnline
              ? 'Đang trực tuyến'
              : 'Ngoại tuyến'}
          </p>

          {/* Quick Actions (Mute, Search) */}
          <div className="flex items-center gap-3 mt-4">
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

        {/* Group Members Section (Nếu là Nhóm trò chuyện) */}
        {isGroup && conversation.members && conversation.members.length > 0 && (
          <div className="flex flex-col gap-2 pt-2 border-t border-border-light/60 dark:border-white/10">
            <div className="flex items-center justify-between text-xs font-semibold text-ink-secondary dark:text-ink-secondary-dark">
              <span>Thành viên ({conversation.members.length})</span>
            </div>
            <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
              {conversation.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  <Avatar className="w-8 h-8 rounded-full border border-border-light dark:border-white/10">
                    <AvatarImage src={member.user?.avatarUrl || undefined} />
                    <AvatarFallback className="bg-brand-soft text-brand text-[11px] font-semibold">
                      {(member.user?.displayName || member.user?.username || 'U')[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-ink-primary dark:text-[#F5F5F7] truncate">
                      {member.user?.displayName || member.user?.username}
                    </p>
                    <p className="text-[10px] text-ink-muted truncate">
                      {member.role === 'OWNER'
                        ? 'Trưởng nhóm'
                        : member.role === 'ADMIN'
                        ? 'Quản trị viên'
                        : 'Thành viên'}
                    </p>
                  </div>
                  {member.role === 'OWNER' && (
                    <ShieldCheck className="w-4 h-4 text-brand shrink-0" title="Trưởng nhóm" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Shared Content Section Tabs (Ảnh & Tệp tin) */}
        <div className="flex flex-col flex-1 pt-2 border-t border-border-light/60 dark:border-white/10">
          {/* Tab Selector */}
          <div className="flex items-center p-0.5 rounded-xl bg-surface-light-2 dark:bg-[#242F3D] mb-3">
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
              <span>Ảnh ({sharedImages.length})</span>
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
              <span>Tệp ({sharedFiles.length})</span>
            </button>
          </div>

          {/* Tab 1: Grid Hình ảnh */}
          {activeTab === 'media' && (
            <div className="flex-1">
              {sharedImages.length === 0 ? (
                <div className="py-8 text-center text-xs text-ink-muted">
                  Chưa có hình ảnh nào được chia sẻ
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5" data-testid="shared-media-grid">
                  {sharedImages.map((img) => (
                    <div
                      key={img.id}
                      onClick={() => onImageClick?.(img.url, img.caption)}
                      className="aspect-square rounded-lg overflow-hidden bg-black/5 dark:bg-black/20 cursor-pointer group/thumb relative border border-black/5 dark:border-white/5"
                    >
                      <img
                        src={img.url}
                        alt={img.caption}
                        className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-150"
                        loading="lazy"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Danh sách Tệp tin */}
          {activeTab === 'files' && (
            <div className="flex-1">
              {sharedFiles.length === 0 ? (
                <div className="py-8 text-center text-xs text-ink-muted">
                  Chưa có tệp tin nào được chia sẻ
                </div>
              ) : (
                <div className="flex flex-col gap-1.5" data-testid="shared-files-list">
                  {sharedFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-2.5 p-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors group/file cursor-pointer"
                      onClick={(e) => handleDownloadFile(e, file.url, file.name)}
                    >
                      <div className="w-8 h-8 rounded-lg bg-brand/10 dark:bg-brand/20 text-brand flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-ink-primary dark:text-[#F5F5F7] truncate">
                          {file.name}
                        </p>
                        <p className="text-[10px] text-ink-muted">
                          {file.size ? formatFileSize(file.size) : 'Tài liệu'}
                        </p>
                      </div>
                      <button
                        type="button"
                        title="Tải tệp xuống"
                        aria-label="Tải tệp xuống"
                        className="p-1 rounded-full text-ink-secondary dark:text-ink-secondary-dark hover:text-brand transition-colors shrink-0"
                        onClick={(e) => handleDownloadFile(e, file.url, file.name)}
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
