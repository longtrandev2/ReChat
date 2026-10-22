import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, ShieldCheck } from 'lucide-react'

import { AuthLayout } from '@/components/common/AuthLayout'
import { OtpInput } from '@/components/ui/otp-input'
import { Button } from '@/components/ui/button'
import { authApi } from '@/features/auth/services/auth.api'
import { useAuthStore } from '@/stores/auth.store'

export function Verify2FAPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const mfaToken = searchParams.get('mfaToken') || ''

  const { setAuth } = useAuthStore()
  const [otp, setOtp] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleVerify = async (codeToVerify?: string) => {
    const finalOtp = codeToVerify || otp

    if (!mfaToken) {
      toast.error('Phiên 2FA không hợp lệ. Vui lòng đăng nhập lại.')
      return
    }

    if (finalOtp.length !== 6) {
      setErrorMessage('Vui lòng nhập đủ 6 chữ số mã 2FA')
      return
    }

    try {
      setIsSubmitting(true)
      setErrorMessage(null)

      const res = await authApi.verify2FALogin({ mfaToken, otp: finalOtp })

      // Store token & user profile in Zustand and localStorage
      setAuth(res.accessToken, res.user)
      toast.success(`Đăng nhập thành công! Chào mừng trở lại, ${res.user.username}.`)
      navigate('/chat', { replace: true })
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Mã 2FA không chính xác hoặc đã hết hạn. Vui lòng thử lại.'
      setErrorMessage(msg)
      toast.error(msg)
      setOtp('') // Reset to allow entering again
    } finally {
      setIsSubmitting(false)
    }
  }

  // Fallback if accessed directly without mfaToken
  if (!mfaToken) {
    return (
      <AuthLayout
        title="Bảo mật 2 lớp"
        subtitle="Không tìm thấy phiên xác thực 2FA hợp lệ."
      >
        <div className="text-center py-6 space-y-4">
          <p className="text-sm text-ink-secondary dark:text-ink-secondary-dark">
            Phiên đăng nhập của bạn đã hết hạn hoặc thiếu thông tin bảo mật. Vui lòng đăng nhập lại từ đầu.
          </p>
          <Button asChild className="w-full">
            <Link to="/login">Quay lại trang Đăng nhập</Link>
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Bảo mật 2 lớp"
      subtitle="Mở ứng dụng Google Authenticator hoặc Authy trên điện thoại và nhập mã 6 chữ số."
    >
      <div className="space-y-6">
        {/* Security Info Badge */}
        <div className="flex items-center justify-center gap-2 bg-brand-soft/30 dark:bg-brand-dark/20 py-2.5 px-3 rounded-xl border border-border-light dark:border-border-dark text-center">
          <ShieldCheck className="w-4 h-4 text-brand shrink-0" />
          <span className="text-xs text-ink-secondary dark:text-ink-secondary-dark">
            Mã TOTP làm mới tự động mỗi 30 giây
          </span>
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

        {/* Action Submit Button */}
        <Button
          type="button"
          onClick={() => handleVerify()}
          disabled={isSubmitting || otp.length !== 6}
          className="w-full uppercase tracking-wider text-sm font-semibold flex items-center justify-center gap-2"
        >
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {isSubmitting ? 'ĐANG KIỂM TRA...' : 'XÁC NHẬN'}
        </Button>

        {/* Back to Login Link */}
        <div className="text-center pt-2">
          <Link
            to="/login"
            className="text-xs text-ink-secondary hover:text-ink-primary dark:text-ink-secondary-dark inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Hủy và quay lại trang Đăng nhập
          </Link>
        </div>
      </div>
    </AuthLayout>
  )
}
