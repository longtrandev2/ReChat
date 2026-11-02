import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, LogOut, MonitorSmartphone, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { getApiErrorMessage } from '@/lib/utils'
import { getDeviceId } from '@/lib/device-id'
import { settingsApi } from '../services/settings.api'
import type { SessionDevice } from '../types/settings.types'
import { describeUserAgent } from '../utils/describe-user-agent'
import { SettingsCard } from './SettingsCard'
import { SettingsDialog } from './SettingsDialog'
import { SessionDeviceItem } from './SessionDeviceItem'

/**
 * SessionsTab: quản lý thiết bị đang đăng nhập và đăng xuất từ xa (FR-27, BR-27)
 */
export function SessionsTab() {
  const [sessions, setSessions] = useState<SessionDevice[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<SessionDevice | null>(null)
  const [isRevoking, setIsRevoking] = useState(false)

  const currentDeviceId = useMemo(() => getDeviceId(), [])
  const isCurrent = useCallback(
    (s: SessionDevice) => s.isCurrentDevice || s.deviceId === currentDeviceId,
    [currentDeviceId]
  )

  // Chỉ setState trong callback bất đồng bộ (tránh cascading render khi gọi từ effect)
  const fetchSessions = useCallback(() => {
    return settingsApi
      .getSessions()
      .then((data) => setSessions(data))
      .catch((error) => setLoadError(getApiErrorMessage(error, 'Không thể tải danh sách thiết bị')))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    void fetchSessions()
  }, [fetchSessions])

  const loadSessions = () => {
    setIsLoading(true)
    setLoadError(null)
    void fetchSessions()
  }

  // Thiết bị hiện tại luôn đứng đầu danh sách
  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => Number(isCurrent(b)) - Number(isCurrent(a))),
    [sessions, isCurrent]
  )

  const handleConfirmRevoke = async () => {
    if (!revokeTarget) return
    try {
      setIsRevoking(true)
      await settingsApi.revokeSession(revokeTarget.deviceId)
      setSessions((prev) => prev.filter((s) => s.deviceId !== revokeTarget.deviceId))
      toast.success('Đã đăng xuất thiết bị')
      setRevokeTarget(null)
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Không thể đăng xuất thiết bị lúc này'))
    } finally {
      setIsRevoking(false)
    }
  }

  return (
    <div data-testid="sessions-tab">
      <SettingsCard
        title="Thiết bị & Phiên đăng nhập"
        description="Đăng xuất những thiết bị bạn không nhận ra. Thiết bị đó sẽ phải đăng nhập lại."
        icon={<MonitorSmartphone className="w-4.5 h-4.5" />}
        action={
          <Button type="button" variant="ghost" size="sm" onClick={loadSessions} disabled={isLoading} aria-label="Tải lại danh sách thiết bị">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        }
      >
        {isLoading && sessions.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-ink-muted" data-testid="sessions-loading">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : loadError ? (
          <div className="text-center py-8 space-y-3">
            <p className="text-sm text-coral">{loadError}</p>
            <Button type="button" variant="outline" size="sm" onClick={loadSessions}>
              Thử lại
            </Button>
          </div>
        ) : sortedSessions.length === 0 ? (
          <p className="text-sm text-ink-secondary text-center py-8">Không có phiên đăng nhập nào đang hoạt động.</p>
        ) : (
          <ul className="divide-y divide-border/60 dark:divide-border-dark">
            {sortedSessions.map((session) => (
              <SessionDeviceItem
                key={session.deviceId}
                session={session}
                isCurrent={isCurrent(session)}
                onRequestRevoke={setRevokeTarget}
              />
            ))}
          </ul>
        )}
      </SettingsCard>

      <SettingsDialog
        open={Boolean(revokeTarget)}
        onOpenChange={(open) => !open && !isRevoking && setRevokeTarget(null)}
        title="Đăng xuất thiết bị"
        tone="danger"
        icon={<LogOut className="w-5 h-5" />}
        description={
          revokeTarget ? (
            <>
              Đăng xuất <span className="font-semibold text-ink-primary dark:text-white">{describeUserAgent(revokeTarget.userAgent).label}</span>?
              Thiết bị này sẽ mất quyền truy cập ngay lập tức.
            </>
          ) : undefined
        }
        testId="revoke-session-dialog"
      >
        <div className="flex items-center justify-end gap-2.5">
          <Button type="button" variant="outline" size="sm" onClick={() => setRevokeTarget(null)} disabled={isRevoking}>
            Hủy
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleConfirmRevoke}
            disabled={isRevoking}
            className="gap-1.5"
            data-testid="confirm-revoke-session"
          >
            {isRevoking && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Đăng xuất
          </Button>
        </div>
      </SettingsDialog>
    </div>
  )
}
