import { AuthLayout } from '@/components/common/AuthLayout'

export function Verify2FAPage() {
  return (
    <AuthLayout
      title="Bảo mật 2 lớp"
      subtitle="Nhập mã xác thực từ ứng dụng Authenticator"
    >
      <div className="text-center py-8">
        <p className="text-sm text-ink-secondary">Đang tải biểu mẫu 2FA...</p>
      </div>
    </AuthLayout>
  )
}
