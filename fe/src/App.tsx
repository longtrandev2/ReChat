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
import { AppLayout } from '@/components/layout/AppLayout'
import { ChatLayout } from '@/features/conversations/components/ChatLayout'
import { WelcomeEmptyCanvas } from '@/components/layout/WelcomeEmptyCanvas'
import { ActiveChatCanvas } from '@/features/chat/components/ActiveChatCanvas'

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
          <Route path="/chat" element={<ChatLayout />}>
            <Route index element={<WelcomeEmptyCanvas />} />
            <Route path=":conversationId" element={<ActiveChatCanvas />} />
          </Route>
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
