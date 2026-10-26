import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { useAuthStore } from '@/stores/auth.store'
import { ProtectedRoute } from '@/components/common/ProtectedRoute'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { RegisterPage } from '@/features/auth/pages/RegisterPage'
import { VerifyOtpPage } from '@/features/auth/pages/VerifyOtpPage'
import { Verify2FAPage } from '@/features/auth/pages/Verify2FAPage'
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage'
import { ResetPasswordPage } from '@/features/auth/pages/ResetPasswordPage'
import { Button } from '@/components/ui/button'
import { LogOut, MessageSquare } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'

/**
 * Temporary Chat App Shell for Protected Route testing
 */
function ChatPlaceholder() {
  const { user, logout } = useAuthStore()

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-canvas-light dark:bg-canvas-dark text-ink-primary dark:text-ink-primary-dark p-6">
      <div className="max-w-md w-full bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-3xl p-8 shadow-telegram text-center flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-brand flex items-center justify-center text-white shadow-md shadow-brand/20">
          <MessageSquare className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Chào mừng trở lại, {user?.username}!</h2>
          <p className="text-sm text-ink-secondary dark:text-ink-secondary-dark mt-1">
            Email: {user?.email}
          </p>
        </div>
        <div className="w-full py-3 px-4 bg-brand-soft/50 dark:bg-brand-dark/30 rounded-xl text-brand dark:text-brand-accent text-xs font-mono">
          Phiên đăng nhập đã được xác thực qua JWT & Redis
        </div>
        <Button
          variant="outline"
          onClick={logout}
          className="w-full flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4 text-coral" />
          Đăng xuất tài khoản
        </Button>
      </div>
    </div>
  )
}

export function App() {
  const { initializeAuth } = useAuthStore()

  useEffect(() => {
    // Tự động kiểm tra phiên đăng nhập và khôi phục UserProfile từ token
    initializeAuth()
  }, [initializeAuth])

  return (
    <BrowserRouter>
      {/* Toast Notification Container */}
      <Toaster richColors position="top-right" closeButton />

      {/* Main Application Routes */}
      <Routes>
        {/* Public Authentication Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-otp" element={<VerifyOtpPage />} />
        <Route path="/verify-2fa" element={<Verify2FAPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Protected Application Routes with Telegram AppLayout */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/chat" element={<ChatPlaceholder />} />
          <Route
            path="/friends"
            element={
              <div className="flex h-full w-full items-center justify-center p-6 text-ink-secondary">
                <p className="text-lg font-medium">Danh sách Bạn bè (Friends)</p>
              </div>
            }
          />
          <Route
            path="/settings"
            element={
              <div className="flex h-full w-full items-center justify-center p-6 text-ink-secondary">
                <p className="text-lg font-medium">Cài đặt Tài khoản (Settings)</p>
              </div>
            }
          />
        </Route>

        {/* Default Fallback Redirect */}
        <Route path="/" element={<Navigate to="/chat" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
