import { AuthLayout } from '@/components/common/AuthLayout'

export function VerifyOtpPage() {
  return (
    <AuthLayout
      title="Xác thực Email"
      subtitle="Nhập mã 6 chữ số đã gửi về hộp thư"
    >
      <div className="text-center py-8">
        <p className="text-sm text-ink-secondary">Đang tải mã OTP xác thực...</p>
      </div>
    </AuthLayout>
  )
}
