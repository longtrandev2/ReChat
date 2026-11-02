import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2, ArrowLeft, KeyRound } from 'lucide-react'

import { AuthLayout } from '@/components/common/AuthLayout'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  resetPasswordSchema,
  type ResetPasswordFormData,
} from '@/features/auth/schemas/auth.schema'
import { authApi } from '@/features/auth/services/auth.api'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token: token,
      newPassword: '',
      confirmPassword: '',
    },
  })

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) {
      toast.error('Thiếu mã token xác thực. Vui lòng kiểm tra lại liên kết trong email.')
      return
    }

    try {
      await authApi.resetPassword({
        token,
        newPassword: data.newPassword,
        confirmPassword: data.confirmPassword,
      })
      toast.success('Mật khẩu đã được đặt lại thành công! Vui lòng đăng nhập lại.')
      navigate('/login', { replace: true })
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.'
      toast.error(msg)
    }
  }

  // Fallback if accessed without token in URL
  if (!token) {
    return (
      <AuthLayout
        title="Đặt lại mật khẩu"
        subtitle="Không tìm thấy mã token xác thực hợp lệ."
      >
        <div className="text-center py-6 space-y-4">
          <p className="text-sm text-ink-secondary dark:text-ink-secondary-dark">
            Liên kết của bạn có thể bị thiếu mã token hoặc đã hết hạn. Vui lòng yêu cầu gửi lại email khôi phục mật khẩu.
          </p>
          <Button asChild className="w-full">
            <Link to="/forgot-password">Yêu cầu liên kết mới</Link>
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Tạo mật khẩu mới"
      subtitle="Thiết lập mật khẩu mới an toàn cho tài khoản ReChat của bạn."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Token Info Pill */}
        <div className="flex items-center justify-center gap-2 bg-brand-soft/30 dark:bg-brand-dark/20 py-2 px-3 rounded-xl border border-border-light dark:border-border-dark text-center">
          <KeyRound className="w-4 h-4 text-brand shrink-0" />
          <span className="text-xs text-ink-secondary dark:text-ink-secondary-dark">
            Mã phiên xác thực hợp lệ
          </span>
        </div>

        {/* Mật khẩu mới */}
        <div className="space-y-1">
          <label
            htmlFor="newPassword"
            className="block text-xs font-semibold text-ink-secondary dark:text-ink-secondary-dark uppercase tracking-wider"
          >
            Mật khẩu mới
          </label>
          <div className="relative">
            <Input
              id="newPassword"
              type={showPassword ? 'text' : 'password'}
              placeholder="Tối thiểu 6 ký tự"
              autoComplete="new-password"
              disabled={isSubmitting}
              error={Boolean(errors.newPassword)}
              className="pr-11"
              {...register('newPassword')}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-primary dark:hover:text-ink-primary-dark transition-colors"
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>
          {errors.newPassword && (
            <p className="text-xs text-coral mt-1">
              {errors.newPassword.message}
            </p>
          )}
        </div>

        {/* Xác nhận mật khẩu mới */}
        <div className="space-y-1">
          <label
            htmlFor="confirmPassword"
            className="block text-xs font-semibold text-ink-secondary dark:text-ink-secondary-dark uppercase tracking-wider"
          >
            Xác nhận mật khẩu mới
          </label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Nhập lại mật khẩu mới"
              autoComplete="new-password"
              disabled={isSubmitting}
              error={Boolean(errors.confirmPassword)}
              className="pr-11"
              {...register('confirmPassword')}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              tabIndex={-1}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-primary dark:hover:text-ink-primary-dark transition-colors"
            >
              {showConfirmPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-xs text-coral mt-1">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        {/* Action Button */}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full mt-2 uppercase tracking-wider text-sm font-semibold flex items-center justify-center gap-2"
        >
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {isSubmitting ? 'ĐANG CẬP NHẬT...' : 'CẬP NHẬT MẬT KHẨU'}
        </Button>

        {/* Back to Login */}
        <div className="text-center pt-2">
          <Link
            to="/login"
            className="text-xs text-ink-secondary hover:text-ink-primary dark:text-ink-secondary-dark inline-flex items-center gap-1 font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Quay lại trang Đăng nhập
          </Link>
        </div>
      </form>
    </AuthLayout>
  )
}
