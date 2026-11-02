import { useState } from 'react'
import { Loader2, ShieldCheck, ShieldAlert, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { getApiErrorMessage } from '@/lib/utils'
import type { UserProfile } from '@/types/auth.types'
import { settingsApi } from '../services/settings.api'
import { patchAuthUser } from '../utils/patch-auth-user'
import { SettingsCard } from './SettingsCard'
import { Enable2FaDialog } from './Enable2FaDialog'
import { Disable2FaDialog } from './Disable2FaDialog'

interface Security2FaTabProps {
  user: UserProfile
}

/**
 * Security2FaTab: trạng thái và bật/tắt xác thực 2 bước qua Email OTP (FR-25, BR-25)
 */
export function Security2FaTab({ user }: Security2FaTabProps) {
  const isEnabled = Boolean(user.twoFactorEnabled)
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [maskedEmail, setMaskedEmail] = useState('')
  const [isEnableOpen, setIsEnableOpen] = useState(false)
  const [isDisableOpen, setIsDisableOpen] = useState(false)

  const handleStartEnable = async () => {
    try {
      setIsSendingOtp(true)
      const res = await settingsApi.send2faSetupOtp()
      setMaskedEmail(res.maskedEmail)
      setIsEnableOpen(true)
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Không thể gửi mã xác thực lúc này'))
    } finally {
      setIsSendingOtp(false)
    }
  }

  return (
    <div className="space-y-5" data-testid="security-tab">
      <SettingsCard
        title="Xác thực 2 bước (2FA)"
        description="Mỗi lần đăng nhập, ReChat gửi thêm một mã OTP về email để chắc chắn đó là bạn."
        icon={<ShieldCheck className="w-4.5 h-4.5" />}
        action={
          isEnabled ? (
            <span
              className="inline-flex items-center gap-1 text-xs font-semibold text-presence-online bg-presence-online/10 px-2.5 py-1 rounded-full"
              data-testid="2fa-status-badge"
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Đang kích hoạt
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 text-xs font-semibold text-ink-secondary bg-black/5 dark:bg-white/10 px-2.5 py-1 rounded-full"
              data-testid="2fa-status-badge"
            >
              <ShieldAlert className="w-3.5 h-3.5" /> Chưa kích hoạt
            </span>
          )
        }
      >
        <div className="flex items-start gap-3 rounded-xl bg-surface-light-2 dark:bg-[#242F3D] p-4 mb-5">
          <Mail className="w-4.5 h-4.5 text-brand dark:text-brand-accent shrink-0 mt-0.5" />
          <p className="text-xs sm:text-sm text-ink-secondary dark:text-ink-secondary-dark leading-relaxed">
            {user.email ? (
              <>
                Mã OTP sẽ được gửi tới <span className="font-semibold text-ink-primary dark:text-white">{user.email}</span>.
                Dù kẻ xấu biết mật khẩu, họ vẫn không thể đăng nhập nếu không có quyền truy cập email của bạn.
              </>
            ) : (
              'Tài khoản chưa có email nên chưa thể bật xác thực 2 bước.'
            )}
          </p>
        </div>

        {isEnabled ? (
          <Button type="button" variant="destructive" size="sm" onClick={() => setIsDisableOpen(true)}>
            Tắt xác thực 2 bước
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            onClick={handleStartEnable}
            disabled={isSendingOtp || !user.email}
            className="gap-1.5"
          >
            {isSendingOtp && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Bật xác thực 2 bước
          </Button>
        )}
      </SettingsCard>

      <Enable2FaDialog
        open={isEnableOpen}
        onOpenChange={setIsEnableOpen}
        maskedEmail={maskedEmail}
        onEnabled={() => {
          patchAuthUser({ twoFactorEnabled: true })
          setIsEnableOpen(false)
        }}
      />

      <Disable2FaDialog
        open={isDisableOpen}
        onOpenChange={setIsDisableOpen}
        onDisabled={() => {
          patchAuthUser({ twoFactorEnabled: false })
          setIsDisableOpen(false)
        }}
      />
    </div>
  )
}
