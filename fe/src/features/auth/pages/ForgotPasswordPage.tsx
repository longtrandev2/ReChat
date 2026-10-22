import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, MailCheck } from 'lucide-react'

import { AuthLayout } from '@/components/common/AuthLayout'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  forgotPasswordSchema,
  type ForgotPasswordFormData,
} from '@/features/auth/schemas/auth.schema'
import { authApi } from '@/features/auth/services/auth.api'

export function ForgotPasswordPage() {
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  })

  const onSubmit = async (data: ForgotPasswordFormData) => {
    try {
      await authApi.forgotPassword({ email: data.email })
      setSubmittedEmail(data.email)
      toast.success('Yêu cầu đặt lại mật khẩu đã được gửi!')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Không thể gửi yêu cầu đặt lại mật khẩu. Vui lòng thử lại.'
      toast.error(msg)
    }
  }

  // Success view once email is dispatched
  if (submittedEmail) {
    return (
      <AuthLayout
        title="Kiểm tra hộp thư"
        subtitle="Hướng dẫn đặt lại mật khẩu đã được gửi."
      >
        <div className="space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-brand-soft/40 dark:bg-brand-dark/30 flex items-center justify-center text-brand mx-auto">
            <MailCheck className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <p className="text-sm text-ink-primary dark:text-ink-primary-dark">
              Chúng tôi đã gửi email chứa liên kết khôi phục mật khẩu tới địa chỉ:
            </p>
            <p className="font-semibold text-sm text-brand font-mono bg-brand-soft/30 dark:bg-brand-dark/20 py-2 px-3 rounded-xl border border-border-light dark:border-border-dark inline-block">
              {submittedEmail}
            </p>
            <p className="text-xs text-ink-secondary dark:text-ink-secondary-dark leading-relaxed pt-1">
              Vui lòng kiểm tra hộp thư đến (hoặc hòm thư rác/spam) và nhấp vào liên kết để tạo mật khẩu mới.
            </p>
          </div>

          <Button asChild className="w-full uppercase tracking-wider text-sm font-semibold">
            <Link to="/login">QUAY LẠI ĐĂNG NHẬP</Link>
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Khôi phục mật khẩu"
      subtitle="Nhập email của bạn để nhận liên kết đặt lại mật khẩu mới."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Email Input */}
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
            placeholder="name@domain.com hoặc alex@example.com"
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

        {/* Action Button */}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full mt-2 uppercase tracking-wider text-sm font-semibold flex items-center justify-center gap-2"
        >
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {isSubmitting ? 'ĐANG GỬI...' : 'GỬI LIÊN KẾT'}
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
