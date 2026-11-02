import { useState } from 'react'
import { Loader2, MailCheck } from 'lucide-react'
import { toast } from 'sonner'
import { OtpInput } from '@/components/ui/otp-input'
import { Button } from '@/components/ui/button'
import { getApiErrorMessage } from '@/lib/utils'
import { useCountdown } from '@/features/auth/hooks/useCountdown'
import { settingsApi } from '../services/settings.api'
import { SettingsDialog } from './SettingsDialog'

const OTP_RESEND_SECONDS = 60

interface Enable2FaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  maskedEmail: string
  onEnabled: () => void
}

/**
 * Enable2FaDialog: nhập OTP 6 số gửi về email để kích hoạt 2FA (FR-25).
 * Đếm ngược 60 giây trước khi cho phép gửi lại mã.
 */
export function Enable2FaDialog({ open, onOpenChange, maskedEmail, onEnabled }: Enable2FaDialogProps) {
  return (
    <SettingsDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Bật xác thực 2 bước"
      icon={<MailCheck className="w-5 h-5" />}
      description={
        <>
          Nhập mã 6 số vừa được gửi tới <span className="font-semibold text-ink-primary dark:text-white">{maskedEmail}</span>.
        </>
      }
      testId="enable-2fa-dialog"
    >
      {/* Mount lại mỗi lần mở dialog => OTP và đồng hồ đếm ngược tự reset */}
      <Enable2FaOtpForm onEnabled={onEnabled} onCancel={() => onOpenChange(false)} />
    </SettingsDialog>
  )
}

function Enable2FaOtpForm({ onEnabled, onCancel }: { onEnabled: () => void; onCancel: () => void }) {
  const [otp, setOtp] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [hasError, setHasError] = useState(false)
  const { isFinished, formattedTime, start } = useCountdown(OTP_RESEND_SECONDS)

  const handleVerify = async (code: string) => {
    if (code.length !== 6 || isVerifying) return
    try {
      setIsVerifying(true)
      setHasError(false)
      await settingsApi.enable2fa(code)
      toast.success('Đã bật xác thực 2 bước')
      onEnabled()
    } catch (error) {
      setHasError(true)
      setOtp('')
      toast.error(getApiErrorMessage(error, 'Mã xác thực không chính xác'))
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResend = async () => {
    try {
      setIsResending(true)
      await settingsApi.send2faSetupOtp()
      setOtp('')
      setHasError(false)
      start(OTP_RESEND_SECONDS)
      toast.success('Đã gửi lại mã xác thực')
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Không thể gửi lại mã lúc này'))
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="space-y-5">
      <OtpInput
        value={otp}
        onChange={(value) => {
          setOtp(value)
          setHasError(false)
        }}
        onComplete={handleVerify}
        disabled={isVerifying}
        error={hasError}
      />

      <div className="text-center text-xs text-ink-secondary dark:text-ink-secondary-dark">
        {isFinished ? (
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending}
            className="text-brand dark:text-brand-accent font-semibold hover:underline disabled:opacity-60 cursor-pointer"
          >
            {isResending ? 'Đang gửi...' : 'Gửi lại mã OTP'}
          </button>
        ) : (
          <span data-testid="otp-countdown">Gửi lại mã sau {formattedTime}</span>
        )}
      </div>

      <div className="flex items-center justify-end gap-2.5">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isVerifying}>
          Hủy
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => handleVerify(otp)}
          disabled={otp.length !== 6 || isVerifying}
          className="gap-1.5"
        >
          {isVerifying && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Xác nhận
        </Button>
      </div>
    </div>
  )
}
