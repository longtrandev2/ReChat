import { Laptop, Smartphone, Monitor, LogOut } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { vi } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import type { SessionDevice } from '../types/settings.types'
import { describeUserAgent } from '../utils/describe-user-agent'

interface SessionDeviceItemProps {
  session: SessionDevice
  isCurrent: boolean
  onRequestRevoke: (session: SessionDevice) => void
}

const DEVICE_ICONS = {
  desktop: Laptop,
  mobile: Smartphone,
  other: Monitor,
} as const

/**
 * SessionDeviceItem: một thiết bị đang đăng nhập (icon theo loại thiết bị, IP, lần hoạt động gần nhất)
 */
export function SessionDeviceItem({ session, isCurrent, onRequestRevoke }: SessionDeviceItemProps) {
  const device = describeUserAgent(session.userAgent)
  const Icon = DEVICE_ICONS[device.kind]
  const lastActive = session.lastActiveAt
    ? formatDistanceToNow(new Date(session.lastActiveAt), { addSuffix: true, locale: vi })
    : null

  return (
    <li
      className="flex items-center gap-3.5 py-3.5 first:pt-0 last:pb-0"
      data-testid={`session-item-${session.deviceId}`}
    >
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
          isCurrent
            ? 'bg-brand-soft dark:bg-brand/15 text-brand dark:text-brand-accent'
            : 'bg-surface-light-2 dark:bg-[#242F3D] text-ink-secondary dark:text-ink-secondary-dark'
        }`}
      >
        <Icon className="w-5 h-5" aria-hidden="true" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-ink-primary dark:text-ink-primary-dark truncate">{device.label}</p>
          {isCurrent && (
            <span className="text-[11px] font-semibold text-presence-online bg-presence-online/10 px-2 py-0.5 rounded-full">
              Thiết bị này
            </span>
          )}
        </div>
        <p className="text-xs text-ink-muted mt-0.5 truncate">
          {session.ip && session.ip !== 'unknown' ? `IP ${session.ip}` : 'IP không xác định'}
          {lastActive && ` • Hoạt động ${lastActive}`}
        </p>
      </div>

      {!isCurrent && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onRequestRevoke(session)}
          className="text-coral hover:text-coral hover:bg-coral-soft/60 dark:hover:bg-rose-950/30 gap-1.5 shrink-0"
          data-testid={`revoke-session-${session.deviceId}`}
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Đăng xuất</span>
        </Button>
      )}
    </li>
  )
}
