import { useState } from 'react'
import { ShieldCheck, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'
import type { BlockedUser } from '../types/friends.types'

interface BlockedUserCardProps {
  user: BlockedUser
  onUnblock: (userId: string) => Promise<void>
}

/**
 * BlockedUserCard: Card hiển thị thông tin người dùng đã bị chặn (FR-29)
 * - Hiển thị avatar, tên hiển thị, username
 * - Thời gian đã chặn
 * - Nút "Bỏ chặn" với trạng thái loading
 */
export function BlockedUserCard({ user, onUnblock }: BlockedUserCardProps) {
  const [isLoading, setIsLoading] = useState(false)

  const initials = user.displayName
    ? user.displayName
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U'

  const formattedDate = user.blockedAt
    ? format(new Date(user.blockedAt), 'dd/MM/yyyy', { locale: vi })
    : null

  const handleUnblock = async () => {
    if (isLoading) return
    setIsLoading(true)
    try {
      await onUnblock(user.id)
      toast.success(`Đã bỏ chặn ${user.displayName}`)
    } catch (err) {
      console.error('Failed to unblock user:', err)
      toast.error('Không thể bỏ chặn người dùng lúc này')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="bg-surface dark:bg-[#17212B] border border-border/80 dark:border-border-dark rounded-2xl p-4 shadow-2xs hover:shadow-md hover:border-brand/40 dark:hover:border-brand-accent/40 transition-all flex items-center justify-between gap-4 group"
      data-testid={`blocked-user-card-${user.id}`}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <Avatar size="lg" className="ring-2 ring-transparent group-hover:ring-brand/30 transition-all shrink-0">
          {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.displayName} />}
          <AvatarFallback className="bg-coral-soft/50 dark:bg-rose-950/30 text-coral dark:text-rose-400 font-semibold text-sm">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0">
          <h3
            className="font-semibold text-ink-primary dark:text-ink-primary-dark text-sm sm:text-base truncate"
            title={user.displayName}
          >
            {user.displayName}
          </h3>
          <p className="text-xs text-ink-secondary dark:text-ink-secondary-dark truncate">
            @{user.username}
          </p>
          {formattedDate && (
            <p className="text-[11px] text-ink-muted mt-1 select-none">
              Đã chặn từ {formattedDate}
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        disabled={isLoading}
        onClick={handleUnblock}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-border dark:border-border-dark text-ink-primary dark:text-white hover:bg-black/5 dark:hover:bg-white/10 hover:border-brand/50 dark:hover:border-brand-accent/50 transition-all shrink-0 cursor-pointer disabled:opacity-50"
        data-testid={`unblock-btn-${user.id}`}
      >
        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <ShieldCheck className="w-3.5 h-3.5 text-presence-online" />
        )}
        <span>{isLoading ? 'Đang bỏ chặn...' : 'Bỏ chặn'}</span>
      </button>
    </div>
  )
}
