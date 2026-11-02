import { useState, type FormEvent } from 'react'
import { Loader2, ShieldOff } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { getApiErrorMessage } from '@/lib/utils'
import { settingsApi } from '../services/settings.api'
import { PasswordField } from './PasswordField'
import { SettingsDialog } from './SettingsDialog'

interface Disable2FaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDisabled: () => void
}

/**
 * Disable2FaDialog: yêu cầu mật khẩu hiện tại để tắt 2FA an toàn (FR-25).
 */
export function Disable2FaDialog({ open, onOpenChange, onDisabled }: Disable2FaDialogProps) {
  return (
    <SettingsDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Tắt xác thực 2 bước"
      tone="danger"
      icon={<ShieldOff className="w-5 h-5" />}
      description="Tài khoản sẽ kém an toàn hơn. Nhập mật khẩu hiện tại để xác nhận."
      testId="disable-2fa-dialog"
    >
      <Disable2FaForm onDisabled={onDisabled} onCancel={() => onOpenChange(false)} />
    </SettingsDialog>
  )
}

function Disable2FaForm({ onDisabled, onCancel }: { onDisabled: () => void; onCancel: () => void }) {
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string>()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!password) {
      setErrorMessage('Vui lòng nhập mật khẩu hiện tại')
      return
    }
    try {
      setIsSubmitting(true)
      await settingsApi.disable2fa(password)
      toast.success('Đã tắt xác thực 2 bước')
      onDisabled()
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Không thể tắt xác thực 2 bước'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <PasswordField
        id="disable2faPassword"
        label="Mật khẩu hiện tại"
        autoComplete="current-password"
        value={password}
        onChange={(e) => {
          setPassword(e.target.value)
          setErrorMessage(undefined)
        }}
        disabled={isSubmitting}
        errorMessage={errorMessage}
        autoFocus
      />
      <div className="flex items-center justify-end gap-2.5">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isSubmitting}>
          Hủy
        </Button>
        <Button type="submit" variant="destructive" size="sm" disabled={isSubmitting} className="gap-1.5">
          {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Tắt 2FA
        </Button>
      </div>
    </form>
  )
}
