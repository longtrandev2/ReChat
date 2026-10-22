import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

import { AuthLayout } from '@/components/common/AuthLayout'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { loginSchema, type LoginFormData } from '@/features/auth/schemas/auth.schema'
import { authApi } from '@/features/auth/services/auth.api'
import { useAuthStore } from '@/stores/auth.store'

export function LoginPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      usernameOrEmail: '',
      password: '',
    },
  })

  const onSubmit = async (data: LoginFormData) => {
    try {
      const res = await authApi.login(data)

      // Trường hợp 1: Tài khoản có kích hoạt 2FA
      if ('requires2FA' in res && res.requires2FA) {
        toast.info('Tài khoản yêu cầu mã xác thực 2 lớp (2FA)')
        navigate(`/verify-2fa?mfaToken=${encodeURIComponent(res.mfaToken)}`)
        return
      }

      // Trường hợp 2: Đăng nhập thành công trả về token + user
      if ('accessToken' in res) {
        setAuth(res.accessToken, res.user)
        toast.success(`Chào mừng trở lại, ${res.user.username}!`)
        navigate('/chat', { replace: true })
      }
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Đăng nhập không thành công. Vui lòng kiểm tra lại thông tin.'
      toast.error(errorMsg)
    }
  }

  return (
    <AuthLayout
      title="Đăng nhập"
      subtitle="Nhập tài khoản để tiếp tục vào ReChat"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Username hoặc Email */}
        <div className="space-y-1.5">
          <label
            htmlFor="usernameOrEmail"
            className="block text-xs font-medium text-ink-secondary dark:text-ink-secondary-dark"
          >
            Tài khoản hoặc Email
          </label>
          <Input
            id="usernameOrEmail"
            type="text"
            placeholder="username hoặc email@rechat.io"
            autoComplete="username"
            disabled={isSubmitting}
            error={Boolean(errors.usernameOrEmail)}
            {...register('usernameOrEmail')}
          />
          {errors.usernameOrEmail && (
            <p className="text-xs text-coral mt-1">
              {errors.usernameOrEmail.message}
            </p>
          )}
        </div>

        {/* Mật khẩu */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="block text-xs font-medium text-ink-secondary dark:text-ink-secondary-dark"
            >
              Mật khẩu
            </label>
            <Link
              to="/forgot-password"
              className="text-xs text-brand hover:underline font-medium"
            >
              Quên mật khẩu?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={isSubmitting}
              error={Boolean(errors.password)}
              className="pr-10"
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-primary dark:hover:text-ink-primary-dark transition-colors"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-coral mt-1">
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Nút Đăng nhập */}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full mt-2 flex items-center justify-center gap-2"
        >
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {isSubmitting ? 'Đang xác thực...' : 'Đăng nhập'}
        </Button>

        {/* Chuyển sang Đăng ký */}
        <div className="text-center pt-2">
          <p className="text-xs text-ink-secondary dark:text-ink-secondary-dark">
            Chưa có tài khoản?{' '}
            <Link
              to="/register"
              className="text-brand font-semibold hover:underline"
            >
              Đăng ký ngay
            </Link>
          </p>
        </div>
      </form>
    </AuthLayout>
  )
}
