import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { KeyRound, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getApiErrorMessage } from '@/lib/utils'
import { settingsApi } from '../services/settings.api'
import { changePasswordSchema, type ChangePasswordFormData } from '../schemas/settings.schema'
import { PasswordField } from './PasswordField'
import { SettingsCard } from './SettingsCard'

const EMPTY_FORM: ChangePasswordFormData = { currentPassword: '', newPassword: '', confirmPassword: '' }

/**
 * ChangePasswordCard: Form đổi mật khẩu (FR-49, BR-39).
 * Thành công: toast + reset form; các thiết bị khác bị đăng xuất phía server.
 */
export function ChangePasswordCard() {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: EMPTY_FORM,
  })

  const onSubmit = async (data: ChangePasswordFormData) => {
    try {
      const result = await settingsApi.changePassword(data)
      reset(EMPTY_FORM)
      toast.success('Đổi mật khẩu thành công', {
        description:
          result.revokedSessions > 0
            ? `Đã đăng xuất ${result.revokedSessions} thiết bị khác để bảo vệ tài khoản.`
            : undefined,
      })
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status
      const message = getApiErrorMessage(error, 'Không thể đổi mật khẩu lúc này')
      if (status === 401) {
        // Sai mật khẩu hiện tại: hiển thị lỗi đỏ ngay tại ô nhập
        setError('currentPassword', { message })
        return
      }
      toast.error(message)
    }
  }

  return (
    <SettingsCard
      title="Đổi mật khẩu"
      description="Tối thiểu 8 ký tự, gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt. Các thiết bị khác sẽ bị đăng xuất."
      icon={<KeyRound className="w-4.5 h-4.5" />}
      testId="change-password-card"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md" noValidate>
        <PasswordField
          id="currentPassword"
          label="Mật khẩu hiện tại"
          autoComplete="current-password"
          disabled={isSubmitting}
          errorMessage={errors.currentPassword?.message}
          {...register('currentPassword')}
        />
        <PasswordField
          id="newPassword"
          label="Mật khẩu mới"
          autoComplete="new-password"
          disabled={isSubmitting}
          errorMessage={errors.newPassword?.message}
          {...register('newPassword')}
        />
        <PasswordField
          id="confirmPassword"
          label="Xác nhận mật khẩu mới"
          autoComplete="new-password"
          disabled={isSubmitting}
          errorMessage={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <Button type="submit" size="sm" disabled={isSubmitting} className="gap-1.5">
          {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Cập nhật mật khẩu
        </Button>
      </form>
    </SettingsCard>
  )
}
