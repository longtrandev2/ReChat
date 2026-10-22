import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

import { AuthLayout } from '@/components/common/AuthLayout'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { registerSchema, type RegisterFormData } from '@/features/auth/schemas/auth.schema'
import { authApi } from '@/features/auth/services/auth.api'

export function RegisterPage() {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  })

  const onSubmit = async (data: RegisterFormData) => {
    try {
      await authApi.register(data)
      toast.success('Đăng ký tài khoản thành công! Vui lòng xác thực email.')
      navigate(`/verify-otp?email=${encodeURIComponent(data.email)}`)
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Đăng ký không thành công. Vui lòng thử lại.'
      toast.error(errorMsg)
    }
  }

  return (
    <AuthLayout
      title="Tạo tài khoản"
      subtitle="Nhập thông tin cá nhân để tạo tài khoản ReChat mới."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
        {/* Username */}
        <div className="space-y-1">
          <label
            htmlFor="username"
            className="block text-xs font-semibold text-ink-secondary dark:text-ink-secondary-dark uppercase tracking-wider"
          >
            Tên người dùng
          </label>
          <Input
            id="username"
            type="text"
            placeholder="alex"
            autoComplete="username"
            disabled={isSubmitting}
            error={Boolean(errors.username)}
            {...register('username')}
          />
          {errors.username && (
            <p className="text-xs text-coral mt-1">
              {errors.username.message}
            </p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-1">
          <label
            htmlFor="email"
            className="block text-xs font-semibold text-ink-secondary dark:text-ink-secondary-dark uppercase tracking-wider"
          >
            Địa chỉ Email
          </label>
          <Input
            id="email"
            type="email"
            placeholder="alex@gmail.com"
            autoComplete="email"
            disabled={isSubmitting}
            error={Boolean(errors.email)}
            {...register('email')}
          />
          {errors.email && (
            <p className="text-xs text-coral mt-1">
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Mật khẩu */}
        <div className="space-y-1">
          <label
            htmlFor="password"
            className="block text-xs font-semibold text-ink-secondary dark:text-ink-secondary-dark uppercase tracking-wider"
          >
            Mật khẩu
          </label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Tối thiểu 6 ký tự"
              autoComplete="new-password"
              disabled={isSubmitting}
              error={Boolean(errors.password)}
              className="pr-11"
              {...register('password')}
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
          {errors.password && (
            <p className="text-xs text-coral mt-1">
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Xác nhận mật khẩu */}
        <div className="space-y-1">
          <label
            htmlFor="confirmPassword"
            className="block text-xs font-semibold text-ink-secondary dark:text-ink-secondary-dark uppercase tracking-wider"
          >
            Xác nhận mật khẩu
          </label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Nhập lại mật khẩu"
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

        {/* Nút Đăng ký */}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full mt-3 uppercase tracking-wider text-sm font-semibold flex items-center justify-center gap-2"
        >
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {isSubmitting ? 'ĐANG TẠO...' : 'ĐĂNG KÝ NGAY'}
        </Button>

        {/* Chuyển sang Đăng nhập */}
        <div className="text-center pt-2">
          <Link
            to="/login"
            className="text-sm text-brand font-semibold hover:underline block"
          >
            ĐÃ CÓ TÀI KHOẢN? ĐĂNG NHẬP
          </Link>
        </div>
      </form>
    </AuthLayout>
  )
}
