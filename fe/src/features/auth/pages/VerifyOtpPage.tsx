import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, RefreshCw, Mail } from 'lucide-react'

import { AuthLayout } from '@/components/common/AuthLayout'
import { OtpInput } from '@/components/ui/otp-input'
import { Button } from '@/components/ui/button'
import { useCountdown } from '@/features/auth/hooks/useCountdown'
import { authApi } from '@/features/auth/services/auth.api'
import { useAuthStore } from '@/stores/auth.store'

export function VerifyOtpPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const email = searchParams.get('email') || ''

  const { setAuth } = useAuthStore()
  const [otp, setOtp] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // 60-second cooldown timer for resending OTP
  const { isFinished, formattedTime, start: restartCountdown } = useCountdown(60)

  // Handler for OTP verification (called manually or via onComplete)
  const handleVerify = async (codeToVerify?: string) => {
    const finalOtp = codeToVerify || otp

    if (!email) {
      toast.error('Thiếu thông tin email để xác thực. Vui lòng đăng ký lại.')
      return
    }

    if (finalOtp.length !== 6) {
      setErrorMessage('Vui lòng nhập đủ 6 chữ số mã OTP')
      return
    }

    try {
      setIsSubmitting(true)
      setErrorMessage(null)

      const res = await authApi.verifyEmail({ email, otp: finalOtp })

      // Successfully verified: store token & user profile
      setAuth(res.accessToken, res.user)
      toast.success(`Xác thực thành công! Chào mừng ${res.user.username} đến với ReChat.`)
      navigate('/chat', { replace: true })
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Mã OTP không chính xác hoặc đã hết hạn'
      setErrorMessage(msg)
      toast.error(msg)
      setOtp('') // Reset to allow typing again
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handler for Resending OTP
  const handleResend = async () => {
    if (!email || !isFinished || isResending) return

    try {
      setIsResending(true)
      await authApi.resendVerification(email)
      toast.success('Mã OTP mới đã được gửi tới hộp thư của bạn!')
      restartCountdown(60)
      setOtp('')
      setErrorMessage(null)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Không thể gửi lại mã OTP. Vui lòng thử lại sau.'
      toast.error(msg)
    } finally {
      setIsResending(false)
    }
  }

  // Fallback if accessed without email query parameter
  if (!email) {
    return (
      <AuthLayout
        title="Xác thực Email"
        subtitle="Không tìm thấy thông tin tài khoản cần xác thực."
      >
        <div className="text-center py-6 space-y-4">
          <p className="text-sm text-ink-secondary dark:text-ink-secondary-dark">
            Vui lòng đăng ký tài khoản hoặc đăng nhập để tiếp tục.
          </p>
          <Button asChild className="w-full">
            <Link to="/register">Quay lại Đăng ký</Link>
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Xác thực hộp thư"
      subtitle="Chúng tôi đã gửi mã xác nhận 6 chữ số đến địa chỉ email:"
    >
      <div className="space-y-6">
        {/* Email Badge & Edit Link */}
        <div className="flex items-center justify-center gap-2 bg-brand-soft/30 dark:bg-brand-dark/20 py-2 px-3 rounded-xl border border-border-light dark:border-border-dark">
          <Mail className="w-4 h-4 text-brand" />
          <span className="font-semibold text-sm text-ink-primary dark:text-ink-primary-dark">
            {email}
          </span>
          <Link
            to="/register"
            className="text-xs text-brand hover:underline ml-1 font-medium"
            title="Đổi email khác"
          >
            Đổi
          </Link>
        </div>

        {/* 6-Digit OtpInput Primitive */}
        <div className="space-y-2">
          <OtpInput
            length={6}
            value={otp}
            disabled={isSubmitting}
            error={Boolean(errorMessage)}
            onChange={(val) => {
              setOtp(val)
              if (errorMessage) setErrorMessage(null)
            }}
            onComplete={(code) => handleVerify(code)}
          />

          {errorMessage && (
            <p className="text-xs text-coral text-center mt-2 font-medium">
              {errorMessage}
            </p>
          )}
        </div>

        {/* Action Button */}
        <Button
          type="button"
          onClick={() => handleVerify()}
          disabled={isSubmitting || otp.length !== 6}
          className="w-full uppercase tracking-wider text-sm font-semibold flex items-center justify-center gap-2"
        >
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {isSubmitting ? 'ĐANG XÁC THỰC...' : 'XÁC NHẬN'}
        </Button>

        {/* Resend Cooldown Section */}
        <div className="text-center pt-2 text-xs">
          {isFinished ? (
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending}
              className="text-brand font-semibold hover:underline inline-flex items-center gap-1.5"
            >
              {isResending ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              {isResending ? 'Đang gửi...' : 'GỬI LẠI MÃ XÁC THỰC'}
            </button>
          ) : (
            <p className="text-ink-secondary dark:text-ink-secondary-dark">
              Không nhận được mã?{' '}
              <span className="font-mono font-semibold text-ink-primary dark:text-ink-primary-dark">
                Gửi lại sau {formattedTime}
              </span>
            </p>
          )}
        </div>

        {/* Back to Login */}
        <div className="text-center pt-2">
          <Link
            to="/login"
            className="text-xs text-ink-secondary hover:text-ink-primary dark:text-ink-secondary-dark inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Quay lại trang Đăng nhập
          </Link>
        </div>
      </div>
    </AuthLayout>
  )
}
